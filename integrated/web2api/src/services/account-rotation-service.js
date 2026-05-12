import { getAccountById, isUsableAccount, listUsableAccountsForOwner } from "./account-service.js";

const rotationCursorByApiKey = new Map();

export function takeRoundRobinAccount(apiKeyRecord) {
  const pool = listUsableAccountsForOwner(apiKeyRecord.ownerId);
  if (!pool.length) {
    return null;
  }

  const cursor = rotationCursorByApiKey.get(apiKeyRecord.id) ?? 0;
  const index = cursor % pool.length;
  rotationCursorByApiKey.set(apiKeyRecord.id, (index + 1) % pool.length);

  const selected = pool[index];
  if (isUsableAccount(selected)) {
    return selected;
  }

  // Fallback for safety if store changes between list and selection.
  const bound = getAccountById(apiKeyRecord.accountId);
  return isUsableAccount(bound) ? bound : null;
}
