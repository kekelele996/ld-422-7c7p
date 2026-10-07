<template>
  <section class="usages-page">
    <div class="page-header">
      <h2>试剂领用记录</h2>
      <el-select :model-value="demoUser.current.id" style="width: 180px" @update:model-value="switchUser">
        <el-option v-for="user in DEMO_USERS" :key="user.id" :label="`当前身份：${user.name}`" :value="user.id" />
      </el-select>
    </div>

    <el-alert type="info" :closable="false" show-icon>
      <template #title>
        数量口径：<b>登记量</b>为领用登记时的原始数量，永久保留不修改；领用人补录的<b>实领量</b>为当前生效值。
        试剂库存、总览低库存提醒、本单数量一律按<b>当前生效量</b>计算（未补实领量时按登记量，补过按实领量）；
        撤回时按当前生效量把库存加回，保证与试剂列表一致。
      </template>
    </el-alert>

    <div class="toolbar">
      <el-select v-model="filterStatus" placeholder="单据状态" clearable style="width: 140px" @change="load">
        <el-option label="生效中" value="Active" />
        <el-option label="已撤回" value="Withdrawn" />
      </el-select>
      <el-select v-model="filterUser" placeholder="领用人" clearable style="width: 160px" @change="load">
        <el-option v-for="user in DEMO_USERS" :key="user.id" :label="user.name" :value="user.id" />
      </el-select>
      <el-select v-model="filterReagent" placeholder="试剂" clearable style="width: 180px" @change="load">
        <el-option v-for="reagent in reagents" :key="reagent.id" :label="reagent.name" :value="reagent.id" />
      </el-select>
      <el-button type="primary" @click="openCreate">领用登记</el-button>
    </div>

    <el-table :data="filteredUsages" border stripe v-loading="loading">
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'Withdrawn' ? 'info' : 'success'">
            {{ REAGENT_USAGE_STATUS_LABEL[row.status as ReagentUsageStatus] }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="试剂" min-width="120">
        <template #default="{ row }">{{ reagentName(row.reagentId) }}</template>
      </el-table-column>
      <el-table-column label="领用人" width="100">
        <template #default="{ row }">{{ userName(row.userId) }}</template>
      </el-table-column>
      <el-table-column prop="usedAt" label="领用日期" width="110" />
      <el-table-column label="登记量" width="110" align="center">
        <template #default="{ row }">{{ row.quantity }} {{ reagentUnit(row.reagentId) }}</template>
      </el-table-column>
      <el-table-column label="实领量（生效）" width="130" align="center">
        <template #default="{ row }">
          <span :class="{ 'effective-num': row.actualQuantity != null }">
            {{ row.status === 'Withdrawn' ? '—' : effectiveQuantity(row) }}
            {{ reagentUnit(row.reagentId) }}
          </span>
          <div v-if="row.status === 'Active' && row.actualQuantity == null" class="cell-hint">未补录，按登记量</div>
        </template>
      </el-table-column>
      <el-table-column prop="purpose" label="用途" min-width="120" />
      <el-table-column label="操作" width="190" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'Active'">
            <el-button
              link
              type="primary"
              :disabled="row.userId !== demoUser.current.id"
              @click="openActual(row)"
            >补实领量</el-button>
            <el-popconfirm
              title="撤回后按当前生效量把库存加回，确定撤回？"
              confirm-button-text="撤回"
              cancel-button-text="取消"
              :disabled="row.userId !== demoUser.current.id"
              @confirm="handleWithdraw(row.id)"
            >
              <template #reference>
                <el-button link type="danger" :disabled="row.userId !== demoUser.current.id">撤回</el-button>
              </template>
            </el-popconfirm>
            <el-tooltip v-if="row.userId !== demoUser.current.id" content="只能操作自己的领用单" placement="top">
              <span class="disabled-tip" />
            </el-tooltip>
          </template>
          <span v-else class="cell-hint">已按生效量回库</span>
        </template>
      </el-table-column>
      <template #empty>
        <EmptyState description="暂无领用记录" />
      </template>
    </el-table>

    <el-dialog v-model="createVisible" title="领用登记" width="420px">
      <el-form label-width="90px">
        <el-form-item label="试剂" required>
          <el-select v-model="createForm.reagentId" placeholder="选择试剂" style="width: 100%">
            <el-option
              v-for="reagent in reagents"
              :key="reagent.id"
              :label="`${reagent.name}（库存 ${reagent.stock} ${reagent.unit}）`"
              :value="reagent.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="领用数量" required>
          <el-input-number v-model="createForm.quantity" :min="0.1" :step="0.1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="实验记录" required>
          <el-select v-model="createForm.experimentId" placeholder="关联实验" style="width: 100%">
            <el-option v-for="exp in experiments" :key="exp.id" :label="exp.title" :value="exp.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="用途">
          <el-input v-model="createForm.purpose" placeholder="实验消耗" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleCreate">登记并扣库存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="actualVisible" title="补录实领量" width="420px">
      <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 12px">
        <template #title>登记量 {{ targetUsage?.quantity }} {{ targetUnit }} 原样保留，库存与本单数量改按实领量计算；实领量不能超过登记量。</template>
      </el-alert>
      <el-form label-width="90px">
        <el-form-item label="实领量" required>
          <el-input-number v-model="actualValue" :min="0.1" :max="targetUsage?.quantity" :step="0.1" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="actualVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleFillActual">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import EmptyState from "../components/common/EmptyState.vue";
import { reagentUsageApi } from "../api/reagentUsage";
import { reagentApi } from "../api/reagent";
import { experimentApi } from "../api/experiment";
import type { Reagent, ReagentUsage } from "../types/reagent";
import { effectiveQuantity, REAGENT_USAGE_STATUS_LABEL } from "../types/reagent";
import type { ExperimentRecord } from "../types/experiment";
import type { ReagentUsageStatus } from "../types";
import { DEMO_USERS, demoUser, setDemoUser } from "../utils/demoUser";

const loading = ref(false);
const saving = ref(false);
const usages = ref<ReagentUsage[]>([]);
const reagents = ref<Reagent[]>([]);
const experiments = ref<ExperimentRecord[]>([]);

const filterStatus = ref("");
const filterUser = ref("");
const filterReagent = ref("");

const createVisible = ref(false);
const actualVisible = ref(false);
const createForm = reactive({ reagentId: "", quantity: 1, experimentId: "", purpose: "" });
const targetUsage = ref<ReagentUsage | null>(null);
const actualValue = ref(0);

const filteredUsages = computed(() =>
  usages.value.filter((item) => (!filterReagent.value || item.reagentId === filterReagent.value))
);
const targetUnit = computed(() => reagents.value.find((item) => item.id === targetUsage.value?.reagentId)?.unit ?? "");

function reagentName(id: string) {
  return reagents.value.find((item) => item.id === id)?.name ?? id;
}
function reagentUnit(id: string) {
  return reagents.value.find((item) => item.id === id)?.unit ?? "";
}
function userName(id: string) {
  return DEMO_USERS.find((user) => user.id === id)?.name ?? id;
}

async function load() {
  loading.value = true;
  try {
    const [usageList, reagentList, experimentList] = await Promise.all([
      reagentUsageApi.list("", filterUser.value, filterStatus.value),
      reagentApi.list(),
      experimentApi.list()
    ]);
    usages.value = usageList;
    reagents.value = reagentList;
    experiments.value = experimentList;
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    loading.value = false;
  }
}

function switchUser(userId: string) {
  setDemoUser(userId);
  load();
}

function openCreate() {
  Object.assign(createForm, { reagentId: "", quantity: 1, experimentId: "", purpose: "" });
  createVisible.value = true;
}

async function handleCreate() {
  try {
    saving.value = true;
    await reagentUsageApi.create({ ...createForm, userId: demoUser.current.id });
    ElMessage.success("登记成功，库存已按登记量扣减");
    createVisible.value = false;
    await load();
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    saving.value = false;
  }
}

function openActual(usage: ReagentUsage) {
  targetUsage.value = usage;
  actualValue.value = usage.actualQuantity ?? usage.quantity;
  actualVisible.value = true;
}

async function handleFillActual() {
  if (!targetUsage.value) return;
  try {
    saving.value = true;
    await reagentUsageApi.fillActual(targetUsage.value.id, actualValue.value);
    ElMessage.success("实领量已生效，库存差额已调整");
    actualVisible.value = false;
    await load();
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    saving.value = false;
  }
}

async function handleWithdraw(id: string) {
  try {
    await reagentUsageApi.withdraw(id);
    ElMessage.success("已撤回，库存按当前生效量加回");
    await load();
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}

onMounted(load);
</script>

<style scoped>
.usages-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.toolbar {
  display: flex;
  gap: 8px;
}
.cell-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.effective-num {
  font-weight: 600;
  color: var(--el-color-primary);
}
.disabled-tip {
  display: inline-block;
  width: 0;
}
</style>
