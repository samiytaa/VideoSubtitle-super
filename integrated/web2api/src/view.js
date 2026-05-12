import { resolveAccountLabel } from "./account-display.js";
import { renderAccountListView } from "./account-list-view.js";
import { toggleAdminTab } from "./auth-ui.js";
import { patchLastMessageDelta, renderMessageList, replaceLastMessage } from "./message-list-view.js";
import { renderSessionList } from "./session-list-view.js";
import {
  getActiveTab,
  renderAccountOptions,
  renderApiKeyList,
  renderDraftFileList,
  resolveTabLabel,
  setPageTitle,
  setSelectOptions,
  updateDashboardMetrics
} from "./ui.js";

function setText(element, value) {
  if (!element) {
    return;
  }

  element.textContent = value || "";
}

function summarizeAccounts(accounts, fallbackLabel) {
  const labels = accounts.map(resolveAccountLabel).filter(Boolean);
  return labels.length ? labels.join(" / ") : fallbackLabel;
}

function getUserSummary(state) {
  return state.session?.username || summarizeAccounts(state.accounts, "未绑定账号");
}

function resolveSelectedSession(state) {
  return state.sessions.find((session) => session.id === state.selectedSessionId) ?? null;
}

function resolvePageTitle(state) {
  const activeTab = getActiveTab();
  if (activeTab !== "chat") {
    return resolveTabLabel(activeTab);
  }

  return resolveSelectedSession(state)?.title || resolveTabLabel(activeTab);
}

function describeIncognito(incognito) {
  return incognito.effectiveEnabled ? "当前：仅自己开启" : "当前：关闭";
}

function getIncognitoSummary(incognito) {
  return incognito.effectiveEnabled ? "个人" : "关闭";
}

export function collectElements(ids) {
  return Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
}

export function setStatus(element, value) {
  if (!element) {
    return;
  }

  const text = value || "";
  element.textContent = text;
  element.classList.toggle("hidden", !text);
}

export function createView(options) {
  const {
    els,
    getState,
    onDeleteAccount,
    onDeleteDraftFile,
    onDeleteKey,
    onToggleKeyToolCalls,
    onSelectSession
  } = options;
  const currentState = () => getState();

  function renderHeader() {
    const state = currentState();
    const incognito = state.session?.incognito;

    setPageTitle(resolvePageTitle(state));
    setText(els["role-label"], "单人");
    setText(els["user-summary"], getUserSummary(state));
    setText(els["incognito-summary"], incognito ? getIncognitoSummary(incognito) : "");
  }

  function renderSessions() {
    const state = currentState();
    renderSessionList({
      container: els.sessions,
      onSelect: onSelectSession,
      selectedSessionId: state.selectedSessionId,
      sessions: state.sessions
    });
  }

  function renderMessages() {
    renderMessageList({ container: els.messages, messages: currentState().messages });
  }

  function renderLatestMessage(delta) {
    const state = currentState();
    patchLastMessageDelta({
      container: els.messages,
      delta,
      messages: state.messages
    });
  }

  function replaceLatestMessage() {
    const state = currentState();
    replaceLastMessage({
      container: els.messages,
      message: state.messages.at(-1),
      messages: state.messages
    });
  }

  function renderComposer() {
    const state = currentState();
    renderDraftFileList({
      container: els["draft-files"],
      files: state.draftFiles,
      onDelete: onDeleteDraftFile
    });
    els["attach-files"].disabled = state.isSending;
    els["send-button"].disabled = state.isSending;
  }

  function renderSettings() {
    const state = currentState();
    const incognito = state.session.incognito;

    renderAccountListView({
      accounts: state.accounts,
      container: els["account-list"],
      isAdmin: false,
      onDeleteAccount,
      selectedAccountId: state.selectedAccountId
    });
    setText(els["incognito-label"], "仅自己开启");
    setText(els["incognito-description"], describeIncognito(incognito));
    els["incognito-toggle"].checked = Boolean(incognito.scopeEnabled);
  }

  function renderAdmin() {
    toggleAdminTab(els, false);
  }

  function renderMetrics() {
    const state = currentState();

    updateDashboardMetrics({
      apiKeyCountElement: els["api-key-count"],
      counts: {
        apiKeys: state.apiKeys.length,
        endpoints: state.discoveredPaths.length,
        messages: state.messages.length,
        sessions: state.sessions.length
      },
      endpointCountElement: els["endpoint-count"],
      messageCountElement: els["message-count"],
      sessionCaptionElement: els["session-caption"],
      sessionCountElement: els["session-count"],
      sessionMetricElement: els["metric-session-count"]
    });
  }

  function renderShell() {
    const state = currentState();
    if (!state.session) {
      return;
    }

    renderHeader();
    renderAccountOptions({
      accounts: state.accounts,
      select: els["account-select"],
      selectedAccountId: state.selectedAccountId
    });
    renderSessions();
    renderMessages();
    renderComposer();
    renderSettings();
    renderAdmin();
    renderApiKeyList({
      container: els["api-keys"],
      keys: state.apiKeys,
      onDelete: onDeleteKey,
      onToggleToolCalls: onToggleKeyToolCalls
    });
    setSelectOptions({ select: els["explorer-path"], values: state.discoveredPaths });
    renderMetrics();
  }

  return Object.freeze({
    applyRegistration() {},
    renderComposer,
    renderHeader,
    renderLatestMessage,
    renderMetrics,
    renderMessages,
    replaceLatestMessage,
    renderSessions,
    renderShell,
    setView(authenticated) {
      els["login-view"]?.classList.toggle("hidden", authenticated);
      els["app-view"]?.classList.toggle("hidden", !authenticated);
    }
  });
}
