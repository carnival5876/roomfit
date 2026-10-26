import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bnseng.roomfit",
  appName: "Roomfit",
  webDir: "mobile/www",
  backgroundColor: "#efece6",
  android: {
    // 서버가 아직 http 라서 허용. 도메인 + HTTPS 를 붙이면 false 로 바꾼다.
    allowMixedContent: true,
  },
  server: {
    cleartext: true,
  },
  plugins: {
    // API 요청을 기기 네이티브로 보낸다 (CORS·http 제한을 피함)
    CapacitorHttp: { enabled: true },
    SplashScreen: { launchShowDuration: 1500, backgroundColor: "#efece6", showSpinner: false },
  },
};

export default config;
