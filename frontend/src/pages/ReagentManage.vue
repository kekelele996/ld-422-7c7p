<template>
  <section class="reagents-page">
    <div class="page-header">
      <h2>试剂库存管理</h2>
      <el-button @click="load">刷新库存</el-button>
    </div>

    <el-alert type="info" :closable="false" show-icon>
      <template #title>
        库存口径：当前库存 = 入库累计 − 所有<b>生效中</b>领用单的<b>当前生效量</b>（补过实领量按实领量，未补按登记量）；已撤回的单子不占用库存。
      </template>
    </el-alert>

    <el-table :data="store.items" border stripe v-loading="loading" :row-class-name="rowClass">
      <el-table-column prop="name" label="试剂名称" min-width="130" />
      <el-table-column prop="casNo" label="CAS号" width="120" />
      <el-table-column label="当前库存" width="130" align="center">
        <template #default="{ row }">
          <span :class="{ 'low-stock': row.stock < row.minStock }">{{ row.stock }} {{ row.unit }}</span>
        </template>
      </el-table-column>
      <el-table-column label="最低阈值" width="100" align="center">
        <template #default="{ row }">{{ row.minStock }} {{ row.unit }}</template>
      </el-table-column>
      <el-table-column label="库存预警" width="110" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.stock < row.minStock" type="danger">低库存</el-tag>
          <el-tag v-else type="success">正常</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="location" label="存放位置" min-width="120" />
      <el-table-column prop="supplier" label="供应商" min-width="100" />
      <template #empty>
        <EmptyState description="暂无试剂" />
      </template>
    </el-table>

    <div v-if="lowStockReagents.length" class="alerts">
      <StockAlert
        v-for="reagent in lowStockReagents"
        :key="reagent.id"
        :name="`${reagent.name}（当前 ${reagent.stock} ${reagent.unit} / 阈值 ${reagent.minStock} ${reagent.unit}）`"
        :stock="reagent.stock"
        :min-stock="reagent.minStock"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import StockAlert from "../components/common/StockAlert.vue";
import EmptyState from "../components/common/EmptyState.vue";
import { useReagentStore } from "../stores/reagentStore";
import { reagentApi } from "../api/reagent";

const store = useReagentStore();
const loading = ref(false);
const lowStockReagents = computed(() => store.items.filter((item) => item.stock < item.minStock));

function rowClass({ row }: { row: { stock: number; minStock: number } }) {
  return row.stock < row.minStock ? "low-stock-row" : "";
}

async function load() {
  loading.value = true;
  try {
    // 不传 lowOnly，库存、低库存判断都以同一批按实领量结算后的数据为准
    store.items = await reagentApi.list(false);
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.reagents-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.low-stock {
  color: var(--el-color-danger);
  font-weight: 700;
}
.alerts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
:deep(.low-stock-row) {
  background-color: var(--el-color-danger-light-9);
}
</style>
