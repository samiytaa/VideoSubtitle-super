import { createHash, randomUUID } from "node:crypto";

const BASE_URL = "https://web.baimiaoapp.com";
const JSON_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9",
  Host: "web.baimiaoapp.com",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
};

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestJson(pathname, options = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, options);
  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new Error(`Baimiao request failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  return payload;
}

export class BaimiaoClient {
  constructor({ username, password, uuid, loginToken }) {
    this.username = username;
    this.password = password;
    this.uuid = uuid;
    this.loginToken = loginToken;
  }

  createHeaders(extraHeaders = {}) {
    return {
      ...JSON_HEADERS,
      "X-AUTH-TOKEN": this.loginToken ?? "",
      "X-AUTH-UUID": this.uuid ?? "",
      ...extraHeaders
    };
  }

  async login() {
    this.uuid = this.uuid || randomUUID();
    const payload = {
      password: this.password,
      type: /^[0-9]+$/.test(this.username) ? "mobile" : "email",
      username: this.username
    };
    const data = await requestJson("/api/user/login", {
      body: JSON.stringify(payload),
      headers: this.createHeaders({
        "Content-Type": "application/json; charset=utf-8",
        "X-AUTH-TOKEN": "",
        "X-AUTH-UUID": this.uuid
      }),
      method: "POST"
    });

    if (!data?.data?.token) {
      throw new Error(`Login failed: ${JSON.stringify(data)}`);
    }

    this.loginToken = data.data.token;
    return {
      loginToken: this.loginToken,
      uuid: this.uuid
    };
  }

  async ensureAuthorized() {
    if (!this.uuid || !this.loginToken) {
      return this.login();
    }

    return {
      loginToken: this.loginToken,
      uuid: this.uuid
    };
  }

  async recognize(base64Image) {
    await this.ensureAuthorized();

    await requestJson("/api/user/login/anonymous", {
      headers: this.createHeaders(),
      method: "POST"
    });

    const permissionPayload = await requestJson("/api/perm/single", {
      body: JSON.stringify({ mode: "single", version: "v2" }),
      headers: this.createHeaders({
        "Content-Type": "application/json; charset=utf-8"
      }),
      method: "POST"
    });

    if (permissionPayload?.code !== 1 || !permissionPayload?.data?.engine) {
      throw new Error("Baimiao daily OCR limit reached");
    }

    const { engine, token } = permissionPayload.data;
    const hash = createHash("sha1").update(base64Image, "base64").digest("hex");
    const ossSignPayload = await requestJson("/api/oss/sign?mime_type=image%2Fpng", {
      headers: this.createHeaders(),
      method: "GET"
    });

    if (ossSignPayload?.code !== 1 || !ossSignPayload?.data?.result) {
      throw new Error(`Failed to get OSS sign: ${JSON.stringify(ossSignPayload)}`);
    }

    const ossConfig = ossSignPayload.data.result;
    const uploadForm = new FormData();
    uploadForm.append("success_action_status", "200");
    uploadForm.append("policy", ossConfig.policy);
    uploadForm.append("x-oss-signature", ossConfig.signature);
    uploadForm.append("x-oss-signature-version", "OSS4-HMAC-SHA256");
    uploadForm.append("x-oss-credential", ossConfig.x_oss_credential);
    uploadForm.append("x-oss-date", ossConfig.x_oss_date);
    uploadForm.append("key", ossConfig.file_key);
    uploadForm.append("x-oss-security-token", ossConfig.security_token);
    uploadForm.append("file", new Blob([Buffer.from(base64Image, "base64")], { type: "image/png" }), "upload.png");

    const uploadResponse = await fetch(ossConfig.host, {
      body: uploadForm,
      method: "POST"
    });

    if (!uploadResponse.ok) {
      throw new Error(`OSS upload failed with status ${uploadResponse.status}`);
    }

    const startPayload = await requestJson(`/api/ocr/image/${engine}`, {
      body: JSON.stringify({
        batchId: "",
        fileKey: ossConfig.file_key,
        hash,
        token,
        total: 1
      }),
      headers: this.createHeaders({
        "Content-Type": "application/json; charset=utf-8"
      }),
      method: "POST"
    });

    const jobStatusId = startPayload?.data?.jobStatusId;
    if (!jobStatusId) {
      throw new Error(`Failed to start OCR job: ${JSON.stringify(startPayload)}`);
    }

    for (let index = 0; index < 30; index += 1) {
      await sleep(2000);
      const statusPayload = await requestJson(
        `/api/ocr/image/${engine}/status?jobStatusId=${encodeURIComponent(jobStatusId)}`,
        {
          headers: this.createHeaders(),
          method: "GET"
        }
      );
      const statusData = statusPayload?.data;
      if (!statusData?.isEnded) {
        continue;
      }

      const words = statusData?.ydResp?.words_result ?? [];
      return words.map((item) => item.words).join("\n");
    }

    throw new Error("OCR job timed out");
  }

  async recognizeBatch(base64Images) {
    if (!Array.isArray(base64Images) || base64Images.length === 0) {
      throw new Error("base64Images is required");
    }

    await this.ensureAuthorized();

    // Official web flow confirmed from `参考/web.baimiaoapp.com.har`:
    // 1) POST /api/user/login/anonymous
    // 2) POST /api/perm/batch with {"mode":"batch","version":"v2"}
    // 3) For each image:
    //    - GET /api/oss/sign?mime_type=image%2Fjpeg
    //    - Upload image to OSS with signed form fields
    //    - POST /api/ocr/image/{engine} with shared batchId + total + token and per-image hash/fileKey
    // 4) Poll GET /api/ocr/image/{engine}/status?jobStatusId=...
    await requestJson("/api/user/login/anonymous", {
      headers: this.createHeaders(),
      method: "POST"
    });

    const permissionPayload = await requestJson("/api/perm/batch", {
      body: JSON.stringify({ mode: "batch", version: "v2" }),
      headers: this.createHeaders({
        "Content-Type": "application/json; charset=utf-8"
      }),
      method: "POST"
    });

    if (permissionPayload?.code !== 1 || !permissionPayload?.data?.engine || !permissionPayload?.data?.token) {
      throw new Error("Baimiao batch OCR permission denied");
    }

    const { engine, token } = permissionPayload.data;
    // HAR sample indicates engine is "plus" in batch mode.
    const batchId = randomUUID();
    const total = base64Images.length;
    const jobItems = [];

    for (let index = 0; index < base64Images.length; index += 1) {
      const base64Image = base64Images[index];
      try {
        // HAR sample shows `hash` is MD5 hex of image bytes (e.g. cfd457b1...).
        const hash = createHash("md5").update(Buffer.from(base64Image, "base64")).digest("hex");
        const ossSignPayload = await requestJson("/api/oss/sign?mime_type=image%2Fjpeg", {
          headers: this.createHeaders(),
          method: "GET"
        });

        if (ossSignPayload?.code !== 1 || !ossSignPayload?.data?.result) {
          throw new Error(`Failed to get OSS sign: ${JSON.stringify(ossSignPayload)}`);
        }

        const ossConfig = ossSignPayload.data.result;
        const uploadForm = new FormData();
        uploadForm.append("success_action_status", "200");
        uploadForm.append("policy", ossConfig.policy);
        uploadForm.append("x-oss-signature", ossConfig.signature);
        uploadForm.append("x-oss-signature-version", "OSS4-HMAC-SHA256");
        uploadForm.append("x-oss-credential", ossConfig.x_oss_credential);
        uploadForm.append("x-oss-date", ossConfig.x_oss_date);
        uploadForm.append("key", ossConfig.file_key);
        uploadForm.append("x-oss-security-token", ossConfig.security_token);
        uploadForm.append("file", new Blob([Buffer.from(base64Image, "base64")], { type: "image/jpeg" }), "upload.jpeg");

        const uploadResponse = await fetch(ossConfig.host, {
          body: uploadForm,
          method: "POST"
        });
        if (!uploadResponse.ok) {
          throw new Error(`OSS upload failed with status ${uploadResponse.status}`);
        }

        const startPayload = await requestJson(`/api/ocr/image/${engine}`, {
          body: JSON.stringify({
            // Batch mode contract (from HAR):
            // - Same batchId for all images in one batch
            // - Same total for all start requests
            // - token from /api/perm/batch
            batchId,
            total,
            token,
            hash,
            fileKey: ossConfig.file_key
          }),
          headers: this.createHeaders({
            "Content-Type": "application/json; charset=utf-8"
          }),
          method: "POST"
        });

        const jobStatusId = startPayload?.data?.jobStatusId;
        if (!jobStatusId) {
          throw new Error(`Failed to start OCR job: ${JSON.stringify(startPayload)}`);
        }
        jobItems.push({ index, hash, jobStatusId });
      } catch (err) {
        // 单张上传/提交失败，记录占位符，不中断整批
        jobItems.push({ index, hash: "", jobStatusId: null, uploadError: err.message });
      }
    }

    // Poll each job concurrently to reduce total batch latency.
    // Individual job failures are captured as error strings rather than throwing,
    // so one failed image does not abort the entire batch.
    const output = Array.from({ length: total }, () => "");
    await Promise.all(
      jobItems.map(async (item) => {
        if (item.uploadError || !item.jobStatusId) {
          output[item.index] = `[上传失败: ${item.uploadError ?? "未知错误"}]`;
          return;
        }
        try {
          for (let poll = 0; poll < 30; poll += 1) {
            await sleep(2000);
            const statusPayload = await requestJson(
              `/api/ocr/image/${engine}/status?jobStatusId=${encodeURIComponent(item.jobStatusId)}`,
              {
                headers: this.createHeaders(),
                method: "GET"
              }
            );
            const statusData = statusPayload?.data;
            if (!statusData?.isEnded) {
              continue;
            }
            const words = statusData?.ydResp?.words_result ?? [];
            output[item.index] = words.map((w) => w.words).join("\n");
            return;
          }
          output[item.index] = `[识别超时]`;
        } catch (err) {
          output[item.index] = `[识别失败: ${err.message}]`;
        }
      })
    );

    return output;
  }
}
