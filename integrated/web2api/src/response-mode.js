const CHAT_RESPONSE_MODE_STORAGE_KEY = "chat-response-mode";
export const NON_STREAM_RESPONSE_MODE = "non-stream";
export const STREAM_RESPONSE_MODE = "stream";

function readStoredResponseMode() {
  try {
    const mode = window.localStorage.getItem(CHAT_RESPONSE_MODE_STORAGE_KEY);
    return mode === NON_STREAM_RESPONSE_MODE ? NON_STREAM_RESPONSE_MODE : STREAM_RESPONSE_MODE;
  } catch {
    return STREAM_RESPONSE_MODE;
  }
}

function persistResponseMode(mode) {
  try {
    window.localStorage.setItem(CHAT_RESPONSE_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage write failures and keep the in-memory selection.
  }
}

export function initializeResponseModeControl(control) {
  const mode = readStoredResponseMode();
  control.value = mode;
  persistResponseMode(mode);
  control.onchange = () => {
    persistResponseMode(control.value);
  };
}

export function isStreamModeEnabled(control) {
  return control.value !== NON_STREAM_RESPONSE_MODE;
}
