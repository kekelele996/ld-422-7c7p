import { strict as assert } from "node:assert";
import { dashboardService } from "../src/services/dashboard.service.ts";
import { projectRoutes } from "../src/routes/project.routes.ts";
import { experimentRoutes } from "../src/routes/experiment.routes.ts";
import { reagentRoutes } from "../src/routes/reagent.routes.ts";
import { reagentUsageRoutes } from "../src/routes/reagentUsage.routes.ts";
import { memberRoutes } from "../src/routes/member.routes.ts";
import { auditLogs, reagents } from "../src/prisma/seeds/seed.ts";

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
  quantity: 3,
  purpose: "smoke usage"
});
assert.equal(usage.quantity, 3);
assert.equal(usage.status, "Active");
// 登记时按登记量扣库存：6 - 3 = 3
const reserved = reagentRoutes("GET", `/api/reagents/${reagent.id}`, query);
assert.equal(reserved.stock, 3);

const stocked = reagentRoutes("PATCH", `/api/reagents/${reagent.id}/stock-in`, query, pi, { quantity: 2 });
// 3（扣登记量后）+ 2 = 5
assert.equal(stocked.stock, 5);
assert.equal(auditLogs.length >= 6, true);

// ---- 实领量 / 撤回场景：另开一个库存 10 的试剂 ----
const reagent2 = reagentRoutes("POST", "/api/reagents", query, pi, {
  name: "实领量测试试剂",
  stock: 10,
  minStock: 4
});

const student = { id: "u-student", name: "赵同学", role: "Student" };
const other = { id: "u-researcher", name: "李博士", role: "Researcher" };

// 学生登记领用 4：库存 10 - 4 = 6
const order = reagentUsageRoutes("POST", "/api/reagent-usages", query, student, {
  reagentId: reagent2.id,
  experimentId: experiment.id,
  quantity: 4,
  purpose: "actual test",
  userId: "u-student"
});
assert.equal(reagentRoutes("GET", `/api/reagents/${reagent2.id}`, query).stock, 6);
// 库存 6 >= 阈值 4，不在低库存列表
const dashBefore = dashboardService.summary();
assert.equal(dashBefore.lowStockReagents.some((item) => item.id === reagent2.id), false);

// 非本人不能补实领量
assert.throws(
  () => reagentUsageRoutes("PATCH", `/api/reagent-usages/${order.id}/actual`, query, other, { actualQuantity: 2 }),
  /只能给自己的领用单补实领量/
);

// 实领量超过登记量必须挡住，且库存不变
assert.throws(
  () => reagentUsageRoutes("PATCH", `/api/reagent-usages/${order.id}/actual`, query, student, { actualQuantity: 5 }),
  /实领量不能超过登记量/
);
assert.equal(reagentRoutes("GET", `/api/reagents/${reagent2.id}`, query).stock, 6);

// 补实领量 1（登记量 4 保留），差额 3 退回：库存 6 + 3 = 9
const filled = reagentUsageRoutes("PATCH", `/api/reagent-usages/${order.id}/actual`, query, student, { actualQuantity: 1 });
assert.equal(filled.quantity, 4);
assert.equal(filled.actualQuantity, 1);
assert.equal(reagentRoutes("GET", `/api/reagents/${reagent2.id}`, query).stock, 9);

// 撤回按实领量 1 加回：库存 9 + 1 = 10，单据状态 Withdrawn
const withdrawn = reagentUsageRoutes("PATCH", `/api/reagent-usages/${order.id}/withdraw`, query, student, {});
assert.equal(withdrawn.status, "Withdrawn");
assert.equal(reagentRoutes("GET", `/api/reagents/${reagent2.id}`, query).stock, 10);

// 已撤回不能重复撤回
assert.throws(
  () => reagentUsageRoutes("PATCH", `/api/reagent-usages/${order.id}/withdraw`, query, student, {}),
  /已撤回/
);

// ---- 撤回后库存为负不许存：构造库存被扣到 0 的单，再人为把库存改成负数 ----
const reagent3 = reagentRoutes("POST", "/api/reagents", query, pi, {
  name: "负数拦截试剂",
  stock: 2,
  minStock: 1
});
const order2 = reagentUsageRoutes("POST", "/api/reagent-usages", query, student, {
  reagentId: reagent3.id,
  experimentId: experiment.id,
  quantity: 2,
  userId: "u-student"
});
assert.equal(reagentRoutes("GET", `/api/reagents/${reagent3.id}`, query).stock, 0);
// 模拟库存数据严重异常（-5），撤回加回 2 后仍为负，必须拦截，且单据状态不变
const reagent3Record = reagents.find((item) => item.id === reagent3.id);
reagent3Record.stock = -5;
assert.throws(
  () => reagentUsageRoutes("PATCH", `/api/reagent-usages/${order2.id}/withdraw`, query, student, {}),
  /库存为负数/
);
assert.equal(order2.status, "Active");

// 库存恢复正常后撤回成功，按登记量 2 加回：0 + 2 = 2
reagent3Record.stock = 0;
reagentUsageRoutes("PATCH", `/api/reagent-usages/${order2.id}/withdraw`, query, student, {});
assert.equal(reagentRoutes("GET", `/api/reagents/${reagent3.id}`, query).stock, 2);

console.log("ld-422 backend route smoke passed");
