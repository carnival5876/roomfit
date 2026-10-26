"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { SceneCanvas } from "@/components/three/SceneCanvas";
import { NumberField } from "./NumberField";
import { useEditor } from "@/store/editorStore";
import { AddRoomForm, RoomList, StructurePanel } from "./StructurePanel";
import { CATALOG, CATEGORY_LABEL, getProduct } from "@/lib/catalog";
import { computeWarnings, degToRad, radToDeg, toCm } from "@/lib/geometry";
import type { Product } from "@/lib/types";

const won = (n: number) => n.toLocaleString("ko-KR") + "원";

function priceLabel(p: Product) {
  if (p.price == null || p.priceStatus === "unknown") return "가격 미확인";
  return p.priceStatus === "verified" ? won(p.price) : `${won(p.price)} (예시)`;
}

export default function Editor({ headerRight }: { headerRight?: ReactNode } = {}) {
  const s = useEditor();
  const { rooms, items, selectedId } = s;
  const structure = s.mode === "structure";

  const warnings = useMemo(() => computeWarnings(rooms, items, getProduct), [rooms, items]);
  const selected = items.find((it) => it.id === selectedId) ?? null;
  const selectedProduct = selected ? getProduct(selected.productId) : undefined;
  const warnCount = Object.values(warnings).filter((w) => w.length).length;
  const total = items.reduce((sum, it) => sum + (getProduct(it.productId)?.price ?? 0), 0);

  // 키보드 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      const st = useEditor.getState();
      if (st.mode === "structure") {
        const sel = st.structSel;
        if (e.key === "Escape") return st.selectStruct(null);
        if (e.key === "Delete" || e.key === "Backspace") {
          if (sel?.kind === "opening") st.removeOpening(sel.id);
          else if (sel?.kind === "vertex") st.removeVertex(sel.roomId, sel.index);
        }
        return;
      }
      const it = st.items.find((i) => i.id === st.selectedId);
      if (e.key === "Escape") return st.select(null);
      if (!it) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        st.removeItem(it.id);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        st.duplicateItem(it.id);
      } else if (e.key.toLowerCase() === "q" || e.key.toLowerCase() === "e") {
        const step = degToRad(e.shiftKey ? 90 : 15) * (e.key.toLowerCase() === "q" ? 1 : -1);
        st.updateItem(it.id, { rotation: { ...it.rotation, y: it.rotation.y + step } });
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const d = e.shiftKey ? 0.1 : 0.01;
        const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
        const dz = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
        const r = (v: number) => Math.round(v * 100) / 100;
        st.updateItem(it.id, {
          position: { ...it.position, x: r(it.position.x + dx), z: r(it.position.z + dz) },
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-neutral-100 text-neutral-900">
      {/* 상단 바 */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4">
        <span className="text-[15px] font-bold tracking-tight">Roomfit</span>
        <span className="h-5 w-px bg-neutral-200" />
        <input
          className="min-w-0 flex-1 rounded px-1.5 py-1 text-sm font-medium outline-none hover:bg-neutral-100 focus:bg-neutral-100 sm:max-w-xs"
          value={s.projectName}
          onChange={(e) => s.setProjectName(e.target.value)}
          aria-label="프로젝트 이름"
          maxLength={60}
        />
        <div className="ml-auto flex shrink-0 rounded-lg bg-neutral-100 p-0.5 text-sm">
          {(["furniture", "structure"] as const).map((m) => (
            <button
              key={m}
              onClick={() => s.setMode(m)}
              className={`rounded-md px-3 py-1 font-medium ${
                s.mode === m ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {m === "furniture" ? "가구 배치" : "집 구조"}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 rounded-lg bg-neutral-100 p-0.5 text-sm">
          {(["3d", "top"] as const).map((m) => (
            <button
              key={m}
              onClick={() => s.setViewMode(m)}
              className={`rounded-md px-3 py-1 font-medium ${
                s.viewMode === m ? "bg-white shadow-sm" : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {m === "3d" ? "3D" : "평면"}
            </button>
          ))}
        </div>
        {headerRight}
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* 왼쪽: 방 설정 + 카탈로그 */}
        <aside className="order-2 flex max-h-[40vh] shrink-0 flex-col overflow-y-auto border-neutral-200 bg-white md:order-1 md:max-h-none md:w-72 md:border-r">
          {structure && (
            <>
              <section className="border-b border-neutral-200 p-4">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">방 목록</h2>
                <RoomList />
              </section>
              <section className="p-4">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">새 방</h2>
                <AddRoomForm />
              </section>
            </>
          )}
          {!structure && (
          <section className="p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">가구</h2>
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">테스트 모델</span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {CATALOG.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => s.addItem(p.id)}
                    className="group flex w-full items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-left hover:border-neutral-900"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="text-[11px] text-neutral-500">
                        {CATEGORY_LABEL[p.category]} · {toCm(p.width)}×{toCm(p.depth)}×{toCm(p.height)}cm
                      </div>
                    </div>
                    <span className="text-lg leading-none text-neutral-400 group-hover:text-neutral-900">+</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          )}
        </aside>

        {/* 중앙: 3D 뷰 */}
        <main className="relative order-1 min-h-[45vh] flex-1 md:order-2">
          <SceneCanvas warnings={warnings} />
          {items.length === 0 && !structure && (
            <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
              <div className="rounded-full bg-white/90 px-4 py-2 text-sm text-neutral-600 shadow">
                가구 목록에서 항목을 눌러 방에 추가하세요
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute bottom-3 left-3 hidden rounded-md bg-white/85 px-3 py-2 text-[11px] leading-5 text-neutral-600 shadow-sm lg:block">
            가구 드래그: 이동 · 파란 점 드래그: 회전 (Shift: 자유 회전)<br />
            Q/E: 15° 회전 · 방향키: 1cm 이동 (Shift: 10cm) · Ctrl+D: 복제 · Delete: 삭제
          </div>
        </main>

        {/* 오른쪽: 선택된 가구 + 배치 목록 */}
        <aside className="order-3 flex max-h-[40vh] shrink-0 flex-col overflow-y-auto border-neutral-200 bg-white md:max-h-none md:w-80 md:border-l">
          {structure ? (
            <section className="p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">집 구조</h2>
              <StructurePanel />
            </section>
          ) : (
          <>
          <section className="border-b border-neutral-200 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">선택한 가구</h2>
            {selected && selectedProduct ? (
              <div className="flex flex-col gap-3">
                <div>
                  <div className="font-semibold">{selectedProduct.name}</div>
                  <div className="text-xs text-neutral-500">
                    {selectedProduct.color} · {priceLabel(selectedProduct)}
                  </div>
                </div>
                <dl className="grid grid-cols-3 rounded-lg bg-neutral-50 py-2 text-center">
                  {[["가로", selectedProduct.width], ["깊이", selectedProduct.depth], ["높이", selectedProduct.height]].map(
                    ([k, v]) => (
                      <div key={k as string}>
                        <dt className="text-[11px] text-neutral-500">{k}</dt>
                        <dd className="text-sm font-semibold tabular-nums">{toCm(v as number)}cm</dd>
                      </div>
                    ),
                  )}
                </dl>
                <div className="grid grid-cols-3 gap-2">
                  <NumberField
                    label="X" unit="cm" value={toCm(selected.position.x)}
                    onCommit={(v) => s.updateItem(selected.id, { position: { ...selected.position, x: v / 100 } })}
                  />
                  <NumberField
                    label="Z" unit="cm" value={toCm(selected.position.z)}
                    onCommit={(v) => s.updateItem(selected.id, { position: { ...selected.position, z: v / 100 } })}
                  />
                  <NumberField
                    label="회전" unit="°" value={radToDeg(selected.rotation.y)} min={0} max={359}
                    onCommit={(v) => s.updateItem(selected.id, { rotation: { ...selected.rotation, y: degToRad(v) } })}
                  />
                </div>
                <div className="flex gap-1.5">
                  {[
                    ["↺ 90°", 90],
                    ["↻ 90°", -90],
                  ].map(([l, d]) => (
                    <button
                      key={l as string}
                      onClick={() =>
                        s.updateItem(selected.id, {
                          rotation: { ...selected.rotation, y: selected.rotation.y + degToRad(d as number) },
                        })
                      }
                      className="flex-1 rounded-md border border-neutral-300 py-1.5 text-sm hover:bg-neutral-50"
                    >
                      {l}
                    </button>
                  ))}
                  <button
                    onClick={() => s.duplicateItem(selected.id)}
                    className="flex-1 rounded-md border border-neutral-300 py-1.5 text-sm hover:bg-neutral-50"
                  >
                    복제
                  </button>
                  <button
                    onClick={() => s.removeItem(selected.id)}
                    className="flex-1 rounded-md border border-red-200 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
                {(warnings[selected.id] ?? []).length > 0 && (
                  <ul className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {warnings[selected.id].map((w, i) => (
                      <li key={i}>⚠ {w.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">3D 화면에서 가구를 클릭하세요.</p>
            )}
          </section>

          <section className="flex-1 p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                배치한 가구 {items.length}
              </h2>
              {warnCount > 0 && <span className="text-xs font-medium text-red-600">경고 {warnCount}</span>}
            </div>
            <ul className="flex flex-col gap-1">
              {items.map((it) => {
                const p = getProduct(it.productId);
                if (!p) return null;
                const bad = (warnings[it.id] ?? []).length > 0;
                return (
                  <li key={it.id}>
                    <button
                      onClick={() => s.select(it.id)}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
                        it.id === selectedId ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"
                      }`}
                    >
                      <span className="truncate">
                        {bad && <span className={it.id === selectedId ? "text-red-300" : "text-red-600"}>● </span>}
                        {p.name}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums opacity-70">{priceLabel(p)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {items.length > 0 && (
              <div className="mt-3 flex items-baseline justify-between border-t border-neutral-200 pt-3">
                <span className="text-sm text-neutral-500">합계 (예시 가격)</span>
                <span className="font-semibold tabular-nums">{won(total)}</span>
              </div>
            )}
          </section>
          </>
          )}
        </aside>
      </div>
    </div>
  );
}
