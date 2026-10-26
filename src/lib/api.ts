import type { SceneData } from "./types";
import { API_BASE, IS_APP, tokenStore } from "./platform";

// 웹과 앱이 함께 쓰는 API 클라이언트

export type User = { id: string; email: string; displayName: string };
export type Project = { id: string; name: string; scene: SceneData; updatedAt: string };
export type Session = { user: User; project: Project };

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (IS_APP) {
    headers["x-roomfit-client"] = "app";
    const token = await tokenStore.get();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method,
      credentials: IS_APP ? "omit" : "same-origin",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? `요청 실패 (${res.status})`, res.status);
  return data as T;
}

/** 로그인·가입 응답에 토큰이 있으면(앱) 기기에 저장한다 */
async function keep(s: Session & { token?: string }): Promise<Session> {
  if (s.token) await tokenStore.set(s.token);
  const { token: _omit, ...rest } = s;
  return rest;
}

export const api = {
  me: () => call<Session>("GET", "/api/me"),
  login: async (email: string, password: string) =>
    keep(await call<Session & { token?: string }>("POST", "/api/auth/login", { email, password })),
  signup: async (p: { email: string; password: string; displayName: string; importScene?: SceneData; importName?: string }) =>
    keep(await call<Session & { token?: string }>("POST", "/api/auth/signup", p)),
  logout: async () => {
    try {
      await call<{ ok: true }>("POST", "/api/auth/logout", {});
    } finally {
      await tokenStore.set(null);
    }
  },
  saveProject: (id: string, name: string, scene: SceneData) =>
    call<{ updatedAt: string }>("PUT", `/api/projects/${encodeURIComponent(id)}`, { name, scene }),
};
