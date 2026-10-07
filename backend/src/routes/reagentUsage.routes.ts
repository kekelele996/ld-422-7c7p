import { reagentUsageController } from "../controllers/reagentUsage.controller.ts";

export function reagentUsageRoutes(method: string, path: string, query: URLSearchParams, user: never, body: Record<string, unknown>) {
  if (method === "GET" && path === "/api/reagent-usages") return reagentUsageController.list(query);
  if (method === "POST" && path === "/api/reagent-usages") return reagentUsageController.create(user, body);
  if (method === "PATCH" && path.startsWith("/api/reagent-usages/")) {
    const segments = path.split("/");
    const id = segments.at(-2) ?? "";
    if (path.endsWith("/actual")) return reagentUsageController.confirmActual(user, id, body);
    if (path.endsWith("/withdraw")) return reagentUsageController.withdraw(user, id);
  }
  return undefined;
}
