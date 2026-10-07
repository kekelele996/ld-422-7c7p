import { strict as assert } from "node:assert";
import { dashboardService } from "../src/services/dashboard.service.ts";
import { projectRoutes } from "../src/routes/project.routes.ts";
import { experimentRoutes } from "../src/routes/experiment.routes.ts";
import { reagentRoutes } from "../src/routes/reagent.routes.ts";
import { reagentUsageRoutes } from "../src/routes/reagentUsage.routes.ts";
import { memberRoutes } from "../src/routes/member.routes.ts";
import { auditLogs } from "../src/prisma/seeds/seed.ts";

const pi = { id: "u-pi", name: "王教授", role: "PI" };
const query = new URLSearchParams();

const dashboard = dashboardService.summary();
assert.equal(dashboard.activeProjects.length >= 2, true);

const members = memberRoutes("GET", "/api/members", query);
assert.equal(Array.isArray(members), true);

const projects = projectRoutes("GET", "/api/projects", query, pi, {});
assert.equal(projects.length >= 3, true);

const project = projectRoutes("POST", "/api/projects", query, pi, {
  name: "烟雾测试项目",
  projectNo: "RL-SMOKE-001",
  totalBudget: 10000
});
assert.equal(project.status, "Proposal");

const experiment = experimentRoutes("POST", "/api/experiments", query, pi, {
  projectId: projects[0].id,
  title: "烟雾测试实验"
});
assert.equal(experiment.reviewStatus, "Draft");

const submitted = experimentRoutes("PATCH", `/api/experiments/${experiment.id}/submit`, query, pi, {});
assert.equal(submitted.reviewStatus, "Submitted");

const reviewed = experimentRoutes("PATCH", `/api/experiments/${experiment.id}/review`, query, pi, { status: "Approved", comment: "ok" });
assert.equal(reviewed.reviewStatus, "Approved");

const reagent = reagentRoutes("POST", "/api/reagents", query, pi, {
  name: "烟雾测试试剂",
  stock: 6,
  minStock: 1
});
assert.equal(reagent.name, "烟雾测试试剂");

const usage = reagentUsageRoutes("POST", "/api/reagent-usages", query, pi, {
  reagentId: reagent.id,
  experimentId: experiment.id,
  quantity: 1,
  purpose: "smoke usage"
});
assert.equal(usage.quantity, 1);

const stocked = reagentRoutes("PATCH", `/api/reagents/${reagent.id}/stock-in`, query, pi, { quantity: 2 });
assert.equal(stocked.stock, 7);

// 实领量补录：登记量保留，库存按生效量差额调整
const usage2 = reagentUsageRoutes("POST", "/api/reagent-usages", query, pi, {
  reagentId: reagent.id,
  experimentId: experiment.id,
  quantity: 4,
  purpose: "smoke actual"
});
assert.equal(usage2.status, "Active");
assert.equal(usage2.userId, "u-pi");
assert.equal(reagent.stock, 3);

const confirmed = reagentUsageRoutes("PATCH", `/api/reagent-usages/${usage2.id}/actual`, query, pi, { actualQuantity: 1.5 });
assert.equal(confirmed.actualQuantity, 1.5);
assert.equal(confirmed.quantity, 4);
assert.equal(reagent.stock, 5.5);

let exceeded = null;
try { reagentUsageRoutes("PATCH", `/api/reagent-usages/${usage2.id}/actual`, query, pi, { actualQuantity: 5 }); } catch (error) { exceeded = error; }
assert.equal(exceeded?.code, "ACTUAL_EXCEEDS_REGISTERED");
assert.equal(reagent.stock, 5.5);

const student = { id: "u-student", name: "赵同学", role: "Student" };
let forbidden = null;
try { reagentUsageRoutes("PATCH", `/api/reagent-usages/${usage2.id}/actual`, query, student, { actualQuantity: 1 }); } catch (error) { forbidden = error; }
assert.equal(forbidden?.code, "FORBIDDEN");

// 撤回：按生效量（实领量 1.5）回补库存，撤回后不可再补录
const withdrawn = reagentUsageRoutes("PATCH", `/api/reagent-usages/${usage2.id}/withdraw`, query, pi, {});
assert.equal(withdrawn.status, "Withdrawn");
assert.equal(reagent.stock, 7);

let reconfirm = null;
try { reagentUsageRoutes("PATCH", `/api/reagent-usages/${usage2.id}/actual`, query, pi, { actualQuantity: 1 }); } catch (error) { reconfirm = error; }
assert.equal(reconfirm?.code, "USAGE_WITHDRAWN");

// 调高实领量时库存不够扣，必须拦截且库存不变
const tight = reagentRoutes("POST", "/api/reagents", query, pi, { name: "负库存拦截试剂", stock: 3, minStock: 1 });
const usage3 = reagentUsageRoutes("POST", "/api/reagent-usages", query, pi, { reagentId: tight.id, experimentId: experiment.id, quantity: 3 });
reagentUsageRoutes("PATCH", `/api/reagent-usages/${usage3.id}/actual`, query, pi, { actualQuantity: 0.5 });
reagentUsageRoutes("POST", "/api/reagent-usages", query, pi, { reagentId: tight.id, experimentId: experiment.id, quantity: 2.5 });
assert.equal(tight.stock, 0);
let negative = null;
try { reagentUsageRoutes("PATCH", `/api/reagent-usages/${usage3.id}/actual`, query, pi, { actualQuantity: 2 }); } catch (error) { negative = error; }
assert.equal(negative?.code, "STOCK_NEGATIVE");
assert.equal(tight.stock, 0);

assert.equal(auditLogs.length >= 6, true);

console.log("ld-422 backend route smoke passed");
