import { listAccountsForOwner, resolveAccountLabel, saveAccount } from "./account-service.js";
import { getIncognitoStateForOwner } from "./incognito-service.js";
import { SINGLE_OWNER_ID, SINGLE_USERNAME } from "./owner-service.js";

function createSingleUserSession() {
  return {
    authenticated: true,
    ownerId: SINGLE_OWNER_ID,
    role: "single",
    username: SINGLE_USERNAME
  };
}

export function resolveSession() {
  return createSingleUserSession();
}

export function getVisibleAccounts(session) {
  if (!session) {
    return [];
  }

  return listAccountsForOwner(SINGLE_OWNER_ID);
}

export function resolveScopedAccount(session, requestedAccountId) {
  const visibleAccounts = getVisibleAccounts(session);
  const resolvedAccountId = requestedAccountId ?? visibleAccounts[0]?.id;
  return visibleAccounts.find((account) => account.id === resolvedAccountId) ?? null;
}

function buildAccountRecord({ deviceId, loginResult, loginValue, password }) {
  const user = loginResult.data.biz_data.user;
  const emailMasked = user.email ?? "";
  const mobileMasked = user.mobile_number ?? "";

  return saveAccount({
    ownerId: SINGLE_OWNER_ID,
    deepseekUserId: user.id,
    loginValue,
    password,
    deviceId,
    token: user.token,
    displayName: resolveAccountLabel({ emailMasked, loginValue, mobileMasked }),
    emailMasked,
    mobileMasked,
    areaCode: user.area_code ?? "+86"
  });
}

export function saveDeepseekAccountForOwner(options) {
  return buildAccountRecord(options);
}

export function loginAsAdmin() {
  return createSingleUserSession();
}

export function loginAsLocalUser() {
  return createSingleUserSession();
}

export function registerLocalUserSession() {
  return createSingleUserSession();
}

export function getSessionIncognitoState(session) {
  if (!session) {
    return {
      effectiveEnabled: false,
      globalEnabled: false,
      ownerEnabled: false
    };
  }

  return getIncognitoStateForOwner(session.ownerId);
}
