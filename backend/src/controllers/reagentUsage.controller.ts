import type { User } from "../types/interfaces.ts";
import { reagentUsageService } from "../services/reagentUsage.service.ts";
import { auditLogMiddleware } from "../middlewares/auditLog.middleware.ts";

export const reagentUsageController = {
  list(query: URLSearchParams) {
    return reagentUsageService.list(query.get("reagentId") ?? "", query.get("userId") ?? "", query.get("status") ?? "");
  },
  create(user: User, body: Record<string, unknown>) {
    const usage = reagentUsageService.create(body, user.id);
    auditLogMiddleware(user, "CREATE_REAGENT_USAGE", "ReagentUsage", usage.id);
    return usage;
  },
  fillActual(user: User, id: string, body: Record<string, unknown>) {
    const usage = reagentUsageService.fillActual(id, Number(body.actualQuantity), user.id);
    auditLogMiddleware(user, "FILL_ACTUAL_REAGENT_USAGE", "ReagentUsage", usage.id);
    return usage;
  },
  withdraw(user: User, id: string) {
    const usage = reagentUsageService.withdraw(id, user.id);
    auditLogMiddleware(user, "WITHDRAW_REAGENT_USAGE", "ReagentUsage", usage.id);
    return usage;
  }
};
