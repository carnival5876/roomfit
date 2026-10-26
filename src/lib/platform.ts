// 실행 환경 구분
// - 웹(Next.js): 같은 서버의 /api 를 쿠키로 호출
// - 앱(Capacitor): 빌드할 때 넣은 서버 주소의 /api 를 Bearer 토큰으로 호출
// 두 값은 앱 번들 빌드(app/build.mjs)에서 치환된다.

export const IS_APP = process.env.NEXT_PUBLIC_ROOMFIT_APP === "1";
export const API_BASE = (process.env.NEXT_PUBLIC_ROOMFIT_API_URL ?? "").replace(/\/$/, "");

const TOKEN_KEY = "roomfit_token";

/** 앱 로그인 토큰. 기기 저장소(Capacitor Preferences)에 보관한다. */
export const tokenStore = {
  async get(): Promise<string | null> {
    if (!IS_APP) return null;
    const { Preferences } = await import("@capacitor/preferences");
    return (await Preferences.get({ key: TOKEN_KEY })).value;
  },
  async set(token: string | null) {
    if (!IS_APP) return;
    const { Preferences } = await import("@capacitor/preferences");
    if (token) await Preferences.set({ key: TOKEN_KEY, value: token });
    else await Preferences.remove({ key: TOKEN_KEY });
  },
};
