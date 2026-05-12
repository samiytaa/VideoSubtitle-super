function collectSelectedValues(container, selector) {
  return Array.from(container.querySelectorAll(`${selector}:checked`)).map((input) => input.value);
}

function parseLimitValue(form, fieldName) {
  const input = form.querySelector(`[data-limit-field="${fieldName}"]`);
  return input ? input.value.trim() : "";
}

function bindRegistrationAction({ els, onToggleInviteRequirement, setStatus }) {
  els["admin-registration-form"].onsubmit = async (event) => {
    event.preventDefault();
    setStatus(els["admin-registration-status"], "保存中...");

    try {
      await onToggleInviteRequirement(els["invite-required-toggle"].checked);
      setStatus(els["admin-registration-status"], "已保存。");
    } catch (error) {
      setStatus(els["admin-registration-status"], error.message);
    }
  };
}

function bindInviteCreation({ els, onCreateInvites, setStatus }) {
  els["admin-invite-form"].onsubmit = async (event) => {
    event.preventDefault();
    setStatus(els["admin-invite-status"], "生成中...");

    try {
      await onCreateInvites(els["admin-invite-count"].value);
      setStatus(els["admin-invite-status"], "已生成。");
    } catch (error) {
      setStatus(els["admin-invite-status"], error.message);
    }
  };
}

function bindInviteDeletion({ els, onBatchDeleteInvites, onDeleteInvite, setStatus }) {
  els["delete-selected-invites"].onclick = async () => {
    const inviteIds = collectSelectedValues(els["admin-invite-list"], "[data-invite-select]");
    setStatus(els["admin-invite-status"], inviteIds.length ? "删除中..." : "请先选择。");

    if (!inviteIds.length) {
      return;
    }

    try {
      await onBatchDeleteInvites(inviteIds);
      setStatus(els["admin-invite-status"], "已删除。");
    } catch (error) {
      setStatus(els["admin-invite-status"], error.message);
    }
  };

  els["admin-invite-list"].onclick = async (event) => {
    const button = event.target.closest("[data-invite-delete]");
    if (!button) {
      return;
    }

    setStatus(els["admin-invite-status"], "删除中...");
    try {
      await onDeleteInvite(button.dataset.inviteDelete);
      setStatus(els["admin-invite-status"], "已删除。");
    } catch (error) {
      setStatus(els["admin-invite-status"], error.message);
    }
  };
}

function bindUserBatchActions({ els, onBatchDeleteUsers, onBatchDisableUsers, setStatus }) {
  const runBatchDisable = async (disabled, pendingText, successText) => {
    const userIds = collectSelectedValues(els["admin-user-list"], "[data-user-select]");
    setStatus(els["admin-user-status"], userIds.length ? pendingText : "请先选择。");

    if (!userIds.length) {
      return;
    }

    try {
      await onBatchDisableUsers({ disabled, userIds });
      setStatus(els["admin-user-status"], successText);
    } catch (error) {
      setStatus(els["admin-user-status"], error.message);
    }
  };

  els["disable-selected-users"].onclick = () => runBatchDisable(true, "批量禁用中...", "已禁用。");
  els["enable-selected-users"].onclick = () => runBatchDisable(false, "批量启用中...", "已启用。");
  els["delete-selected-users"].onclick = async () => {
    const userIds = collectSelectedValues(els["admin-user-list"], "[data-user-select]");
    setStatus(els["admin-user-status"], userIds.length ? "批量删除中..." : "请先选择。");

    if (!userIds.length) {
      return;
    }

    try {
      await onBatchDeleteUsers(userIds);
      setStatus(els["admin-user-status"], "已删除。");
    } catch (error) {
      setStatus(els["admin-user-status"], error.message);
    }
  };
}

function bindUserRowActions({ els, onDeleteUser, onUpdateUser, setStatus }) {
  els["admin-user-list"].addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-user-form]");
    if (!form) {
      return;
    }

    event.preventDefault();
    setStatus(els["admin-user-status"], "保存中...");

    try {
      await onUpdateUser(form.dataset.userForm, {
        requestLimits: {
          maxConcurrency: parseLimitValue(form, "maxConcurrency"),
          maxRequestsPerMinute: parseLimitValue(form, "maxRequestsPerMinute")
        }
      });
      setStatus(els["admin-user-status"], "已保存。");
    } catch (error) {
      setStatus(els["admin-user-status"], error.message);
    }
  });

  els["admin-user-list"].onclick = async (event) => {
    const deleteButton = event.target.closest("[data-user-delete]");
    const toggleButton = event.target.closest("[data-user-toggle-disable]");

    if (deleteButton) {
      setStatus(els["admin-user-status"], "删除中...");
      try {
        await onDeleteUser(deleteButton.dataset.userDelete);
        setStatus(els["admin-user-status"], "已删除。");
      } catch (error) {
        setStatus(els["admin-user-status"], error.message);
      }
      return;
    }

    if (!toggleButton) {
      return;
    }

    const disabled = toggleButton.dataset.disabled === "false";
    setStatus(els["admin-user-status"], disabled ? "禁用中..." : "启用中...");

    try {
      await onUpdateUser(toggleButton.dataset.userToggleDisable, { disabled });
      setStatus(els["admin-user-status"], disabled ? "已禁用。" : "已启用。");
    } catch (error) {
      setStatus(els["admin-user-status"], error.message);
    }
  };
}

export function bindAdminActions(options) {
  bindRegistrationAction(options);
  bindInviteCreation(options);
  bindInviteDeletion(options);
  bindUserBatchActions(options);
  bindUserRowActions(options);
}
