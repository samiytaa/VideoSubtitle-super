export const SINGLE_OWNER_ID = "local";
export const SINGLE_USERNAME = "本机使用者";

const LOCAL_OWNER_PREFIX = "local:";

export function createLocalOwnerId(userId) {
  return `${LOCAL_OWNER_PREFIX}${userId}`;
}

export function parseLocalOwnerId(ownerId) {
  if (typeof ownerId !== "string" || !ownerId.startsWith(LOCAL_OWNER_PREFIX)) {
    return null;
  }

  const userId = ownerId.slice(LOCAL_OWNER_PREFIX.length);
  return userId || null;
}

export function isLocalOwnerId(ownerId) {
  return Boolean(parseLocalOwnerId(ownerId));
}

export function collapseOwnerId() {
  return SINGLE_OWNER_ID;
}
