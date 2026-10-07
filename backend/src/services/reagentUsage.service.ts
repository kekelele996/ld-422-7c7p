import { reagentUsages, reagents } from "../prisma/seeds/seed.ts";
import { ReagentUsageStatus } from "../types/enums.ts";
import type { ReagentUsage, ReagentUsageStatusValue } from "../types/interfaces.ts";
import { ApiError } from "../utils/response.ts";

/**
 * 当前生效量：库存、低库存提醒、撤回加回一律按此值走。
 * 未补实领量时用登记量 quantity；补了实领量后用 actualQuantity。
 * 撤回单不再占用库存，生效量按 0 计。
 */
export function effectiveQuantity(usage: ReagentUsage): number {
  return usage.status === ReagentUsageStatus.Withdrawn ? 0 : usage.actualQuantity ?? usage.quantity;
}

/** 试剂当前被所有有效领用单占用的总量 */
export function reservedStock(reagentId: string): number {
  return reagentUsages
    .filter((usage) => usage.reagentId === reagentId && usage.status !== ReagentUsageStatus.Withdrawn)
    .reduce((sum, usage) => sum + effectiveQuantity(usage), 0);
}

export const reagentUsageService = {
  list(reagentId = "", userId = "", status = "") {
    return reagentUsages.filter(
      (item) =>
        (!reagentId || item.reagentId === reagentId) &&
        (!userId || item.userId === userId) &&
        (!status || item.status === (status as ReagentUsageStatusValue))
    );
  },
  create(input: Partial<ReagentUsage>, approverId: string) {
    if (!input.reagentId || !input.experimentId) throw new ApiError(400, "USAGE_INVALID", "试剂和实验记录必填");
    const reagent = reagents.find((item) => item.id === input.reagentId);
    if (!reagent) throw new ApiError(404, "REAGENT_NOT_FOUND", "试剂不存在");
    const quantity = Number(input.quantity ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new ApiError(400, "QUANTITY_INVALID", "领用数量必须大于 0");
    if (reagent.stock < quantity) throw new ApiError(409, "INSUFFICIENT_STOCK", "库存不足");
    reagent.stock -= quantity;
    const usage: ReagentUsage = {
      id: `use-${Date.now()}`,
      reagentId: input.reagentId,
      userId: input.userId ?? "u-student",
      quantity,
      status: ReagentUsageStatus.Active,
      usedAt: input.usedAt ?? new Date().toISOString().slice(0, 10),
      experimentId: input.experimentId,
      purpose: input.purpose ?? "实验消耗",
      approverId
    };
    reagentUsages.unshift(usage);
    return usage;
  },
  /**
   * 领用人补实领量：登记量 quantity 原样保留，只写 actualQuantity。
   * 库存先按登记量扣过，这里把差额（登记量 - 实领量）退回库存。
   */
  fillActual(id: string, actualQuantity: number, userId: string) {
    const usage = reagentUsages.find((item) => item.id === id);
    if (!usage) throw new ApiError(404, "USAGE_NOT_FOUND", "领用单不存在");
    if (usage.status === ReagentUsageStatus.Withdrawn) throw new ApiError(409, "USAGE_WITHDRAWN", "领用单已撤回，不能补实领量");
    if (usage.userId !== userId) throw new ApiError(403, "FORBIDDEN", "只能给自己的领用单补实领量");
    const actual = Number(actualQuantity);
    if (!Number.isFinite(actual) || actual <= 0) throw new ApiError(400, "ACTUAL_QUANTITY_INVALID", "实领量必须大于 0");
    if (actual > usage.quantity) throw new ApiError(400, "ACTUAL_QUANTITY_EXCEEDED", "实领量不能超过登记量");

    const reagent = reagents.find((item) => item.id === usage.reagentId);
    if (!reagent) throw new ApiError(404, "REAGENT_NOT_FOUND", "试剂不存在");
    const previousEffective = effectiveQuantity(usage);
    const nextStock = reagent.stock + (previousEffective - actual);
    if (nextStock < 0) throw new ApiError(409, "STOCK_NEGATIVE", "调整后库存为负数，禁止保存");

    usage.actualQuantity = actual;
    reagent.stock = nextStock;
    return usage;
  },
  /** 撤回领用单：按当前生效量（补过实领量按实领量，否则按登记量）把库存加回去 */
  withdraw(id: string, userId: string) {
    const usage = reagentUsages.find((item) => item.id === id);
    if (!usage) throw new ApiError(404, "USAGE_NOT_FOUND", "领用单不存在");
    if (usage.status === ReagentUsageStatus.Withdrawn) throw new ApiError(409, "USAGE_WITHDRAWN", "领用单已撤回，请勿重复撤回");
    if (usage.userId !== userId) throw new ApiError(403, "FORBIDDEN", "只能撤回自己的领用单");

    const reagent = reagents.find((item) => item.id === usage.reagentId);
    if (!reagent) throw new ApiError(404, "REAGENT_NOT_FOUND", "试剂不存在");
    const refund = effectiveQuantity(usage);
    const nextStock = reagent.stock + refund;
    if (nextStock < 0) throw new ApiError(409, "STOCK_NEGATIVE", "撤回后库存为负数，禁止保存");

    usage.status = ReagentUsageStatus.Withdrawn;
    reagent.stock = nextStock;
    return usage;
  }
};
