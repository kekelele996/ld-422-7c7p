import { API_PATHS } from "../constants/apiPaths";
import { request } from "../utils/request";
import type { ExperimentRecord, Reagent, ResearchProject } from "../types";

export type DashboardSummary = {
  activeProjects: ResearchProject[];
  recentExperimentCount: number;
  lowStockReagents: Reagent[];
  pendingReviews: number;
  recentRecords?: ExperimentRecord[];
};

export const dashboardApi = {
  summary: () => request<DashboardSummary>(API_PATHS.dashboard)
};
