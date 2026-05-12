import { createHash, randomBytes, randomUUID } from "node:crypto";

export function createId() {
  return randomUUID();
}

export function createSecret(length = 32) {
  return randomBytes(length).toString("hex");
}

export function createApiKey() {
  return `dsr_${randomBytes(24).toString("base64url")}`;
}

export function hashValue(value) {
  return createHash("sha256").update(value).digest("hex");
}
