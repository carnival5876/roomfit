"use client";

import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { OrthographicCamera, Vector3, type Group } from "three";
import type { RoomShape } from "@/lib/types";
import { add, mul, roomEdges, snapVertex } from "@/lib/plan";
import { useEditor } from "@/store/editorStore";
import { useFloorDrag } from "./useFloorDrag";

const tmp = new Vector3();

/** 화면에서 항상 같은 크기(px)로 보이게 크기를 맞춘다 (손가락으로 누르기 쉽게) */
function ScreenSized({ px, position, children }: { px: number; position: [number, number, number]; children: ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame(({ camera, size }) => {
    if (!ref.current) return;
    let worldPerPx: number;
    if (camera instanceof OrthographicCamera) worldPerPx = 1 / camera.zoom;
    else {
      const d = camera.position.distanceTo(tmp.set(...position));
      const fov = ((camera as unknown as { fov: number }).fov * Math.PI) / 180;
      worldPerPx = (2 * d * Math.tan(fov / 2)) / size.height;
    }
    ref.current.scale.setScalar(px * worldPerPx);
  });
  return (
    <group ref={ref} position={position}>
      {children}
    </group>
  );
}

function Vertex({ room, index }: { room: RoomShape; index: number }) {
  const p = room.points[index];
  const sel = useEditor((s) => s.structSel);
  const selected = sel?.kind === "vertex" && sel.roomId === room.id && sel.index === index;
  const start = useRef(p);

  const drag = useFloorDrag({
    onStart: () => {
      const s = useEditor.getState();
      start.current = s.rooms.find((r) => r.id === room.id)!.points[index];
      s.beginShapeEdit(room.id);
      s.selectStruct({ kind: "vertex", roomId: room.id, index });
    },
    onMove: (d) => {
      const s = useEditor.getState();
      const r = s.rooms.find((x) => x.id === room.id);
      if (!r) return;
      const n = r.points.length;
      const q = snapVertex(
        { x: start.current.x + d.x, z: start.current.z + d.z },
        r.points[(index - 1 + n) % n],
        r.points[(index + 1) % n],
      );
      s.setVertex(room.id, index, q);
    },
    onEnd: (moved) => {
      if (moved) useEditor.getState().commitRoom(room.id);
    },
  });

  return (
    <ScreenSized px={1} position={[p.x, 0.02, p.z]}>
      {/* 보이는 점 */}
      <mesh rotation-x={-Math.PI / 2} raycast={() => null}>
        <circleGeometry args={[selected ? 9 : 7, 24]} />
        <meshBasicMaterial color={selected ? "#2f6fed" : "#ffffff"} depthTest={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.001} raycast={() => null}>
        <circleGeometry args={[selected ? 11 : 9, 24]} />
        <meshBasicMaterial color="#2f6fed" depthTest={false} />
      </mesh>
      {/* 손가락으로 잡는 영역 (보이지 않음) */}
      <mesh rotation-x={-Math.PI / 2} {...drag} onClick={(e) => e.stopPropagation()}>
        <circleGeometry args={[22, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </ScreenSized>
  );
}

/** 선택한 방의 꼭짓점·벽 가운데(+)·벽 길이 표시 */
export function StructureHandles() {
  const mode = useEditor((s) => s.mode);
  const sel = useEditor((s) => s.structSel);
  const rooms = useEditor((s) => s.rooms);
  const isDragging = useEditor((s) => s.isDragging);
  if (mode !== "structure" || !sel || !("roomId" in sel)) return null;
  const ri = rooms.findIndex((r) => r.id === sel.roomId);
  if (ri < 0) return null;
  const room = rooms[ri];
  const edges = roomEdges(room, ri);

  return (
    <group>
      {edges.map((e) => {
        const mid = add(e.a, mul(e.u, e.length / 2));
        const label = add(mid, mul(e.n, -0.28)); // 방 안쪽에 길이 표시
        const wallSel = sel.kind === "wall" && sel.edge === e.index;
        return (
          <group key={e.index}>
            {!isDragging && (
              <Html position={[label.x, 0.05, label.z]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
                <div
                  className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums shadow-sm ${
                    wallSel ? "bg-[#2f6fed] text-white" : "bg-white/90 text-neutral-700"
                  }`}
                >
                  {Math.round(e.length * 100)}
                </div>
              </Html>
            )}
            {/* 벽 가운데 + : 눌러서 꼭짓점 추가 (ㄱ자·대각선 만들기) */}
            {e.length > 0.4 && !isDragging && (
              <ScreenSized px={1} position={[mid.x, 0.02, mid.z]}>
                <mesh
                  rotation-x={-Math.PI / 2}
                  onClick={(ev) => {
                    if (ev.delta > 4) return;
                    ev.stopPropagation();
                    useEditor.getState().insertVertex(room.id, e.index);
                  }}
                >
                  <circleGeometry args={[16, 16]} />
                  <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </mesh>
                <mesh rotation-x={-Math.PI / 2} raycast={() => null}>
                  <ringGeometry args={[5, 7, 20]} />
                  <meshBasicMaterial color="#2f6fed" depthTest={false} transparent opacity={0.8} />
                </mesh>
                <mesh rotation-x={-Math.PI / 2} raycast={() => null}>
                  <planeGeometry args={[6, 1.6]} />
                  <meshBasicMaterial color="#2f6fed" depthTest={false} />
                </mesh>
                <mesh rotation-x={-Math.PI / 2} rotation-z={Math.PI / 2} raycast={() => null}>
                  <planeGeometry args={[6, 1.6]} />
                  <meshBasicMaterial color="#2f6fed" depthTest={false} />
                </mesh>
              </ScreenSized>
            )}
          </group>
        );
      })}
      {room.points.map((_, i) => (
        <Vertex key={i} room={room} index={i} />
      ))}
    </group>
  );
}

