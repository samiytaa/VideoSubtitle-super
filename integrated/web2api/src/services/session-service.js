import { config } from "../config.js";
import { readStore, updateStore } from "../storage/store.js";
import { createId } from "../utils/id.js";

function filterActiveSessions(sessions, now) {
  return sessions.filter((session) => session.expiresAt > now);
}

export function createSession(sessionInput) {
  const now = Date.now();
  const session = {
    id: createId(),
    createdAt: new Date(now).toISOString(),
    expiresAt: now + config.sessionTtlMs,
    ...sessionInput
  };

  updateStore((state) => ({
    ...state,
    sessions: [...filterActiveSessions(state.sessions, now), session]
  }));

  return session;
}

export function getSession(sessionId) {
  const now = Date.now();
  const state = updateStore((current) => ({
    ...current,
    sessions: filterActiveSessions(current.sessions, now)
  }));

  return state.sessions.find((session) => session.id === sessionId) ?? null;
}

export function deleteSession(sessionId) {
  updateStore((state) => ({
    ...state,
    sessions: state.sessions.filter((session) => session.id !== sessionId)
  }));
}

export function listSessions() {
  return readStore().sessions;
}
