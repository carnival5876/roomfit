"use client";

import { useEffect, type ReactNode } from "react";

/** 화면 아래에서 올라오는 시트. 바깥을 누르거나 뒤로 가기(Esc)로 닫힌다. */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/30" aria-label="닫기" onClick={onClose} />
      <div
        className="relative flex max-h-[78dvh] flex-col rounded-t-2xl bg-white shadow-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-3">
          <div className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-neutral-300" />
          <h2 className="pt-2 text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="-mr-2 mt-2 flex h-9 w-9 items-center justify-center rounded-full text-xl text-neutral-500 active:bg-neutral-100"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}
