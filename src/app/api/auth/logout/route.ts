import { NextResponse } from "next/server";
import { endSession, guardMutation } from "@/server/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const bad = await guardMutation(req);
  if (bad) return bad;
  const res = NextResponse.json({ ok: true });
  await endSession(res);
  return res;
}
