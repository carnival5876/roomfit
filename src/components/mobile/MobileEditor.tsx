"use client";

import { useEffect, useMemo, useState } from "react";
import { SceneCanvas } from "@/components/three/SceneCanvas";
import { AddRoomForm, RoomList, StructurePanel } from "@/components/editor/StructurePanel";
import { Sheet } from "./Sheet";
import { useEditor } from "@/store/editorStore";
import { CATALOG, CATEGORY_LABEL, getProduct } from "@/lib/catalog";
import { computeWarnings, degToRad, radToDeg, toCm } from "@/lib/geometry";
import type { Product, ProductCategory } from "@/lib/types";
import { saveDot, saveLabel, type AccountInfo } from "@/components/editor/account";

const won = (n: number) => n.toLocaleString("ko-KR") + "원";
const priceLabel = (p: Product) =>
  p.price == null || p.priceStatus === "unknown"
    ? "가격 미확인"
    : p.priceStatus === "verified"
      ? won(p.price)
      : `${won(p.price)} (예시)`;

type SheetKind = null | "catalog" | "list" | "room" | "addRoom";

/** 휴대폰 화면: 3D가 화면을 채우고, 목록·설정은 아래 시트로 연다. */
export default function MobileEditor({ account }: { account?: AccountInfo }) {
  const s = useEditor();
  const { rooms, items, selectedId } = s;
  const structure = s.mode === "structure";
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [cat, setCat] = useState<ProductCategory | "all">("all");
  const [editingName, setEditingName] = useState(false);

  // 아래 패널이 가리는 높이를 카메라에 알려 준다 (구조 편집 패널은 더 높다)
  useEffect(() => {
    const set = () => useEditor.getState().setBottomInset(structure ? Math.round(window.innerHeight * 0.4) : 90);
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, [structure]);

  const warnings = useMemo(() => computeWarnings(rooms, items, getProduct), [rooms, items]);
  const selected = items.find((it) => it.id === selectedId) ?? null;
  const product = selected ? getProduct(selected.productId) : undefined;
  const selWarnings = selected ? (warnings[selected.id] ?? []) : [];
  const warnCount = Object.values(warnings).filter((w) => w.length).length;
  const total = items.reduce((sum, it) => sum + (getProduct(it.productId)?.price ?? 0), 0);
  const categories = Array.from(new Set(CATALOG.map((p) => p.category)));
  const shown = cat === "all" ? CATALOG : CATALOG.filter((p) => p.category === cat);

  const rotate = (deg: number) =>
    selected && s.updateItem(selected.id, { rotation: { ...selected.rotation, y: selected.rotation.y + degToRad(deg) } });

  return (
    <div className="fixed inset-0 flex flex-col bg-[#efece6] text-neutral-900">
      {/* 상단 바 */}
      <header
        className="z-10 flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-white/95 backdrop-blur"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
          paddingRight: "max(12px, env(safe-area-inset-right, 0px))",
        }}
      >
        <div className="flex h-12 min-w-0 flex-1 items-center gap-2">
          {editingName ? (
            <input
              id="mobile-project-name"
              autoFocus
              className="min-w-0 flex-1 rounded-md bg-neutral-100 px-2 py-1.5 text-[15px] font-semibold outline-none"
              value={s.projectName}
              maxLength={60}
              onChange={(e) => s.setProjectName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              aria-label="방 이름"
            />
          ) : (
            <button
              className="min-w-0 truncate text-left text-[15px] font-semibold"
              onClick={() => setEditingName(true)}
              aria-label="방 이름 바꾸기"
            >
              {s.projectName || "내 방"}
            </button>
          )}
          {account && (
            <span
              className={`flex shrink-0 items-center gap-1 text-[11px] ${account.save === "error" ? "text-red-600" : "text-neutral-500"}`}
              aria-live="polite"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${saveDot(account.save)}`} />
              {saveLabel(account.save)}
            </span>
          )}
        </div>
        <button
          onClick={() => setSheet("room")}
          className="flex h-10 shrink-0 items-center rounded-full px-3 text-sm font-medium text-neutral-700 active:bg-neutral-100"
        >
          설정
        </button>
      </header>


      {/* 3D. 아래 정보 영역은 3D 위에 겹쳐서, 가구를 눌러도 3D 화면 크기가 바뀌지 않게 한다 */}
      <main className="relative min-h-0 flex-1">
        <SceneCanvas warnings={warnings} />

        {account?.save === "error" && account.errorMsg && (
          <div className="absolute inset-x-0 top-0 z-20 bg-red-50 px-4 py-2 text-xs text-red-700">{account.errorMsg}</div>
        )}

        <div
          className="absolute top-3 flex rounded-full bg-white/95 p-0.5 text-[13px] shadow-md"
          style={{ left: "max(12px, env(safe-area-inset-left, 0px))" }}
        >
          {(["furniture", "structure"] as const).map((m) => (
            <button
              key={m}
              onClick={() => s.setMode(m)}
              className={`rounded-full px-3.5 py-1.5 font-medium ${
                s.mode === m ? "bg-[#2f6fed] text-white" : "text-neutral-600"
              }`}
            >
              {m === "furniture" ? "가구" : "집 구조"}
            </button>
          ))}
        </div>

        <div
          className="absolute top-3 flex rounded-full bg-white/95 p-0.5 text-[13px] shadow-md"
          style={{ right: "max(12px, env(safe-area-inset-right, 0px))" }}
        >
          {(["3d", "top"] as const).map((m) => (
            <button
              key={m}
              onClick={() => s.setViewMode(m)}
              className={`rounded-full px-3.5 py-1.5 font-medium ${
                s.viewMode === m ? "bg-neutral-900 text-white" : "text-neutral-600"
              }`}
            >
              {m === "3d" ? "3D" : "평면"}
            </button>
          ))}
        </div>

        {items.length === 0 && !structure && (
          <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center px-6">
            <div className="rounded-2xl bg-white/95 px-4 py-3 text-center text-sm leading-relaxed text-neutral-600 shadow">
              아래 <b className="text-neutral-900">가구 추가</b>를 눌러 시작하세요.
              <br />
              가구는 손가락으로 끌어서 옮길 수 있어요.
            </div>
          </div>
        )}

        {/* 하단: 선택한 가구 또는 기본 바 */}
        <footer
          className="absolute inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white/95 backdrop-blur"
          style={{
            paddingBottom: "max(10px, env(safe-area-inset-bottom, 0px))",
            paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
            paddingRight: "max(12px, env(safe-area-inset-right, 0px))",
          }}
        >
          {structure ? (
            s.structSel || s.structError ? (
              <div className="relative max-h-[40dvh] overflow-y-auto overscroll-contain pb-1 pt-3">
                <button
                  onClick={() => s.selectStruct(null)}
                  className="absolute right-0 top-1 flex h-9 w-9 items-center justify-center rounded-full text-xl text-neutral-500 active:bg-neutral-100"
                  aria-label="선택 해제"
                >
                  ×
                </button>
                <StructurePanel />
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-2.5">
                <button
                  onClick={() => setSheet("room")}
                  className="flex min-w-0 flex-1 flex-col items-start rounded-xl px-2 py-1 text-left active:bg-neutral-100"
                >
                  <span className="text-[11px] text-neutral-500">방 {rooms.length}개 · 방·벽·꼭짓점을 눌러 편집</span>
                  <span className="truncate text-sm font-semibold">방 목록 보기</span>
                </button>
                <button
                  onClick={() => setSheet("addRoom")}
                  className="h-12 shrink-0 rounded-xl bg-neutral-900 px-5 text-[15px] font-semibold text-white active:scale-95"
                >
                  + 방 추가
                </button>
              </div>
            )
          ) : selected && product ? (
            <div className="flex flex-col gap-2.5 pt-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{product.name}</div>
                  <div className="text-xs tabular-nums text-neutral-500">
                    {toCm(product.width)}×{toCm(product.depth)}×{toCm(product.height)}cm · {radToDeg(selected.rotation.y)}° ·{" "}
                    {priceLabel(product)}
                  </div>
                </div>
                <button
                  onClick={() => s.select(null)}
                  className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-neutral-500 active:bg-neutral-100"
                  aria-label="선택 해제"
                >
                  ×
                </button>
              </div>
              {selWarnings.length > 0 && (
                <div className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
                  {selWarnings.map((w) => w.message).join(" · ")}
                </div>
              )}
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  ["↺ 15°", () => rotate(15)],
                  ["↻ 15°", () => rotate(-15)],
                  ["90°", () => rotate(-90)],
                  ["복제", () => s.duplicateItem(selected.id)],
                  ["삭제", () => s.removeItem(selected.id)],
                ].map(([label, fn]) => (
                  <button
                    key={label as string}
                    onClick={fn as () => void}
                    className={`h-11 rounded-xl text-sm font-medium active:scale-95 ${
                      label === "삭제" ? "bg-red-50 text-red-600" : "bg-neutral-100 text-neutral-800"
                    }`}
                  >
                    {label as string}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-2.5">
              <button
                onClick={() => setSheet("list")}
                className="flex min-w-0 flex-1 flex-col items-start rounded-xl px-2 py-1 text-left active:bg-neutral-100"
              >
                <span className="text-[11px] text-neutral-500">
                  배치한 가구 {items.length}
                  {warnCount > 0 && <span className="text-red-600"> · 경고 {warnCount}</span>}
                </span>
                <span className="truncate font-semibold tabular-nums">{won(total)}</span>
              </button>
              <button
                onClick={() => setSheet("catalog")}
                className="h-12 shrink-0 rounded-xl bg-neutral-900 px-5 text-[15px] font-semibold text-white active:scale-95"
              >
                + 가구 추가
              </button>
            </div>
          )}
        </footer>
      </main>

      {/* 가구 고르기 */}
      <Sheet open={sheet === "catalog"} title="가구 추가" onClose={() => setSheet(null)}>
        <div className="-mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5 pb-1">
          {(["all", ...categories] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium ${
                cat === c ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
              }`}
            >
              {c === "all" ? "전체" : CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <p className="mb-3 text-[11px] text-amber-800">테스트 모델입니다. 가격은 예시값이에요.</p>
        <ul className="grid grid-cols-2 gap-2">
          {shown.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => {
                  s.addItem(p.id);
                  setSheet(null);
                }}
                className="flex h-full w-full flex-col items-start gap-1 rounded-xl border border-neutral-200 p-3 text-left active:bg-neutral-50"
              >
                <span className="text-[11px] text-neutral-500">{CATEGORY_LABEL[p.category]}</span>
                <span className="text-sm font-semibold leading-snug">{p.name}</span>
                <span className="text-[11px] tabular-nums text-neutral-500">
                  {toCm(p.width)}×{toCm(p.depth)}×{toCm(p.height)}cm
                </span>
                <span className="mt-auto pt-1 text-xs font-medium tabular-nums">{priceLabel(p)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      {/* 배치한 가구 목록 */}
      <Sheet open={sheet === "list"} title={`배치한 가구 ${items.length}`} onClose={() => setSheet(null)}>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">아직 배치한 가구가 없어요.</p>
        ) : (
          <>
            <ul className="flex flex-col">
              {items.map((it) => {
                const p = getProduct(it.productId);
                if (!p) return null;
                const bad = (warnings[it.id] ?? []).length > 0;
                return (
                  <li key={it.id}>
                    <button
                      onClick={() => {
                        s.select(it.id);
                        setSheet(null);
                      }}
                      className="flex w-full items-center justify-between gap-3 border-b border-neutral-100 py-3 text-left"
                    >
                      <span className="min-w-0 truncate text-sm">
                        {bad && <span className="text-red-600">● </span>}
                        {p.name}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-neutral-500">{priceLabel(p)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-baseline justify-between pt-3">
              <span className="text-sm text-neutral-500">합계 (예시 가격)</span>
              <span className="text-lg font-semibold tabular-nums">{won(total)}</span>
            </div>
          </>
        )}
      </Sheet>

      {/* 방 추가 */}
      <Sheet open={sheet === "addRoom"} title="방 추가" onClose={() => setSheet(null)}>
        <AddRoomForm onDone={() => setSheet(null)} />
      </Sheet>

      {/* 방 목록·계정 */}
      <Sheet open={sheet === "room"} title="방 목록·설정" onClose={() => setSheet(null)}>
        <div
          onClick={() => {
            if (useEditor.getState().mode !== "structure") useEditor.getState().setMode("structure");
            setSheet(null);
          }}
        >
          <RoomList />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-neutral-500">
          방 모양·크기, 문·창문은 왼쪽 위 <b className="text-neutral-800">집 구조</b>에서 바꿀 수 있어요.
        </p>

        {account && (
          <div className="mt-6 border-t border-neutral-200 pt-4">
            <div className="text-sm font-medium">{account.userName}</div>
            <div className="text-xs text-neutral-500">{account.email}</div>
            <button
              onClick={() => {
                setSheet(null);
                account.onLogout();
              }}
              className="mt-3 h-11 w-full rounded-xl border border-neutral-300 text-sm font-medium active:bg-neutral-50"
            >
              로그아웃
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
