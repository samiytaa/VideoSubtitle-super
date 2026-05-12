import { resolveAccountDetail, resolveAccountLabel } from "./account-display.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function createEmptyState(title, description) {
  return `
    <article class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(description)}</span>
    </article>
  `;
}

function formatOwner(ownerId) {
  return ownerId === "admin" ? "管理员" : ownerId;
}

function renderAccountMeta(account, isAdmin) {
  const detail = resolveAccountDetail(account);
  const owner = isAdmin ? formatOwner(account.ownerId) : "";
  return [detail, owner].filter(Boolean).join(" | ");
}

function renderStatusText(accountId, selectedAccountId) {
  return accountId === selectedAccountId ? "当前" : "可用";
}

function renderDeleteButton(accountId) {
  return `
    <button
      type="button"
      class="button-ghost button-danger"
      data-account-delete-id="${escapeHtml(accountId)}"
      data-ripple
    >
      删除
    </button>
  `;
}

function renderAccountItem(account, options) {
  const { isAdmin, selectedAccountId } = options;
  const meta = renderAccountMeta(account, isAdmin);
  const selectedClass = account.id === selectedAccountId ? " active" : "";

  return `
    <article class="account-item${selectedClass}">
      <div class="account-info">
        <strong>${escapeHtml(resolveAccountLabel(account))}</strong>
        <span class="account-meta">${escapeHtml(meta)}</span>
      </div>
      <div class="inline-actions account-actions">
        <span class="chip">${escapeHtml(renderStatusText(account.id, selectedAccountId))}</span>
        ${renderDeleteButton(account.id)}
      </div>
    </article>
  `;
}

function resolveAccount(accounts, accountId) {
  const account = accounts.find((entry) => entry.id === accountId);
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  return account;
}

function bindDeleteActions(container, accounts, onDeleteAccount) {
  container.querySelectorAll("[data-account-delete-id]").forEach((button) => {
    button.onclick = async () => {
      const accountId = button.dataset.accountDeleteId;
      const account = resolveAccount(accounts, accountId);
      const label = resolveAccountLabel(account) || account.id;
      if (!window.confirm(`确认删除绑定账号 "${label}" 吗？`)) {
        return;
      }

      await onDeleteAccount(account.id);
    };
  });
}

export function renderAccountListView(options) {
  const {
    accounts,
    container,
    isAdmin,
    onDeleteAccount,
    selectedAccountId
  } = options;

  container.innerHTML = accounts.length
    ? accounts
      .map((account) => renderAccountItem(account, { isAdmin, selectedAccountId }))
      .join("")
    : createEmptyState("暂无账号", "先绑定一个账号。");

  bindDeleteActions(container, accounts, onDeleteAccount);
}
