<template>
  <section class="dashboard-page">
    <h2>项目总览</h2>

    <el-row :gutter="12">
      <el-col :span="6">
        <el-card shadow="never">
          <div class="stat-label">在研项目</div>
          <div class="stat-value">{{ summary?.activeProjects.length ?? 0 }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never">
          <div class="stat-label">近7天实验记录</div>
          <div class="stat-value">{{ summary?.recentExperimentCount ?? 0 }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never">
          <div class="stat-label">待审核记录</div>
          <div class="stat-value">{{ summary?.pendingReviews ?? 0 }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never">
          <div class="stat-label">低库存试剂</div>
          <div class="stat-value" :class="{ 'stat-danger': (summary?.lowStockReagents.length ?? 0) > 0 }">
            {{ summary?.lowStockReagents.length ?? 0 }}
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never">
      <template #header>在研项目</template>
      <div v-for="project in summary?.activeProjects" :key="project.id" class="project-item">
        <span>{{ project.name }}</span>
        <StatusBadge :value="project.status" />
      </div>
      <EmptyState v-if="!summary?.activeProjects.length" description="暂无在研项目" />
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="alert-header">
          <span>试剂库存预警</span>
          <el-button link type="primary" @click="load">刷新</el-button>
        </div>
      </template>
      <el-alert
        type="info"
        :closable="false"
        title="低库存判断按当前库存计算，即已扣除生效中领用单的当前生效量（实领量优先，未补按登记量），已撤回单据不扣库存。"
        style="margin-bottom: 8px"
      />
      <div v-if="summary?.lowStockReagents.length" class="alerts">
        <StockAlert
          v-for="reagent in summary.lowStockReagents"
          :key="reagent.id"
          :name="`${reagent.name}（当前 ${reagent.stock} ${reagent.unit} / 阈值 ${reagent.minStock} ${reagent.unit}）`"
          :stock="reagent.stock"
          :min-stock="reagent.minStock"
        />
      </div>
      <EmptyState v-else description="暂无低库存试剂" />
    </el-card>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import StatusBadge from "../components/common/StatusBadge.vue";
import StockAlert from "../components/common/StockAlert.vue";
import EmptyState from "../components/common/EmptyState.vue";
import { dashboardApi, type DashboardSummary } from "../api/dashboard";

const summary = ref<DashboardSummary | null>(null);

async function load() {
  try {
    summary.value = await dashboardApi.summary();
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}

onMounted(load);
</script>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.stat-label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
}
.stat-danger {
  color: var(--el-color-danger);
}
.project-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
}
.alert-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.alerts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
