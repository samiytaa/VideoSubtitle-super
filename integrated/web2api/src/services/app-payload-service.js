import { listApiKeysForOwner } from "./api-key-service.js";
import { getSessionIncognitoState, getVisibleAccounts } from "./auth-service.js";

export function toPublicAccount(account) {
  return {
    id: account.id,
    ownerId: account.ownerId,
    loginValue: account.loginValue,
    displayName: account.displayName,
    emailMasked: account.emailMasked,
    mobileMasked: account.mobileMasked,
    updatedAt: account.updatedAt
  };
}

function toIncognitoPayload(session) {
  const state = getSessionIncognitoState(session);

  return {
    effectiveEnabled: state.effectiveEnabled,
    globalEnabled: state.globalEnabled,
    ownerEnabled: state.ownerEnabled,
    scope: "self",
    scopeEnabled: state.ownerEnabled
  };
}

export function buildSessionPayload(session) {
  return {
    authenticated: true,
    role: session.role,
    ownerId: session.ownerId,
    username: session.username ?? "",
    accounts: getVisibleAccounts(session).map(toPublicAccount),
    apiKeys: listApiKeysForOwner(session.ownerId),
    adminEnabled: false,
    registration: {
      inviteRequired: false
    },
    incognito: toIncognitoPayload(session)
  };
}

export function buildAnonymousPayload() {
  return {
    authenticated: false,
    adminEnabled: false,
    registration: {
      inviteRequired: false
    }
  };
}
