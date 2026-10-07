import { API_PATHS } from "../constants/apiPaths";
import { request } from "../utils/request";
import type { ReagentUsage } from "../types/reagent";

export const reagentUsageApi = {
  list: (reagentId = "", userId = "") => request<ReagentUsage[]>(`${API_PATHS.reagentUsages}?reagentId=${reagentId}&userId=${userId}`),
  create: (payload: Partial<ReagentUsage>) => request<ReagentUsage>(API_PATHS.reagentUsages, { method: "POST", body: JSON.stringify(payload) }),
  confirmActual: (id: string, actualQuantity: number) => request<ReagentUsage>(`${API_PATHS.reagentUsages}/${id}/actual`, { method: "PATCH", body: JSON.stringify({ actualQuantity }) }),
  withdraw: (id: string) => request<ReagentUsage>(`${API_PATHS.reagentUsages}/${id}/withdraw`, { method: "PATCH" })
};
