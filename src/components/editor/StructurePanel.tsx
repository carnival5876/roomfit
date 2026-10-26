"use client";

import { useState } from "react";
import { NumberField } from "./NumberField";
import { ROOM_LIMITS, useEditor, type RoomPreset } from "@/store/editorStore";
import { area, dist } from "@/lib/plan";

const cm = (m: number) => Math.round(m * 100);
const btn = "h-10 rounded-lg px-3 text-sm font-medium active:scale-[0.98]";
const btnGray = `${btn} bg-neutral-100 text-neutral-800 hover:bg-neutral-200`;
const btnDark = `${btn} bg-neutral-900 text-white hover:bg-neutral-800`;
const btnRed = `${btn} bg-red-50 text-red-600 hover:bg-red-100`;

/** 새 방 만들기: 모양(직사각형·ㄱ자)과 크기 */
export function AddRoomForm({ onDone }: { onDone?: () => void }) {
  const addRoom = useEditor((s) => s.addRoom);
  const count = useEditor((s) => s.rooms.length);
  const [shape, setShape] = useState<RoomPreset["shape"]>("rect");
  const [w, setW] = useState(300);
  const [d, setD] = useState(300);
  const [name, setName] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["rect", "직사각형", "M4 4h16v16H4z"],
            ["l", "ㄱ자", "M4 4h8v8h8v8H4z"],
          ] as const
        ).map(([k, label, path]) => (
          <button
            key={k}
            onClick={() => setShape(k)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
              shape === k ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d={path} />
            </svg>
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="가로" unit="cm" value={w} min={100} max={2000} onCommit={setW} />
        <NumberField label="세로" unit="cm" value={d} min={100} max={2000} onCommit={setD} />
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-neutral-500">이름</span>
        <input
          id="new-room-name"
          className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-neutral-900"
          placeholder={`방 ${count + 1}`}
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        className={btnDark}
        onClick={() => {
          addRoom({ shape, width: w / 100, depth: d / 100, name: name.trim() || `방 ${count + 1}` });
          setName("");
          onDone?.();
        }}
      >
        방 추가
      </button>
      <p className="text-[11px] leading-relaxed text-neutral-500">
        기존 방 오른쪽에 붙어서 생겨요. 방 바닥을 끌어 옮기면 다른 방 벽에 자동으로 붙습니다.
      </p>
    </div>
  );
}

/** 구조 편집에서 선택한 것(방·벽·꼭짓점·문/창문)의 설정 */
export function StructurePanel({ onAddRoom }: { onAddRoom?: () => void }) {
  const s = useEditor();
  const sel = s.structSel;
  const room = sel && "roomId" in sel ? s.rooms.find((r) => r.id === sel.roomId) : undefined;
  const opening = sel?.kind === "opening" ? s.openings.find((o) => o.id === sel.id) : undefined;
  const [besideDepth, setBesideDepth] = useState(300);

  const error = s.structError && (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
      {s.structError}
    </p>
  );

  // 아무것도 선택하지 않음
  if (!sel || (!room && !opening)) {
    return (
      <div className="flex flex-col gap-3">
        {error}
        <ul className="flex flex-col gap-1.5 text-[13px] leading-snug text-neutral-600">
          <li>· 방 바닥을 누르면 선택, 끌면 이동</li>
          <li>· 꼭짓점(○)을 끌어 모양 바꾸기, 벽 가운데 ⊕를 눌러 꼭짓점 추가 → ㄱ자·대각선</li>
          <li>· 벽을 누르면 길이 입력, 문·창문 달기, 옆에 방 붙이기</li>
        </ul>
        {onAddRoom && (
          <button className={btnDark} onClick={onAddRoom}>
            + 방 추가
          </button>
        )}
      </div>
    );
  }

  // 문·창문
  if (opening) {
    const owner = s.rooms.find((r) => r.id === opening.roomId);
    const L = owner ? dist(owner.points[opening.edge], owner.points[(opening.edge + 1) % owner.points.length]) : 0;
    const set = (patch: Parameters<typeof s.updateOpening>[1]) => s.updateOpening(opening.id, patch);
    return (
      <div className="flex flex-col gap-3">
        {error}
        <div>
          <div className="font-semibold">{opening.kind === "door" ? "문" : "창문"}</div>
          <div className="text-xs text-neutral-500">
            {owner?.name} · 벽 {opening.edge + 1} (길이 {cm(L)}cm) · 끌어서 옮길 수 있어요
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <NumberField label="폭" unit="cm" value={cm(opening.width)} min={30} max={cm(L)} onCommit={(v) => set({ width: v / 100 })} />
          <NumberField label="높이" unit="cm" value={cm(opening.height)} min={30} max={500} onCommit={(v) => set({ height: v / 100 })} />
          {opening.kind === "window" ? (
            <NumberField label="바닥에서" unit="cm" value={cm(opening.sill)} min={0} max={400} onCommit={(v) => set({ sill: v / 100 })} />
          ) : (
            <div />
          )}
        </div>
        <NumberField
          label="벽 시작점에서 가운데까지"
          unit="cm"
          value={cm(opening.offset)}
          min={0}
          max={cm(L)}
          onCommit={(v) => set({ offset: v / 100 })}
        />
        <button className={btnRed} onClick={() => s.removeOpening(opening.id)}>
          {opening.kind === "door" ? "문" : "창문"} 삭제
        </button>
      </div>
    );
  }

  if (!room) return null;

  // 벽
  if (sel.kind === "wall") {
    const n = room.points.length;
    const L = dist(room.points[sel.edge], room.points[(sel.edge + 1) % n]);
    return (
      <div className="flex flex-col gap-3">
        {error}
        <div>
          <div className="font-semibold">
            {room.name} · 벽 {sel.edge + 1}
          </div>
          <div className="text-xs text-neutral-500">안쪽 벽면 길이 기준</div>
        </div>
        <NumberField
          label="벽 길이"
          unit="cm"
          value={cm(L)}
          min={20}
          max={5000}
          onCommit={(v) => s.setEdgeLength(room.id, sel.edge, v / 100)}
        />
        <div className="grid grid-cols-2 gap-2">
          <button className={btnGray} onClick={() => s.addOpening("door", room.id, sel.edge)}>
            문 달기
          </button>
          <button className={btnGray} onClick={() => s.addOpening("window", room.id, sel.edge)}>
            창문 달기
          </button>
          <button className={btnGray} onClick={() => s.insertVertex(room.id, sel.edge)}>
            가운데 꼭짓점 추가
          </button>
          <button className={btnGray} onClick={() => s.selectStruct({ kind: "room", roomId: room.id })}>
            방 전체 선택
          </button>
        </div>
        <div className="flex items-end gap-2 rounded-lg bg-neutral-50 p-2">
          <div className="flex-1">
            <NumberField label="이 벽 옆에 붙일 방 깊이" unit="cm" value={besideDepth} min={100} max={2000} onCommit={setBesideDepth} />
          </div>
          <button className={btnDark} onClick={() => s.addRoomBeside(room.id, sel.edge, besideDepth / 100)}>
            옆에 방 추가
          </button>
        </div>
      </div>
    );
  }

  // 꼭짓점
  if (sel.kind === "vertex") {
    const p = room.points[sel.index];
    if (!p) return null;
    return (
      <div className="flex flex-col gap-3">
        {error}
        <div>
          <div className="font-semibold">
            {room.name} · 꼭짓점 {sel.index + 1}
          </div>
          <div className="text-xs text-neutral-500">끌어서 옮기면 이웃 꼭짓점과 가로·세로로 줄이 맞춰져요</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="X" unit="cm" value={cm(p.x)}
            onCommit={(v) => {
              s.beginShapeEdit(room.id);
              s.setVertex(room.id, sel.index, { x: v / 100, z: p.z });
              s.commitRoom(room.id);
            }}
          />
          <NumberField
            label="Z" unit="cm" value={cm(p.z)}
            onCommit={(v) => {
              s.beginShapeEdit(room.id);
              s.setVertex(room.id, sel.index, { x: p.x, z: v / 100 });
              s.commitRoom(room.id);
            }}
          />
        </div>
        <button className={btnRed} onClick={() => s.removeVertex(room.id, sel.index)} disabled={room.points.length <= 3}>
          꼭짓점 삭제
        </button>
      </div>
    );
  }

  // 방
  return (
    <div className="flex flex-col gap-3">
      {error}
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-neutral-500">방 이름</span>
        <input
          id="room-name"
          className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm font-medium outline-none focus:border-neutral-900"
          value={room.name}
          maxLength={30}
          onChange={(e) => s.updateRoom(room.id, { name: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="천장 높이" unit="cm" value={cm(room.height)}
          min={ROOM_LIMITS.minHeight * 100} max={ROOM_LIMITS.maxHeight * 100}
          onCommit={(v) => s.updateRoom(room.id, { height: v / 100 })}
        />
        <div className="flex flex-col justify-end pb-1.5 text-xs text-neutral-500">
          <span>
            면적 <b className="tabular-nums text-neutral-800">{area(room.points).toFixed(2)}㎡</b>
          </span>
          <span className="tabular-nums">약 {(area(room.points) / 3.3058).toFixed(1)}평 · 벽 {room.points.length}개</span>
        </div>
      </div>
      <p className="text-[11px] leading-relaxed text-neutral-500">
        벽을 누르면 길이를 바꾸거나 문·창문을 달 수 있어요. 바닥을 끌면 방이 통째로 움직여요.
      </p>
      <button className={btnRed} onClick={() => s.removeRoom(room.id)} disabled={s.rooms.length <= 1}>
        이 방 삭제
      </button>
    </div>
  );
}

/** 방 목록 (누르면 선택) */
export function RoomList() {
  const rooms = useEditor((s) => s.rooms);
  const sel = useEditor((s) => s.structSel);
  const selectStruct = useEditor((s) => s.selectStruct);
  const total = rooms.reduce((a, r) => a + area(r.points), 0);
  return (
    <div>
      <ul className="flex flex-col gap-1">
        {rooms.map((r) => {
          const on = !!sel && "roomId" in sel && sel.roomId === r.id;
          return (
            <li key={r.id}>
              <button
                onClick={() => selectStruct({ kind: "room", roomId: r.id })}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
                  on ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"
                }`}
              >
                <span className="truncate">{r.name}</span>
                <span className="shrink-0 text-xs tabular-nums opacity-70">{area(r.points).toFixed(1)}㎡</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 px-2 text-xs text-neutral-500">
        전체 {total.toFixed(1)}㎡ · 약 {(total / 3.3058).toFixed(1)}평
      </p>
    </div>
  );
}
