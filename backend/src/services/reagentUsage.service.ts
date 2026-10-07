import { reagentUsages, reagents } from "../prisma/seeds/seed.ts";
import { UsageStatus } from "../types/enums.ts";
import type { ReagentUsage, User } from "../types/interfaces.ts";
import { ApiError } from "../utils/response.ts";

// 记账口径：登记量(quantity)保留不改；生效量 = 实领量(actualQuantity)，未补录时按登记量。
// 库存扣减、低库存预警、单据数量与撤回回补全部按生效量走，保证撤回加回的量与试剂列表一致。
const roundStock = (value: number) => Math.round(value * 10000) / 10000;

function effectiveQuantity(usage: ReagentUsage) {
  if (usage.status === UsageStatus.Withdrawn) return 0;
  return usage.actualQuantity ?? usage.quantity;
}

function findUsage(id: string) {
  const usage = reagentUsages.find((item) => item.id === id);
  if (!usage) throw new ApiError(404, "USAGE_NOT_FOUND", "领用记录不存在");
  return usage;
}

function assertOperable(usage: ReagentUsage, user: User) {
  const isOwner = usage.userId === user.id;
  const isManager = user.role === "Admin" || user.role === "PI";
  if (!isOwner && !isManager) throw new ApiError(403, "FORBIDDEN", "只能操作本人的领用单");
}

let usageSeq = 0;

export const reagentUsageService = {
  list(reagentId = "", userId = "") {
    return reagentUsages.filter((item) => (!reagentId || item.reagentId === reagentId) && (!userId || item.userId === userId));
  },
  create(input: Partial<ReagentUsage>, user: User) {
    if (!input.reagentId || !input.experimentId) throw new ApiError(400, "USAGE_INVALID", "试剂和实验记录必填");
    const reagent = reagents.find((item) => item.id === input.reagentId);
    if (!reagent) throw new ApiError(404, "REAGENT_NOT_FOUND", "试剂不存在");
    const quantity = Number(input.quantity ?? 0);
    if (quantity <= 0) throw new ApiError(400, "QUANTITY_INVALID", "领用数量必须大于 0");
    if (reagent.stock < quantity) throw new ApiError(409, "INSUFFICIENT_STOCK", "库存不足");
    reagent.stock = roundStock(reagent.stock - quantity);
    const usage: ReagentUsage = {
      id: `use-${Date.now()}-${++usageSeq}`,
      reagentId: input.reagentId,
      userId: user.id,
      quantity,
      status: UsageStatus.Active,
      usedAt: input.usedAt ?? new Date().toISOString().slice(0, 10),
      experimentId: input.experimentId,
      purpose: input.purpose ?? "实验消耗",
      approverId: user.id
    };
    reagentUsages.unshift(usage);
    return usage;
  },
  confirmActual(id: string, actualQuantity: unknown, user: User) {
    const usage = findUsage(id);
    assertOperable(usage, user);
    if (usage.status === UsageStatus.Withdrawn) throw new ApiError(409, "USAGE_WITHDRAWN", "该领用单已撤回，不能补录实领量");
    const actual = Number(actualQuantity);
    if (actualQuantity === null || actualQuantity === undefined || actualQuantity === "" || !Number.isFinite(actual) || actual < 0) {
      throw new ApiError(400, "ACTUAL_INVALID", "实领量必须是不小于 0 的数字");
    }
    if (actual > usage.quantity) throw new ApiError(400, "ACTUAL_EXCEEDS_REGISTERED", "实领量不能超过登记量");
    const reagent = reagents.find((item) => item.id === usage.reagentId);
    if (!reagent) throw new ApiError(404, "REAGENT_NOT_FOUND", "试剂不存在");
    // 只把「生效量差额」退回/补扣库存：新实领量变小则退回差额，变大则补扣差额
    const stock = roundStock(reagent.stock + (effectiveQuantity(usage) - actual));
    if (stock < 0) throw new ApiError(409, "STOCK_NEGATIVE", "按该实领量调整后库存将为负数，无法保存");
    reagent.stock = stock;
    usage.actualQuantity = actual;
    return usage;
  },
  withdraw(id: string, user: User) {
    const usage = findUsage(id);
    assertOperable(usage, user);
    if (usage.status === UsageStatus.Withdrawn) throw new ApiError(409, "USAGE_ALREADY_WITHDRAWN", "该领用单已撤回");
    const reagent = reagents.find((item) => item.id === usage.reagentId);
    if (!reagent) throw new ApiError(404, "REAGENT_NOT_FOUND", "试剂不存在");
    // 撤回按生效量（实领量优先，未补录按登记量）把库存加回去
    const stock = roundStock(reagent.stock + effectiveQuantity(usage));
    if (stock < 0) throw new ApiError(409, "STOCK_NEGATIVE", "撤回后库存将为负数，无法保存");
    reagent.stock = stock;
    usage.status = UsageStatus.Withdrawn;
    usage.withdrawnAt = new Date().toISOString();
    return usage;
  }
};
