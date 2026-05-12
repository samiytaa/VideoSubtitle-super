import {
  createBaimiaoApiKeyRecord,
  deleteBaimiaoAccount,
  deleteBaimiaoApiKeyRecord,
  getBaimiaoApiKeyRecord,
  getBaimiaoConfigSummary,
  listAvailableBaimiaoAccounts,
  saveBaimiaoAccount,
  setSelectedBaimiaoAccount,
  takeBaimiaoRoundRobinAccount
} from "../services/baimiao-config-service.js";
import { runBaimiaoOcr, runBaimiaoOcrBatch } from "../services/baimiao-ocr-service.js";
import { parseJsonBody, readRequestBody, sendError, sendJson } from "../utils/http.js";

const MAX_BATCH_SIZE_PER_ACCOUNT = 50;

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function splitEvenly(items, parts) {
  const groups = [];
  const base = Math.floor(items.length / parts);
  const remainder = items.length % parts;
  let start = 0;

  for (let i = 0; i < parts; i += 1) {
    const size = base + (i < remainder ? 1 : 0);
    const end = start + size;
    groups.push(items.slice(start, end));
    start = end;
  }

  return groups;
}

async function runMultiAccountBatchOcr(images, accounts) {
  const indexedImages = images.map((image, index) => ({ index, image }));
  const groups = splitEvenly(indexedImages, accounts.length).filter((group) => group.length > 0);
  const allResults = [];

  for (let i = 0; i < groups.length; i += 1) {
    const account = accounts[i % accounts.length];
    const chunks = chunkArray(groups[i], MAX_BATCH_SIZE_PER_ACCOUNT);

    for (const chunk of chunks) {
      const payload = { images: chunk.map((item) => item.image) };
      const batch = await runBaimiaoOcrBatch(payload, account.id, MAX_BATCH_SIZE_PER_ACCOUNT);

      batch.results.forEach((result, localIndex) => {
        const original = chunk[localIndex];
        allResults.push({
          index: original.index,
          ok: result.ok,
          source: result.source,
          text: result.text,
          error: result.error,
          accountId: account.id
        });
      });
    }
  }

  const results = allResults.sort((a, b) => a.index - b.index);
  return {
    total: images.length,
    successCount: results.filter((item) => item.ok).length,
    accountCount: accounts.length,
    maxBatchSizePerAccount: MAX_BATCH_SIZE_PER_ACCOUNT,
    results
  };
}

async function readJsonRequest(request) {
  return parseJsonBody(await readRequestBody(request)) ?? {};
}

function resolveBearerToken(request) {
  const authorization = request.headers.authorization ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : authorization.trim();
}

export async function handlePrivateBaimiaoRequest({ request, response, url }) {
  if (request.method === "GET" && url.pathname === "/api/baimiao/config") {
    sendJson(response, 200, {
      baimiao: getBaimiaoConfigSummary()
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/baimiao/accounts") {
    const body = await readJsonRequest(request);
    saveBaimiaoAccount({
      username: body.username,
      password: body.password
    });
    sendJson(response, 200, {
      baimiao: getBaimiaoConfigSummary()
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/baimiao/select") {
    const body = await readJsonRequest(request);
    try {
      setSelectedBaimiaoAccount(body.accountId);
    } catch (error) {
      sendError(response, 404, error.message);
      return true;
    }

    sendJson(response, 200, {
      baimiao: getBaimiaoConfigSummary()
    });
    return true;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/baimiao/accounts/")) {
    const accountId = url.pathname.split("/").pop();
    const account = deleteBaimiaoAccount(accountId);
    if (!account) {
      sendError(response, 404, "Baimiao account not found");
      return true;
    }

    sendJson(response, 200, {
      accountId,
      baimiao: getBaimiaoConfigSummary(),
      ok: true
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/baimiao/api-keys") {
    const body = await readJsonRequest(request);
    try {
      const result = createBaimiaoApiKeyRecord({
        label: body.label,
        plainKey: body.plainKey
      });
      sendJson(response, 200, {
        ...result,
        baimiao: getBaimiaoConfigSummary()
      });
    } catch (error) {
      sendError(response, 400, error.message);
    }
    return true;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/baimiao/api-keys/")) {
    const keyId = url.pathname.split("/").pop();
    deleteBaimiaoApiKeyRecord(keyId);
    sendJson(response, 200, {
      baimiao: getBaimiaoConfigSummary(),
      ok: true
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/baimiao/debug-ocr") {
    const body = await readJsonRequest(request);
    const accountId = body.accountId || undefined;
    try {
      if (Array.isArray(body.images)) {
        if (!body.images.length) {
          sendError(response, 400, "images is required");
          return true;
        }

        let batch;
        if (accountId) {
          const chunks = chunkArray(body.images, MAX_BATCH_SIZE_PER_ACCOUNT);
          const allResults = [];
          for (const chunk of chunks) {
            const part = await runBaimiaoOcrBatch({ images: chunk }, accountId, MAX_BATCH_SIZE_PER_ACCOUNT);
            allResults.push(...part.results);
          }
          batch = {
            total: body.images.length,
            successCount: allResults.filter((item) => item.ok).length,
            accountCount: 1,
            maxBatchSizePerAccount: MAX_BATCH_SIZE_PER_ACCOUNT,
            results: allResults
          };
        } else {
          const accounts = listAvailableBaimiaoAccounts();
          if (!accounts.length) {
            sendError(response, 503, "No Baimiao accounts available");
            return true;
          }
          batch = await runMultiAccountBatchOcr(body.images, accounts);
        }

        sendJson(response, 200, {
          ok: true,
          mode: "batch",
          ...batch
        });
        return true;
      }

      const result = await runBaimiaoOcr(body, accountId);
      sendJson(response, 200, {
        ok: true,
        mode: "single",
        source: result.source,
        text: result.text
      });
    } catch (error) {
      sendError(response, 502, error.message);
    }
    return true;
  }

  return false;
}

export async function handleBaimiaoOcrRequest(request, response, url) {
  const isLegacyOcrRoute = url.pathname === "/ocr";
  const isVersionedOcrRoute = url.pathname === "/v1/baimiao/ocr";
  const isHealthRoute = url.pathname === "/healthz";

  if (request.method === "GET" && isHealthRoute) {
    sendJson(response, 200, { status: "ok" });
    return true;
  }

  if (request.method !== "POST" || (!isLegacyOcrRoute && !isVersionedOcrRoute)) {
    return false;
  }

  const token = resolveBearerToken(request);
  if (!token) {
    sendError(response, 401, "Missing Authorization header");
    return true;
  }

  const apiKeyRecord = getBaimiaoApiKeyRecord(token);
  if (!apiKeyRecord) {
    sendError(response, 401, "Invalid Authorization token");
    return true;
  }

  try {
    const body = await readJsonRequest(request);
    if (Array.isArray(body.images)) {
      if (!body.images.length) {
        sendError(response, 400, "images is required");
        return true;
      }

      const accounts = listAvailableBaimiaoAccounts();
      if (!accounts.length) {
        sendError(response, 503, "No Baimiao accounts available");
        return true;
      }

      const batchResult = await runMultiAccountBatchOcr(body.images, accounts);
      sendJson(response, 200, {
        ok: true,
        mode: "batch",
        ...batchResult
      });
      return true;
    }

    const account = takeBaimiaoRoundRobinAccount(apiKeyRecord);
    if (!account) {
      sendError(response, 503, "No Baimiao accounts available");
      return true;
    }

    const result = await runBaimiaoOcr(body, account.id);
    response.writeHead(200, {
      "content-type": "text/plain; charset=utf-8",
      "x-baimiao-account-id": account.id,
      "x-baimiao-source": result.source
    });
    response.end(result.text);
  } catch (error) {
    sendError(response, 502, `OCR failed: ${error.message}`);
  }

  return true;
}
