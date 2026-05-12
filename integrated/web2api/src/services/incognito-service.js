import { readStore, updateStore } from "../storage/store.js";

function buildState(ownerId) {
  const incognito = readStore().incognito;
  const ownerEnabled = Boolean(incognito.owners[ownerId]);

  return {
    effectiveEnabled: incognito.globalEnabled || ownerEnabled,
    globalEnabled: incognito.globalEnabled,
    ownerEnabled
  };
}

function updateIncognito(updater) {
  return updateStore((state) => ({
    ...state,
    incognito: updater(state.incognito)
  })).incognito;
}

export function getIncognitoStateForOwner(ownerId) {
  return buildState(ownerId);
}

export function isIncognitoEnabledForOwner(ownerId) {
  return getIncognitoStateForOwner(ownerId).effectiveEnabled;
}

export function setGlobalIncognitoEnabled(enabled) {
  const nextEnabled = Boolean(enabled);

  return updateStore((state) => ({
    ...state,
    incognito: {
      ...state.incognito,
      globalEnabled: nextEnabled
    },
    sharedAccountMode: nextEnabled
      ? state.sharedAccountMode
      : { ...state.sharedAccountMode, enabled: false }
  })).incognito;
}

export function setOwnerIncognitoEnabled(ownerId, enabled) {
  return updateIncognito((incognito) => ({
    ...incognito,
    owners: {
      ...incognito.owners,
      [ownerId]: Boolean(enabled)
    }
  }));
}
