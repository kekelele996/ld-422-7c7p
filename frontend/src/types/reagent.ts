import type { HazardLevel, ReagentUsageStatus, StorageCondition } from "./enums";

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
  /** 登记量：领用登记时填写，原样保留不改 */
  quantity: number;
  /** 实领量：领用人事后补录；未补录时为 null，库存按登记量算 */
  actualQuantity?: number | null;
  /** Active=生效中（占用库存）；Withdrawn=已撤回（库存已按生效量加回） */
  status: ReagentUsageStatus;
  usedAt: string;
  experimentId: string;
  purpose: string;
  approverId?: string;
};

/** 当前生效量：撤回单为 0；未补实领量按登记量，补过按实领量。库存与撤回归还都按此值 */
export function effectiveQuantity(usage: ReagentUsage): number {
  return usage.status === "Withdrawn" ? 0 : usage.actualQuantity ?? usage.quantity;
}

export const REAGENT_USAGE_STATUS_LABEL: Record<ReagentUsageStatus, string> = {
  Active: "生效中",
  Withdrawn: "已撤回"
};
