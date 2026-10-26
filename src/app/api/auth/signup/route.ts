import * as repo from "@/server/repo";
import {
  clientIp, guardMutation, hashPassword, jsonError, readJson, recordFailure, sessionResponse, tooManyAttempts,
} from "@/server/auth";
import { parseScene } from "@/lib/sceneSchema";
import type { SceneData } from "@/lib/types";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const bad = await guardMutation(req);
  if (bad) return bad;

  const key = `signup:${clientIp(req)}`;
  if (tooManyAttempts(key)) return jsonError("잠시 후 다시 시도해 주세요", 429);

  let body: Record<string, unknown>;
  try {
    body = (await readJson(req)) as Record<string, unknown>;
  } catch {
    return jsonError("요청 형식이 올바르지 않습니다", 400);
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const displayName = String(body.displayName ?? "").trim().slice(0, 40) || email.split("@")[0];

  if (!EMAIL_RE.test(email) || email.length > 254) return jsonError("이메일 주소를 확인해 주세요", 400);
  if (password.length < 8) return jsonError("비밀번호는 8자 이상이어야 합니다", 400);
  if (password.length > 200) return jsonError("비밀번호가 너무 깁니다", 400);
  if (repo.findUserByEmail(email)) {
    recordFailure(key);
    return jsonError("이미 가입된 이메일입니다. 로그인해 주세요", 409);
  }

  const user = repo.createUser(email, displayName, await hashPassword(password));

  // 가입 전에 이 브라우저에서 꾸민 방이 있으면 첫 방으로 가져온다
  let initial: { name: string; scene: SceneData } | undefined;
  if (body.importScene) {
    const parsed = parseScene(body.importScene);
    if (parsed.ok && parsed.scene.items.length > 0) {
      initial = { name: String(body.importName ?? "내 방").slice(0, 60) || "내 방", scene: parsed.scene };
    }
  }
  const project = repo.getOrCreateLatestProject(user.id, initial);

  return sessionResponse(req, user.id, { user: repo.toPublic(user), project }, 201);
}
