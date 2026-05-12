<template>
  <section class="credentials-tab-body doubao-page">

    <!-- ── 工作台面板 ── -->
    <section class="chat-workbench" aria-label="豆包工作台">
      <div class="chat-workbench-inner">
        <div class="chat-workbench-brand">
          <div class="workbench-kicker">Doubao</div>
          <div class="workbench-title">豆包管理</div>
        </div>

        <div class="workbench-stat-strip">
          <div class="workbench-stat">
            <span class="workbench-stat-label">账号</span>
            <span class="workbench-stat-num">{{ status?.account_pool?.total ?? 0 }}</span>
          </div>
          <div class="workbench-stat">
            <span class="workbench-stat-label">健康</span>
            <span class="workbench-stat-num doubao-num-green">{{ status?.account_pool?.valid ?? 0 }}</span>
          </div>
          <div class="workbench-stat">
            <span class="workbench-stat-label">处理中</span>
            <span class="workbench-stat-num">{{ status?.account_pool?.in_use ?? 0 }}</span>
          </div>
          <div class="workbench-stat">
            <span class="workbench-stat-label">浏览器</span>
            <n-tag round size="small" :type="status?.browser_engine?.started ? 'success' : 'warning'" style="line-height:1">
              {{ status?.browser_engine?.started ? '已启动' : '未启动' }}
            </n-tag>
          </div>
        </div>

        <div class="workbench-trailing">
          <div class="chat-workbench-divider" aria-hidden="true" />
          <!-- 并发控制内联 -->
          <div class="doubao-inflight-control">
            <span class="workbench-stat-label">并发上限</span>
            <div class="doubao-stepper">
              <button class="doubao-stepper-btn" :disabled="maxInflight <= 1" @click="maxInflight = Math.max(1, maxInflight - 1)">−</button>
              <span class="doubao-stepper-val">{{ maxInflight }}</span>
              <button class="doubao-stepper-btn" :disabled="maxInflight >= 16" @click="maxInflight = Math.min(16, maxInflight + 1)">+</button>
            </div>
            <n-button type="primary" size="small" @click="updateMaxInflight">更新</n-button>
          </div>
          <div class="chat-workbench-divider" aria-hidden="true" />
          <div class="workbench-actions">
            <n-button secondary size="small" @click="refresh">
              <template #icon><n-icon :component="RefreshCw" /></template>
              刷新
            </n-button>
          </div>
        </div>
      </div>
    </section>

    <!-- ── 主体两栏 ── -->
    <div class="content-grid two-col">

      <!-- 新增账号 -->
      <n-card title="新增账号" :bordered="false">
        <n-form @submit.prevent="addAccount">
          <n-form-item label="账号名称">
            <n-input v-model:value="accountName" placeholder="输入账号名称" />
          </n-form-item>
          <n-form-item label="Session ID">
            <n-input
              v-model:value="accountSessionId"
              type="password"
              show-password-on="click"
              placeholder="输入豆包 sessionid"
            />
          </n-form-item>
          <n-button type="primary" attr-type="submit">添加账号</n-button>
        </n-form>
        <div v-if="addStatus" class="status-inline">{{ addStatus }}</div>
      </n-card>

      <!-- 账号列表 -->
      <n-card :bordered="false">
        <template #header>
          <div class="doubao-card-header">
            <span>账号列表</span>
            <n-button text size="small" @click="loadAccounts">
              <template #icon><n-icon :component="RefreshCw" /></template>
            </n-button>
          </div>
        </template>
        <div class="account-stack">
          <div v-for="row in accounts" :key="row.account_id" class="account-row">
            <n-thing>
              <template #header>{{ row.name || row.account_id }}</template>
              <template #description>
                <n-space size="small">
                  <n-tag round size="small" :type="row.status_text === 'healthy' ? 'success' : 'warning'">
                    {{ row.status_text === 'healthy' ? '正常' : (row.status_text || '未知') }}
                  </n-tag>
                  <span v-if="row.inflight > 0" class="doubao-meta-hint">并发中: {{ row.inflight }}</span>
                  <span v-if="row.consecutive_failures > 0" class="doubao-error-hint">
                    连续失败: {{ row.consecutive_failures }}
                  </span>
                </n-space>
              </template>
            </n-thing>
            <n-popconfirm @positive-click="deleteAccount(row.account_id)">
              <template #trigger>
                <n-button tertiary type="error" size="small">删除</n-button>
              </template>
              确认删除这个账号？
            </n-popconfirm>
          </div>
          <n-empty v-if="!accounts.length" description="暂无豆包账号" />
        </div>
      </n-card>

    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue";
import {
  NButton,
  NCard,
  NEmpty,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NPopconfirm,
  NSpace,
  NTag,
  NThing,
  createDiscreteApi,
  dateZhCN,
  lightTheme,
  zhCN
} from "naive-ui";
import { RefreshCw } from "lucide-vue-next";

const { message } = createDiscreteApi(["message"], {
  configProviderProps: { locale: zhCN, dateLocale: dateZhCN, theme: lightTheme }
});

const status = ref(null);
const accounts = ref([]);
const maxInflight = ref(1);
const accountName = ref("");
const accountSessionId = ref("");
const addStatus = ref("");

async function loadStatus() {
  try {
    const res = await fetch("/doubao/api/admin/status", {
      headers: { Authorization: "Bearer admin" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    status.value = data;
    maxInflight.value = data.config?.max_inflight || 1;
  } catch (e) {
    message.error(`加载状态失败: ${e.message}`);
  }
}

async function loadAccounts() {
  try {
    const res = await fetch("/doubao/api/admin/accounts", {
      headers: { Authorization: "Bearer admin" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    accounts.value = data.accounts || [];
  } catch (e) {
    message.error(`加载账号失败: ${e.message}`);
  }
}

async function refresh() {
  await Promise.all([loadStatus(), loadAccounts()]);
}

async function addAccount() {
  try {
    const res = await fetch("/doubao/api/admin/accounts/add", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer admin" },
      body: JSON.stringify({
        name: accountName.value.trim(),
        sessionid: accountSessionId.value.trim()
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    accountName.value = "";
    accountSessionId.value = "";
    addStatus.value = "账号添加成功";
    message.success("账号添加成功");
    await loadAccounts();
  } catch (e) {
    addStatus.value = e.message;
    message.error(`添加账号失败: ${e.message}`);
  }
}

async function deleteAccount(accountId) {
  try {
    const res = await fetch("/doubao/api/admin/accounts/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer admin" },
      body: JSON.stringify({ sessionid: accountId })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    message.success("豆包账号已删除");
    await loadAccounts();
  } catch (e) {
    message.error(`删除账号失败: ${e.message}`);
  }
}

async function updateMaxInflight() {
  try {
    const res = await fetch("/doubao/api/admin/max_inflight", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer admin" },
      body: JSON.stringify({ value: maxInflight.value })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    message.success("并发上限已更新");
    await loadStatus();
  } catch (e) {
    message.error(`更新失败: ${e.message}`);
  }
}

onMounted(refresh);
</script>

<style scoped>
.doubao-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.doubao-num-green {
  color: #18a058;
}

/* 并发控制内联在 trailing 区域 */
.doubao-inflight-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 步进器 */
.doubao-stepper {
  display: inline-flex;
  align-items: center;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

.doubao-stepper-btn {
  all: unset;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 100%;
  font-size: 15px;
  line-height: 1;
  color: #64748b;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  user-select: none;
}

.doubao-stepper-btn:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.08);
  color: #4f46e5;
}

.doubao-stepper-btn:disabled {
  color: #cbd5e1;
  cursor: not-allowed;
}

.doubao-stepper-val {
  min-width: 28px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
  border-left: 1px solid rgba(226, 232, 240, 0.8);
  border-right: 1px solid rgba(226, 232, 240, 0.8);
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

/* 账号列表卡片标题行 */
.doubao-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

/* 账号行次要信息 */
.doubao-meta-hint {
  font-size: 0.78rem;
  color: #64748b;
}

.doubao-error-hint {
  color: #d03050;
  font-size: 0.78rem;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
