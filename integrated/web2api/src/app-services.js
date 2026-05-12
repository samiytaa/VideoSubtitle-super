import { requestJson, proxyJson } from "./api.js";
import { getDeviceId } from "./device.js";

async function postJson(url, body) {
  return requestJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function patchJson(url, body) {
  return requestJson(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

export function createAppServices(options) {
  const {
    bootstrap,
    clearComposerInput,
    els,
    getSelectedAccountId,
    loadSessions,
    setAppState,
    setStatus,
    view
  } = options;

  async function handleApiKeyDelete(keyId) {
    setStatus(els["api-key-output"], "");

    try {
      const response = await fetch(`/api/api-keys/${keyId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`删除失败: HTTP ${response.status}`);
      }
      await bootstrap();
    } catch (error) {
      setStatus(els["api-key-output"], error.message);
    }
  }

  async function changeAccount(accountId) {
    clearComposerInput();
    setAppState({
      currentMessageId: null,
      messages: [],
      selectedAccountId: accountId,
      selectedSessionId: ""
    });
    view.renderShell();
    await loadSessions();
  }

  async function addAccount({ password, username }) {
    const deviceId = await getDeviceId();
    const payload = await postJson("/api/accounts", {
      username,
      password,
      deviceId
    });

    els["account-password"].value = "";
    setAppState({ selectedAccountId: payload.account.id });
    await bootstrap();
  }

  async function deleteAccount(accountId) {
    setStatus(els["account-status"], "删除中...");

    try {
      await requestJson(`/api/accounts/${accountId}`, { method: "DELETE" });
      await bootstrap();
      setStatus(els["account-status"], "已删除绑定账号。");
    } catch (error) {
      setStatus(els["account-status"], error.message);
    }
  }

  async function toggleIncognito(enabled) {
    await postJson("/api/incognito", { enabled });
    await bootstrap();
  }

  async function submitApiKey({ label, plainKey, toolCallsEnabled }) {
    const payload = await postJson("/api/api-keys", {
      accountId: getSelectedAccountId(),
      label,
      plainKey,
      toolCallsEnabled
    });

    setStatus(els["api-key-output"], `新 Key：\n${payload.key}`);
    els["api-key-label"].value = "";
    els["api-key-plain"].value = "";
    els["api-key-tool-calls"].checked = false;
    await bootstrap();
  }

  async function updateApiKey(keyId, toolCallsEnabled) {
    await patchJson(`/api/api-keys/${keyId}`, { toolCallsEnabled });
    await bootstrap();
  }

  async function submitExplorer({ bodyText, method, path, queryText }) {
    let payload;
    let isError = false;
    try {
      payload = await proxyJson(path, {
        accountId: getSelectedAccountId(),
        method,
        query: queryText ? JSON.parse(queryText) : {},
        body: bodyText ? JSON.parse(bodyText) : undefined
      });
    } catch (error) {
      isError = true;
      try {
        payload = JSON.parse(error.message);
      } catch {
        payload = { error: error.message };
      }
    }
    renderExplorerResponse(els, payload, isError);
  }

  function renderExplorerResponse(els, payload, isError) {
    const wrap = document.getElementById("explorer-response-wrap");
    const badge = document.getElementById("explorer-status-badge");
    const legacyOutput = els["explorer-output"];

    if (!wrap || !badge) {
      setStatus(legacyOutput, JSON.stringify(payload, null, 2));
      return;
    }

    badge.classList.remove("hidden", "status-ok", "status-err");
    if (isError) {
      badge.classList.add("status-err");
      badge.textContent = "ERROR";
    } else {
      badge.classList.add("status-ok");
      badge.textContent = "200 OK";
    }

    const jsonText = JSON.stringify(payload, null, 2);
    const highlighted = syntaxHighlightJson(jsonText);

    wrap.innerHTML = `
      <button type="button" class="explorer-copy-btn" id="explorer-copy-btn" data-ripple>复制</button>
      <pre class="explorer-json-output">${highlighted}</pre>
    `;

    const copyBtn = document.getElementById("explorer-copy-btn");
    if (copyBtn) {
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(jsonText);
          copyBtn.textContent = "已复制";
          setTimeout(() => { copyBtn.textContent = "复制"; }, 1500);
        } catch {
          copyBtn.textContent = "失败";
          setTimeout(() => { copyBtn.textContent = "复制"; }, 1500);
        }
      };
    }

    legacyOutput.classList.add("hidden");
  }

  function syntaxHighlightJson(json) {
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            return `<span class="json-key">${escapeHtml(match)}</span>`;
          }
          return `<span class="json-string">${escapeHtml(match)}</span>`;
        }
        if (/true|false/.test(match)) {
          return `<span class="json-bool">${match}</span>`;
        }
        if (/null/.test(match)) {
          return `<span class="json-null">${match}</span>`;
        }
        return `<span class="json-number">${match}</span>`;
      }
    );
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  return Object.freeze({
    addAccount,
    changeAccount,
    deleteAccount,
    handleApiKeyDelete,
    submitApiKey,
    submitExplorer,
    updateApiKey,
    toggleIncognito
  });
}
