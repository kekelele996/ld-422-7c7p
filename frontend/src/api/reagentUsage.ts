import { API_PATHS } from "../constants/apiPaths";
import { request } from "../utils/request";
import type { ReagentUsage } from "../types/reagent";

export const reagentUsageApi = {
  list: (reagentId = "", userId = "", status = "") =>
    request<ReagentUsage[]>(`${API_PATHS.reagentUsages}?reagentId=${reagentId}&userId=${userId}&status=${status}`),
  create: (payload: Partial<ReagentUsage>) =>
    request<ReagentUsage>(API_PATHS.reagentUsages, { method: "POST", body: JSON.stringify(payload) }),
  /** 补实领量：登记量不变，库存按差额调整 */
  fillActual: (id: string, actualQuantity: number) =>
    request<ReagentUsage>(`${API_PATHS.reagentUsages}/${id}/actual`, {
      method: "PATCH",
      body: JSON.stringify({ actualQuantity })
    }),
  /** 撤回：按当前生效量（实领量优先，否则登记量）把库存加回 */
  withdraw: (id: string) =>
    request<ReagentUsage>(`${API_PATHS.reagentUsages}/${id}/withdraw`, { method: "PATCH" })
};
