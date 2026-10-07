import { reactive } from "vue";
import type { UserRole } from "../types";

export type DemoUser = { id: string; name: string; role: UserRole };

/** 演示用登录用户（后端按 x-demo-user-id 识别本人，x-demo-role 识别角色） */
export const DEMO_USERS: DemoUser[] = [
  { id: "u-admin", name: "平台管理员", role: "Admin" },
  { id: "u-pi", name: "王教授", role: "PI" },
  { id: "u-researcher", name: "李博士", role: "Researcher" },
  { id: "u-student", name: "赵同学", role: "Student" }
];

const STORAGE_KEY = "research-lab-demo-user";

function restore(): DemoUser {
  const stored = localStorage.getItem(STORAGE_KEY);
  return DEMO_USERS.find((user) => user.id === stored) ?? DEMO_USERS[2];
}

export const demoUser = reactive<{ current: DemoUser }>({ current: restore() });

export function setDemoUser(userId: string) {
  const user = DEMO_USERS.find((item) => item.id === userId);
  if (!user) return;
  demoUser.current = user;
  localStorage.setItem(STORAGE_KEY, user.id);
}
