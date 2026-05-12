import { config } from "../config.js";
import { buildSessionPayload } from "../services/app-payload-service.js";
import { loginAsAdmin, loginAsLocalUser, registerLocalUserSession, resolveSession } from "../services/auth-service.js";
import { clearCookie, parseJsonBody, readRequestBody, sendJson, setCookie } from "../utils/http.js";

async function readJsonRequest(request) {
  return parseJsonBody(await readRequestBody(request)) ?? {};
}

function sendSessionPayload(response, session) {
  setCookie(response, config.sessionCookieName, session.id, config.sessionTtlMs / 1000);
  sendJson(response, 200, buildSessionPayload(session));
}

async function handleLoginRequest(request, response) {
  const body = await readJsonRequest(request);
  const adminSession = loginAsAdmin(body.username, body.password);

  if (adminSession) {
    sendSessionPayload(response, adminSession);
    return true;
  }

  sendSessionPayload(response, loginAsLocalUser(body.username, body.password));

  return true;
}

async function handleRegisterRequest(request, response) {
  const body = await readJsonRequest(request);
  const session = registerLocalUserSession({
    inviteCode: body.inviteCode,
    password: body.password,
    username: body.username
  });
  sendSessionPayload(response, session);

  return true;
}

function handleLogoutRequest(response) {
  clearCookie(response, config.sessionCookieName);
  sendJson(response, 200, { ok: true });
  return true;
}

export async function handlePublicApiRequest({ request, response, session, url }) {
  if (request.method === "GET" && url.pathname === "/api/me") {
    sendJson(response, 200, buildSessionPayload(session ?? resolveSession()));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/discovery") {
    sendJson(response, 200, {
      paths: [...config.allowedProxyPaths].sort()
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    return handleLoginRequest(request, response);
  }

  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    return handleRegisterRequest(request, response);
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    return handleLogoutRequest(response);
  }

  return false;
}
