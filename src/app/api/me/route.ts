import { NextResponse } from "next/server";
import * as repo from "@/server/repo";
import { currentUser, jsonError } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 로그인한 사용자와 그 사용자의 방(가장 최근 프로젝트) */
export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError("로그인이 필요합니다", 401);
  return NextResponse.json({ user: repo.toPublic(user), project: repo.getOrCreateLatestProject(user.id) });
}
