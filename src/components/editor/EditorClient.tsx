"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { api, ApiError, type Session } from "@/lib/api";
import { useEditor } from "@/store/editorStore";
import { IS_APP } from "@/lib/platform";
import { saveDot, saveLabel, type AccountInfo, type SaveState } from "./account";

// three.js 편집기는 로그인 확인 뒤 브라우저에서만 불러온다 (웹·앱 공통)
const Editor = lazy(() => import("./Editor"));
const MobileEditor = lazy(() => import("@/components/mobile/MobileEditor"));

/** 휴대폰(앱은 태블릿 세로까지)이면 휴대폰 화면을 쓴다 */
function useIsMobile() {
  const q = IS_APP ? "(max-width: 1023px)" : "(max-width: 767px)";
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

function Loading({ text }: { text: string }) {
  return <div className="flex h-dvh items-center justify-center text-sm text-neutral-500">{text}</div>;
}

const SAVE_DELAY = 800;

export default function EditorClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<"checking" | "anon" | "ready">("checking");

  const enter = useCallback((s: Session) => {
    useEditor.getState().loadScene(s.project.name, s.project.scene);
    setSession(s);
    setPhase("ready");
  }, []);

  useEffect(() => {
    api.me().then(enter).catch(() => setPhase("anon"));
  }, [enter]);

  if (phase === "checking") return <Loading text="불러오는 중…" />;
  if (phase === "anon" || !session) return <AuthScreen onAuthed={enter} />;
  return (
    <SignedIn
      key={session.project.id}
      session={session}
      onLoggedOut={() => {
        setSession(null);
        setPhase("anon");
      }}
    />
  );
}

/** 로그인 상태: 변경될 때마다 자동 저장 */
function SignedIn({ session, onLoggedOut }: { session: Session; onLoggedOut: () => void }) {
  const [save, setSave] = useState<SaveState>("saved");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const pending = useRef(false);
  const projectId = session.project.id;

  const flush = useCallback(async () => {
    if (inFlight.current) {
      pending.current = true; // 저장이 끝나면 한 번 더
      return;
    }
    inFlight.current = true;
    pending.current = false;
    setSave("saving");
    const st = useEditor.getState();
    let retryIn: number | null = null;
    try {
      await api.saveProject(projectId, st.projectName.trim() || "내 방", st.toSceneData());
      setErrorMsg(null);
      setSave(pending.current ? "dirty" : "saved");
      if (pending.current) retryIn = SAVE_DELAY;
    } catch (e) {
      setSave("error");
      if (e instanceof ApiError && e.status === 401) {
        setErrorMsg("로그인이 만료되었습니다. 새로고침 후 다시 로그인해 주세요");
      } else {
        setErrorMsg(e instanceof ApiError ? e.message : "저장하지 못했습니다");
        retryIn = 5000; // 연결 문제는 잠시 뒤 다시 시도
      }
    } finally {
      inFlight.current = false;
    }
    if (retryIn !== null) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, retryIn);
    }
  }, [projectId]);

  // 장면·이름이 바뀌면 저장 예약. 드래그 중에는 놓을 때까지 기다린다.
  useEffect(() => {
    return useEditor.subscribe((s, prev) => {
      const changed = s.room !== prev.room || s.items !== prev.items || s.projectName !== prev.projectName;
      const dropped = prev.isDragging && !s.isDragging;
      if (!changed && !dropped) return;
      setSave((cur) => (cur === "saving" ? cur : "dirty"));
      if (s.isDragging) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY);
    });
  }, [flush]);

  // 앱이 백그라운드로 가거나 탭을 떠나면 바로 저장
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void flush();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flush]);

  // 저장 전에 창을 닫으려 하면 경고
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (save !== "saved") e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [save]);

  const logout = async () => {
    if (save !== "saved") {
      if (timer.current) clearTimeout(timer.current);
      await flush();
    }
    await api.logout().catch(() => {});
    onLoggedOut();
  };

  const isMobile = useIsMobile();
  const account: AccountInfo = {
    userName: session.user.displayName,
    email: session.user.email,
    save,
    errorMsg,
    onLogout: logout,
  };
  const loading = <Loading text="편집기를 불러오는 중…" />;
  if (isMobile)
    return (
      <Suspense fallback={loading}>
        <MobileEditor account={account} />
      </Suspense>
    );

  return (
    <Suspense fallback={loading}>
    <Editor
      headerRight={
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <span
            className={`flex items-center gap-1.5 text-xs ${save === "error" ? "text-red-600" : "text-neutral-500"}`}
            title={errorMsg ?? undefined}
            aria-live="polite"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${saveDot(save)}`} />
            <span className="hidden sm:inline">{save === "error" && errorMsg ? errorMsg : saveLabel(save)}</span>
          </span>
          <span className="hidden max-w-40 truncate text-neutral-600 lg:inline" title={session.user.email}>
            {session.user.displayName}
          </span>
          <button
            onClick={logout}
            className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-50"
          >
            로그아웃
          </button>
        </div>
      }
    />
    </Suspense>
  );
}
