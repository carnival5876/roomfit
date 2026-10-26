"use client";

import { useState } from "react";
import { api, ApiError, type Session } from "@/lib/api";
import { GUEST_STORAGE_KEY } from "@/store/editorStore";
import type { SceneDataV1 } from "@/lib/types";

/** 이전 버전(비로그인)에서 이 브라우저에 저장된 방. 가입할 때 계정으로 옮긴다. */
function readGuestScene(): { name: string; scene: SceneDataV1 } | null {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return null;
    const st = JSON.parse(raw)?.state;
    if (!st?.room || !Array.isArray(st.items) || st.items.length === 0) return null;
    return { name: st.projectName ?? "내 방", scene: { schemaVersion: 1, room: st.room, items: st.items } };
  } catch {
    return null;
  }
}

export function AuthScreen({ onAuthed }: { onAuthed: (s: Session) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guest = typeof window !== "undefined" ? readGuestScene() : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && password.length < 8) return setError("비밀번호는 8자 이상이어야 합니다");
    setBusy(true);
    try {
      const session =
        mode === "login"
          ? await api.login(email, password)
          : await api.signup({
              email,
              password,
              displayName,
              importScene: guest?.scene,
              importName: guest?.name,
            });
      if (mode === "signup" && guest) {
        try {
          localStorage.removeItem(GUEST_STORAGE_KEY);
        } catch {}
      }
      onAuthed(session);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "알 수 없는 오류가 발생했습니다");
      setBusy(false);
    }
  };

  const input =
    "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-neutral-900";

  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-[#efece6] px-4 py-10"
      style={{ paddingTop: "max(40px, env(safe-area-inset-top, 0px))", paddingBottom: "max(40px, env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold tracking-tight text-neutral-900">Roomfit</div>
          <p className="mt-1 text-sm text-neutral-600">실제 치수로 내 방에 가구를 놓아 보세요</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="mb-5 grid grid-cols-2 rounded-lg bg-neutral-100 p-0.5 text-sm">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`rounded-md py-1.5 font-medium ${
                  mode === m ? "bg-white shadow-sm" : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {m === "login" ? "로그인" : "회원가입"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            {mode === "signup" && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-neutral-600">이름 (선택)</span>
                <input
                  id="displayName"
                  className={input}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="nickname"
                  maxLength={40}
                />
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-neutral-600">이메일</span>
              <input
                id="email"
                className={input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-neutral-600">
                비밀번호{mode === "signup" && <span className="font-normal text-neutral-400"> 8자 이상</span>}
              </span>
              <input
                id="password"
                className={input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
            </label>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            {mode === "signup" && guest && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                이 브라우저에서 꾸미던 방(가구 {guest.scene.items.length}개)을 새 계정으로 옮겨 드립니다.
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 rounded-lg bg-neutral-900 py-2.5 text-[15px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {busy ? "잠시만요…" : mode === "login" ? "로그인" : "가입하고 시작하기"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
