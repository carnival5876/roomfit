import * as repo from "@/server/repo";
import {
  clearFailures, clientIp, getDummyHash, guardMutation, jsonError, readJson, recordFailure,
  sessionResponse, tooManyAttempts, verifyPassword,
} from "@/server/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const bad = await guardMutation(req);
  if (bad) return bad;

  let body: Record<string, unknown>;
  try {
    body = (await readJson(req)) as Record<string, unknown>;
  } catch {
    return jsonError("요청 형식이 올바르지 않습니다", 400);
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const key = `login:${clientIp(req)}:${email}`;
  if (tooManyAttempts(key)) return jsonError("로그인 시도가 너무 많습니다. 15분 뒤 다시 시도해 주세요", 429);

  const user = repo.findUserByEmail(email);
  const ok = await verifyPassword(password.slice(0, 200), user?.password_hash ?? (await getDummyHash()));
  if (!user || !ok) {
    recordFailure(key);
    return jsonError("이메일 또는 비밀번호가 맞지 않습니다", 401);
  }
  clearFailures(key);

  const project = repo.getOrCreateLatestProject(user.id);
  return sessionResponse(req, user.id, { user: repo.toPublic(user), project });
}
