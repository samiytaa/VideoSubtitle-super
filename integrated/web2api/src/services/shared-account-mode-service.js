import { readStore, updateStore } from "../storage/store.js";
import { listUsableAccounts, listUsableAccountsForOwner } from "./account-service.js";

function normalizeMode(value) {
  return {
    enabled: Boolean(value?.enabled)
  };
}

export function getSharedAccountMode() {
  return normalizeMode(readStore().sharedAccountMode);
}

export function isSharedAccountModeEnabled() {
  return getSharedAccountMode().enabled;
}

export function buildSharedAccountModePayload(session) {
  return {
    enabled: false,
    canToggle: false,
    requiresGlobalIncognito: false
  };
}

export function assertOwnerHasUsableAccount(ownerId) {
  if (listUsableAccountsForOwner(ownerId).length) {
    return;
  }

  throw new Error("Bind a usable DeepSeek account before creating API keys in shared account mode");
}

export function setSharedAccountModeEnabled(enabled) {
  const nextEnabled = Boolean(enabled);
  let nextMode;

  updateStore((state) => {
    if (nextEnabled && !listUsableAccounts().length) {
      throw new Error("Bind at least one usable DeepSeek account before enabling shared account mode");
    }

    nextMode = {
      enabled: nextEnabled
    };

    return {
      ...state,
      sharedAccountMode: nextMode
    };
  });

  return nextMode;
}
