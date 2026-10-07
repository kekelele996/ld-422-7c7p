import type { HazardLevel, StorageCondition, UsageStatus } from "./enums";

export type Reagent = {
  id: string;
  name: string;
  casNo: string;
  formula: string;
  purity: string;
  hazardLevel: HazardLevel;
  storageCondition: StorageCondition;
  supplier: string;
  stock: number;
  unit: "g" | "mL" | "L" | "mol" | "瓶";
  minStock: number;
  location: string;
};

export type ReagentUsage = {
  id: string;
  reagentId: string;
  userId: string;
  /** 登记量：创建时的计划用量，保留不改，作为实领量上限 */
  quantity: number;
  /** 实领量：领用人补录的实际用量；库存与预警按「生效量 = 实领量 ?? 登记量」记账 */
  actualQuantity?: number;
  status: UsageStatus;
  withdrawnAt?: string;
  usedAt: string;
  experimentId: string;
  purpose: string;
  approverId?: string;
};
