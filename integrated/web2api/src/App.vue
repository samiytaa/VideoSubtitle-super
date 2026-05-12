<script setup>
import { computed, onMounted, reactive } from "vue";

const state = reactive({
  baimiao: {
    accounts: [],
    apiKeys: [],
    selectedAccountId: ""
  },
  status: "",
  error: "",
  loading: false,
  form: {
    username: "",
    password: "",
    keyLabel: "",
    keyPlain: ""
  },
  debug: {
    accountId: "",
    imagePreview: "",
    imageBase64: "",
    result: "",
    status: "",
    loading: false
  }
});

const selectedAccount = computed(() =>
  state.baimiao.accounts.find((a) => a.id === state.baimiao.selectedAccountId) ?? null
);

const accountOptions = computed(() =>
  state.baimiao.accounts.map((account) => ({ label: account.username, value: account.id }))
);

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

async function postJson(url, body) {
  return requestJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function loadConfig() {
  state.loading = true;
  state.error = "";
  try {
    const payload = await requestJson("/api/baimiao/config");
    state.baimiao = payload.baimiao ?? state.baimiao;
    state.form.username = payload.baimiao?.selectedAccount?.username ?? "";
    state.form.password = payload.baimiao?.selectedAccount?.password ?? "";
    state.status = "白描配置已加载";
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
  }
}

async function saveAccount() {
  state.error = "";
  const payload = await postJson("/api/baimiao/accounts", {
    username: state.form.username.trim(),
    password: state.form.password
  });
  state.baimiao = payload.baimiao ?? state.baimiao;
  state.status = "账号已保存";
}

async function selectAccount(accountId) {
  state.error = "";
  const payload = await postJson("/api/baimiao/select", { accountId });
  state.baimiao = payload.baimiao ?? state.baimiao;
  state.form.username = payload.baimiao?.selectedAccount?.username ?? "";
  state.form.password = payload.baimiao?.selectedAccount?.password ?? "";
  state.status = "已切换账号";
}

async function deleteAccount(accountId) {
  state.error = "";
  await requestJson(`/api/baimiao/accounts/${accountId}`, { method: "DELETE" });
  await loadConfig();
  state.status = "账号已删除";
}

async function createApiKey() {
  state.error = "";
  const payload = await postJson("/api/baimiao/api-keys", {
    label: state.form.keyLabel.trim(),
    plainKey: state.form.keyPlain.trim()
  });
  const apiKeys = (payload.baimiao?.apiKeys ?? []).map((key) =>
    key.id === payload.record?.id ? { ...key, key: payload.key } : key
  );
  state.baimiao = { ...(payload.baimiao ?? state.baimiao), apiKeys };
  state.form.keyLabel = "";
  state.form.keyPlain = "";
  state.status = `新 Key: ${payload.key}`;
}

async function deleteApiKey(keyId) {
  state.error = "";
  await requestJson(`/api/baimiao/api-keys/${keyId}`, { method: "DELETE" });
  await loadConfig();
  state.status = "Key 已删除";
}

function onImageChange(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = String(e.target?.result ?? "");
    state.debug.imagePreview = dataUrl;
    const marker = "base64,";
    state.debug.imageBase64 = dataUrl.includes(marker) ? dataUrl.split(marker)[1] : dataUrl;
  };
  reader.readAsDataURL(file);
}

async function runDebugOcr() {
  state.debug.loading = true;
  state.debug.status = "";
  state.debug.result = "";
  state.error = "";
  try {
    const payload = await postJson("/api/baimiao/debug-ocr", {
      accountId: state.debug.accountId || undefined,
      image_base64: state.debug.imageBase64
    });
    state.debug.result = payload.text || "";
    state.debug.status = `识别成功（${payload.source}）`;
  } catch (error) {
    state.error = error.message;
  } finally {
    state.debug.loading = false;
  }
}

async function copyText(text) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
  state.status = "已复制识别结果";
}

onMounted(loadConfig);
</script>

<template>
  <main class="page">
    <header class="header">
      <h1>白描 OCR 控制台</h1>
      <p>仅保留白描 OCR 能力：账号、Key 与识别调试。</p>
    </header>

    <p v-if="state.status" class="status ok">{{ state.status }}</p>
    <p v-if="state.error" class="status err">{{ state.error }}</p>

    <section class="grid">
      <article class="card">
        <h2>账号配置</h2>
        <form @submit.prevent="saveAccount">
          <label>账号</label>
          <input v-model="state.form.username" placeholder="白描账号" />
          <label>密码</label>
          <input v-model="state.form.password" type="password" placeholder="白描密码" />
          <button type="submit" :disabled="state.loading">保存账号</button>
        </form>

        <div class="list">
          <div v-for="account in state.baimiao.accounts" :key="account.id" class="row">
            <span>{{ account.username }}</span>
            <div class="actions">
              <button v-if="account.id !== state.baimiao.selectedAccountId" @click="selectAccount(account.id)">设为当前</button>
              <button class="danger" @click="deleteAccount(account.id)">删除</button>
            </div>
          </div>
        </div>
      </article>

      <article class="card">
        <h2>API Key</h2>
        <form @submit.prevent="createApiKey">
          <label>标签</label>
          <input v-model="state.form.keyLabel" placeholder="可选" />
          <label>明文 Key</label>
          <input v-model="state.form.keyPlain" placeholder="留空自动生成" />
          <button type="submit" :disabled="!state.baimiao.accounts.length">创建 Key</button>
        </form>

        <div class="list">
          <div v-for="key in state.baimiao.apiKeys" :key="key.id" class="row">
            <span>{{ key.label }} - {{ key.key || key.preview }}</span>
            <button class="danger" @click="deleteApiKey(key.id)">删除</button>
          </div>
        </div>
      </article>
    </section>

    <section class="card debug-card">
      <h2>OCR 调试</h2>
      <label>指定账号（可选）</label>
      <select v-model="state.debug.accountId">
        <option value="">默认当前账号</option>
        <option v-for="option in accountOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>

      <label>上传图片</label>
      <input type="file" accept="image/*" @change="onImageChange" />
      <img v-if="state.debug.imagePreview" :src="state.debug.imagePreview" alt="preview" class="preview" />

      <div class="actions">
        <button :disabled="!state.debug.imageBase64 || state.debug.loading" @click="runDebugOcr">
          {{ state.debug.loading ? "识别中..." : "开始识别" }}
        </button>
        <button :disabled="!state.debug.result" @click="copyText(state.debug.result)">复制结果</button>
      </div>

      <p v-if="state.debug.status" class="status ok">{{ state.debug.status }}</p>
      <pre class="result">{{ state.debug.result || "识别结果将在这里显示" }}</pre>
      <p v-if="selectedAccount" class="hint">当前账号：{{ selectedAccount.username }}</p>
    </section>
  </main>
</template>
