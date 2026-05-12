import { getApiKeyRecord } from "../services/api-key-service.js";
import { takeRoundRobinAccount } from "../services/account-rotation-service.js";
import { isIncognitoEnabledForOwner } from "../services/incognito-service.js";
import { collectOpenAiResponse, streamOpenAiResponse } from "../services/openai-bridge.js";
import { listOpenAiModels } from "../services/openai-request.js";
import { withOwnerRequestLimit } from "../services/request-limit-service.js";
import { parseJsonBody, readRequestBody, sendError, sendJson } from "../utils/http.js";

function getBearerToken(request) {
  const value = request.headers.authorization ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function resolveLimitStatus(error) {
  return error.code === "USER_DISABLED" ? 403 : 429;
}

function handleOpenAiError(response, error) {
  if (error.code === "USER_DISABLED" || error.code === "REQUEST_LIMIT") {
    sendError(response, resolveLimitStatus(error), error.message);
    return true;
  }

  if (error instanceof SyntaxError) {
    sendError(response, 400, "Invalid JSON body");
    return true;
  }

  if (error.statusCode) {
    sendError(response, error.statusCode, error.message);
    return true;
  }

  return false;
}

async function handleModelsRequest(response, apiKeyRecord) {
  await withOwnerRequestLimit(apiKeyRecord.ownerId, async () => {
    sendJson(response, 200, {
      object: "list",
      data: listOpenAiModels()
    });
  });
}

async function handleChatCompletionsRequest(request, response, apiKeyRecord) {
  await withOwnerRequestLimit(apiKeyRecord.ownerId, async () => {
    const body = parseJsonBody(await readRequestBody(request)) ?? {};
    const account = takeRoundRobinAccount(apiKeyRecord);
    if (!account) {
      sendError(response, 404, "Account not found");
      return;
    }

    const deleteAfterFinish = isIncognitoEnabledForOwner(apiKeyRecord.ownerId);
    if (body.stream) {
      await streamOpenAiResponse({
        response,
        account,
        body,
        deleteAfterFinish,
        toolCallsEnabled: apiKeyRecord.toolCallsEnabled
      });
      return;
    }

    const payload = await collectOpenAiResponse({
      account,
      body,
      deleteAfterFinish,
      toolCallsEnabled: apiKeyRecord.toolCallsEnabled
    });
    sendJson(response, 200, payload);
  });
}

export async function handleOpenAiRequest(request, response, url) {
  const apiKey = getBearerToken(request);
  const apiKeyRecord = apiKey ? getApiKeyRecord(apiKey) : null;

  if (!apiKeyRecord) {
    sendError(response, 401, "Invalid API key");
    return true;
  }

  try {
    if (request.method === "GET" && url.pathname === "/v1/models") {
      await handleModelsRequest(response, apiKeyRecord);
      return true;
    }

    if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
      await handleChatCompletionsRequest(request, response, apiKeyRecord);
      return true;
    }
  } catch (error) {
    if (!handleOpenAiError(response, error)) {
      throw error;
    }
    return true;
  }

  return false;
}
