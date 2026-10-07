export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-demo-role": "PI",
    ...((options.headers as Record<string, string> | undefined) ?? {})
  };
  try {
    const userId = localStorage.getItem("research-lab-demo-user");
    if (userId) headers["x-demo-user-id"] = userId;
  } catch {
    // localStorage 不可用时退回角色默认用户
  }
  const response = await fetch(`/api${path}`, { ...options, headers });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? "请求失败");
  return payload.data as T;
}
