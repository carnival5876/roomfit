import { NextResponse } from "next/server";
import * as repo from "@/server/repo";
import { currentUser, guardMutation, jsonError, readJson } from "@/server/auth";
import { parseScene } from "@/lib/sceneSchema";

export const runtime = "nodejs";

/** 방 저장. 본인 프로젝트만 저장할 수 있다. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const bad = await guardMutation(req);
  if (bad) return bad;
  const user = await currentUser();
  if (!user) return jsonError("로그인이 필요합니다", 401);

  let body: Record<string, unknown>;
  try {
    body = (await readJson(req)) as Record<string, unknown>;
  } catch {
    return jsonError("요청 형식이 올바르지 않거나 너무 큽니다", 400);
  }
  const parsed = parseScene(body.scene);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const name = String(body.name ?? "").trim().slice(0, 60) || "내 방";

  const { id } = await params;
  const updatedAt = repo.saveProject(user.id, id, name, parsed.scene);
  if (!updatedAt) return jsonError("프로젝트를 찾을 수 없습니다", 404);
  return NextResponse.json({ updatedAt });
}
