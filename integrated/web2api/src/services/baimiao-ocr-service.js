import { BaimiaoClient } from "./baimiao-client.js";
import { getBaimiaoConfig, persistBaimiaoSession } from "./baimiao-config-service.js";

function normalizeBase64(raw) {
  if (typeof raw !== "string") {
    throw new Error("image_base64 must be string");
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("image_base64 is empty");
  }

  const marker = "base64,";
  const payload = trimmed.includes(marker) ? trimmed.split(marker)[1] : trimmed;
  if (!payload) {
    throw new Error("image_base64 payload is empty");
  }

  return payload;
}

async function fetchImageAsBase64(imageUrl) {
  if (typeof imageUrl !== "string" || !imageUrl.trim()) {
    throw new Error("image_url is required");
  }

  const response = await fetch(imageUrl, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  return bytes.toString("base64");
}

export async function extractBaimiaoImagePayload(body) {
  const hasImageBase64Key =
    Object.prototype.hasOwnProperty.call(body ?? {}, "image_base64") ||
    Object.prototype.hasOwnProperty.call(body ?? {}, "imageBase64") ||
    Object.prototype.hasOwnProperty.call(body ?? {}, "base64");
  const hasImageUrlKey =
    Object.prototype.hasOwnProperty.call(body ?? {}, "image_url") ||
    Object.prototype.hasOwnProperty.call(body ?? {}, "imageUrl") ||
    Object.prototype.hasOwnProperty.call(body ?? {}, "url");
  const imageBase64 = body?.image_base64 ?? body?.imageBase64 ?? body?.base64;
  const imageUrl = body?.image_url ?? body?.imageUrl ?? body?.url;

  if (hasImageBase64Key) {
    return {
      base64: normalizeBase64(imageBase64),
      source: "json_base64"
    };
  }

  if (hasImageUrlKey) {
    return {
      base64: await fetchImageAsBase64(imageUrl),
      source: "json_url"
    };
  }

  throw new Error("Request must include image_base64 or image_url");
}

export async function runBaimiaoOcr(body, accountId) {
  const { base64, source } = await extractBaimiaoImagePayload(body);
  const credentials = getBaimiaoConfig(accountId);
  if (!credentials) {
    throw new Error("Baimiao account not found");
  }

  if (!credentials.username || !credentials.password) {
    throw new Error("Baimiao username or password not configured");
  }

  const client = new BaimiaoClient(credentials);
  const text = await client.recognize(base64);
  persistBaimiaoSession(credentials.accountId, {
    loginToken: client.loginToken,
    uuid: client.uuid
  });

  return {
    source,
    text
  };
}

export async function runBaimiaoOcrBatch(body, accountId, maxCount = 50) {
  // Product/UI and HAR both indicate batch OCR upper bound is 50 images per request.
  // Source: `参考/web.baimiaoapp.com.har` + page text in saved html.
  const items = Array.isArray(body?.images) ? body.images : [];
  if (!items.length) {
    throw new Error("images is required");
  }
  if (items.length > maxCount) {
    throw new Error(`Batch OCR supports at most ${maxCount} images per request`);
  }

  const credentials = getBaimiaoConfig(accountId);
  if (!credentials) {
    throw new Error("Baimiao account not found");
  }
  if (!credentials.username || !credentials.password) {
    throw new Error("Baimiao username or password not configured");
  }

  // 逐个解析图片 payload，单张失败不影响整批
  const payloads = await Promise.all(
    items.map(async (item, index) => {
      try {
        const payload = await extractBaimiaoImagePayload(item ?? {});
        return { index, ok: true, ...payload };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { index, ok: false, error: `index=${index}: ${message}`, base64: null, source: "json_base64" };
      }
    })
  );

  // 只把解析成功的图片送去识别
  const validPayloads = payloads.filter((p) => p.ok && p.base64);
  if (!validPayloads.length) {
    throw new Error("All images failed to parse: " + payloads.map((p) => p.error).join("; "));
  }

  const client = new BaimiaoClient(credentials);
  const texts = await client.recognizeBatch(validPayloads.map((p) => p.base64));

  // 将识别结果映射回原始索引
  const textByIndex = new Map(validPayloads.map((p, i) => [p.index, texts[i]]));
  const results = payloads.map((p) => {
    if (!p.ok) {
      return { index: p.index, ok: false, error: p.error, text: "" };
    }
    return {
      index: p.index,
      ok: true,
      source: p.source,
      text: textByIndex.get(p.index) ?? ""
    };
  });

  persistBaimiaoSession(credentials.accountId, {
    loginToken: client.loginToken,
    uuid: client.uuid
  });

  return {
    total: items.length,
    successCount: results.filter((item) => item.ok).length,
    results
  };
}
