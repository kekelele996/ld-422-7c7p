import type { IncomingMessage } from "node:http";
import { users } from "../prisma/seeds/seed.ts";
import type { User } from "../types/interfaces.ts";

export function authMiddleware(req: IncomingMessage): User {
  const userId = req.headers["x-demo-user-id"];
  if (typeof userId === "string") {
    const matched = users.find((user) => user.id === userId);
    if (matched) return matched;
  }
  const role = req.headers["x-demo-role"];
  if (typeof role === "string") return users.find((user) => user.role === role) ?? users[1];
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token === "demo-admin-token") return users[0];
  return users[1];
}
