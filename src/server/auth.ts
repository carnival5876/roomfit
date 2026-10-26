import "server-only";
import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import * as repo from "./repo";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

export const SESSION_COOKIE = "roomfit_session";
const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

// ---------- 비밀번호 ----------
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64, SCRYPT);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(pw, Buffer.from(saltB64, "base64"), expected.length, SCRYPT);
  return timingSafeEqual(key, expected);
}

// 존재하지 않는 이메일로 로그인할 때도 같은 시간이 걸리게 하는 더미 해시
let dummyHash: Promise<string> | null = null;
export const getDummyHash = () => (dummyHash ??= hashPassword("not-a-real-password"));

// ---------- 세션 ----------
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function isHttps() {
  const h = await headers();
  return h.get("x-forwarded-proto") === "https";
}

/** 앱(Capacitor) 화면의 출처. 앱은 쿠키 대신 Bearer 토큰으로 인증한다. */
export const APP_ORIGINS = new Set([
  "capacitor://localhost", // iOS
  "https://localhost", // Android
  "http://localhost",
  "ionic://localhost",
]);

/** 앱에서 온 요청인지 (앱은 모든 요청에 이 헤더를 붙인다) */
export const isAppRequest = (req: Request) => req.headers.get("x-roomfit-client") === "app";

async function bearerToken(): Promise<string | null> {
  const h = (await headers()).get("authorization");
  const m = h?.match(/^Bearer\s+([A-Za-z0-9_-]{20,100})$/);
  return m ? m[1] : null;
}

/**
 * 로그인/가입 성공 응답. DB에는 토큰의 해시만 저장한다.
 * - 웹: HttpOnly 쿠키로 전달
 * - 앱: 응답 본문의 token으로 전달 (앱이 기기 저장소에 보관)
 */
export async function sessionResponse(req: Request, userId: string, body: Record<string, unknown>, status = 200) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  repo.createSession(sha256(token), userId, expires);
  if (Math.random() < 0.05) repo.purgeExpiredSessions();

  if (isAppRequest(req)) return NextResponse.json({ ...body, token }, { status });

  const res = NextResponse.json(body, { status });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    expires,
  });
  return res;
}

export async function endSession(res: NextResponse) {
  const token = (await bearerToken()) ?? (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) repo.deleteSession(sha256(token));
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function currentUser(): Promise<repo.UserRow | null> {
  const token = (await bearerToken()) ?? (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return repo.findSessionUser(sha256(token)) ?? null;
}

// ---------- 요청 검사 ----------
/**
 * 상태를 바꾸는 요청은 JSON + 같은 출처(또는 Roomfit 앱)만 받는다 (CSRF 방지).
 * 앱 출처는 쿠키를 쓰지 않고 Bearer 토큰만 쓰므로 CSRF 대상이 아니다.
 * 통과하면 null, 아니면 오류 응답.
 */
export async function guardMutation(req: Request): Promise<NextResponse | null> {
  if (!req.headers.get("content-type")?.includes("application/json"))
    return jsonError("JSON 요청만 받습니다", 415);
  const origin = req.headers.get("origin");
  if (origin && !APP_ORIGINS.has(origin)) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    try {
      if (new URL(origin).host !== host) return jsonError("허용되지 않은 출처입니다", 403);
    } catch {
      return jsonError("허용되지 않은 출처입니다", 403);
    }
  }
  return null;
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson(req: Request, maxBytes = 512 * 1024): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("too_large");
  return JSON.parse(text);
}

// ---------- 로그인 시도 제한 (프로세스 메모리) ----------
const attempts = new Map<string, { n: number; until: number }>();
const WINDOW = 15 * 60 * 1000;
const LIMIT = 10;

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}

export function tooManyAttempts(key: string): boolean {
  const a = attempts.get(key);
  return !!a && a.until > Date.now() && a.n >= LIMIT;
}

export function recordFailure(key: string) {
  const a = attempts.get(key);
  if (!a || a.until < Date.now()) attempts.set(key, { n: 1, until: Date.now() + WINDOW });
  else a.n++;
}

export function clearFailures(key: string) {
  attempts.delete(key);
}
