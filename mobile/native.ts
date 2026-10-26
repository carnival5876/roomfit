import { Capacitor } from "@capacitor/core";

/** 상태 표시줄·스플래시 등 기기 설정 (웹 브라우저에서는 아무것도 하지 않음) */
export async function setupNative() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light });
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setBackgroundColor({ color: "#ffffff" });
    }
  } catch {}
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {}
  try {
    // 안드로이드 뒤로 가기: 열린 시트가 있으면 닫고, 없으면 앱을 백그라운드로
    const { App } = await import("@capacitor/app");
    App.addListener("backButton", () => {
      const close = document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="닫기"]');
      if (close) close.click();
      else App.minimizeApp();
    });
  } catch {}
}
