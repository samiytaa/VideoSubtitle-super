export const INITIAL_STATE = Object.freeze({
  session: null,
  accounts: [],
  apiKeys: [],
  adminData: {
    invites: [],
    registration: {
      inviteRequired: false
    },
    users: []
  },
  registration: {
    inviteRequired: false
  },
  selectedAccountId: "",
  selectedSessionId: "",
  currentMessageId: null,
  sessions: [],
  messages: [],
  draftFiles: [],
  isSending: false,
  discoveredPaths: []
});

export const ELEMENT_IDS = [
  "account-form", "account-list", "account-password", "account-select", "account-status", "account-username",
  "admin-invite-form", "admin-invite-count", "admin-invite-list",
  "admin-invite-status", "admin-register-hint", "admin-registration-form", "admin-registration-status",
  "admin-user-list", "admin-user-status", "api-key-count", "api-key-form", "api-key-label", "api-key-output",
  "api-key-plain", "api-key-tool-calls", "api-keys", "app-status", "app-view", "attach-files", "chat-status",
  "delete-selected-invites", "delete-selected-users", "disable-selected-users", "draft-files", "enable-selected-users",
  "endpoint-count", "explorer-body", "explorer-form", "explorer-method", "explorer-output", "explorer-path",
  "explorer-query", "file-input", "incognito-description", "incognito-form",
  "incognito-label", "incognito-status", "incognito-summary", "incognito-toggle", "invite-required-toggle",
  "message-count", "messages", "metric-session-count", "model-select", "new-session", "prompt-input", "refresh-sessions",
  "response-mode", "role-label", "send-button", "session-caption", "session-count", "sessions", "tab-admin", "user-summary"
];
