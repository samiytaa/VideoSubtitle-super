import { randomBytes } from "node:crypto";

import { readStore, updateStore } from "../storage/store.js";
import { createId } from "../utils/id.js";

function normalizeInviteCount(count) {
  const value = Number(count ?? 1);

  if (!Number.isInteger(value) || value < 1) {
    throw new Error("Invite count must be a positive integer");
  }

  return value;
}

export function normalizeInviteCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function generateInviteCode(existingCodes) {
  while (true) {
    const code = `INV-${randomBytes(6).toString("base64url").replaceAll("-", "").slice(0, 10).toUpperCase()}`;
    if (!existingCodes.has(code)) {
      existingCodes.add(code);
      return code;
    }
  }
}

function toPublicInvite(invite) {
  return {
    id: invite.id,
    code: invite.code,
    createdAt: invite.createdAt,
    usedAt: invite.usedAt ?? null,
    usedByUsername: invite.usedByUsername ?? ""
  };
}

export function listPublicInvites() {
  return readStore().invites
    .map(toPublicInvite)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function createInvites(count) {
  const total = normalizeInviteCount(count);
  const now = new Date().toISOString();
  const existingCodes = new Set(readStore().invites.map((invite) => invite.code));
  const createdInvites = Array.from({ length: total }, () => ({
    id: createId(),
    code: generateInviteCode(existingCodes),
    createdAt: now,
    usedAt: null,
    usedByUserId: null,
    usedByUsername: ""
  }));

  updateStore((state) => ({
    ...state,
    invites: [...createdInvites, ...state.invites]
  }));

  return createdInvites.map(toPublicInvite);
}

export function deleteInvites(inviteIds) {
  const inviteIdSet = new Set(inviteIds);

  updateStore((state) => ({
    ...state,
    invites: state.invites.filter((invite) => !inviteIdSet.has(invite.id))
  }));
}
