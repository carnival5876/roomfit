import { NextResponse, type NextRequest } from "next/server";

// Roomfit 앱(Capacitor)이 API를 부를 수 있게 CORS를 연다.
// 앱은 쿠키를 보내지 않고 Bearer 토큰만 쓰므로 credentials는 허용하지 않는다.
const APP_ORIGINS = new Set(["capacitor://localhost", "https://localhost", "http://localhost", "ionic://localhost"]);

function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, x-roomfit-client",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowed = origin && APP_ORIGINS.has(origin) ? origin : null;

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: allowed ? 204 : 403, headers: allowed ? cors(allowed) : {} });
  }
  const res = NextResponse.next();
  if (allowed) for (const [k, v] of Object.entries(cors(allowed))) res.headers.set(k, v);
  return res;
}

export const config = { matcher: "/api/:path*" };
