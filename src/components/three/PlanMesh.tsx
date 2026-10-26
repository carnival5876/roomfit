"use client";

import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Shape, ShapeGeometry, type Mesh } from "three";
import type { RoomShape, Vec2 } from "@/lib/types";
import { WALL_THICKNESS as T, bounds, buildWalls, cutawayHidden, snapRoomMove, type Edge, type OpeningPlacement, type WallPiece } from "@/lib/plan";
import type { Group } from "three";
import { useEditor } from "@/store/editorStore";
import { useFloorDrag } from "./useFloorDrag";

const noRaycast = () => null;

// ---------- 기하 ----------
/** 바닥 다각형 → 수평 면 (ShapeGeometry 를 x-z 평면으로 눕힌다) */
function floorGeometry(points: Vec2[]) {
  const s = new Shape(points.map((p) => ({ x: p.x, y: -p.z })) as never);
  const g = new ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** 벽 조각(바닥 사각형 × 높이) 여러 개를 한 덩어리 면으로 */
function wallGeometry(pieces: WallPiece[]) {
  const pos: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => pos.push(...a, ...b, ...c);
  for (const { quad, y0, y1 } of pieces) {
    const lo = quad.map((p) => [p.x, y0, p.z]);
    const hi = quad.map((p) => [p.x, y1, p.z]);
    // 윗면·아랫면
    tri(hi[0], hi[2], hi[1]); tri(hi[0], hi[3], hi[2]);
    tri(lo[0], lo[1], lo[2]); tri(lo[0], lo[2], lo[3]);
    // 옆면 4개
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      tri(lo[i], hi[j], lo[j]); tri(lo[i], hi[i], hi[j]);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// ---------- 벽 ----------
function Wall({ edge, pieces }: { edge: Edge; pieces: WallPiece[] }) {
  const ref = useRef<Mesh>(null);
  const top = useEditor((s) => s.viewMode === "top");
  const structure = useEditor((s) => s.mode === "structure");
  const sel = useEditor((s) => s.structSel);
  const selectStruct = useEditor((s) => s.selectStruct);
  const geo = useMemo(() => wallGeometry(pieces), [pieces]);
  const selected = sel?.kind === "wall" && sel.roomId === edge.roomId && sel.edge === edge.index;

  // 3D 에서는 카메라 쪽(바깥에서 보이는) 벽을 숨겨 방 안이 보이게 한다
  useFrame(({ camera }) => {
    if (!ref.current) return;
    ref.current.visible = top || !cutawayHidden(edge, camera.position);
  });

  return (
    <mesh
      ref={ref}
      geometry={geo}
      castShadow={!top}
      receiveShadow={!top}
      raycast={structure ? undefined : noRaycast}
      onClick={
        structure
          ? (e) => {
              if (e.delta > 4) return;
              e.stopPropagation();
              selectStruct({ kind: "wall", roomId: edge.roomId, edge: edge.index });
            }
          : undefined
      }
    >
      <meshStandardMaterial
        color={selected ? "#2f6fed" : top ? "#45403a" : "#f6f3ee"}
        roughness={0.95}
        flatShading
        side={DoubleSide}
      />
    </mesh>
  );
}

// ---------- 문·창문 ----------
function OpeningMesh({ pl }: { pl: OpeningPlacement }) {
  const { opening: o, edge } = pl;
  const top = useEditor((s) => s.viewMode === "top");
  const structure = useEditor((s) => s.mode === "structure");
  const sel = useEditor((s) => s.structSel);
  const selected = sel?.kind === "opening" && sel.id === o.id;
  const color = selected ? "#2f6fed" : o.kind === "door" ? "#8a6644" : "#6b7a86";
  const f = 0.04; // 프레임 두께
  const bottom = o.kind === "door" ? 0 : o.sill;

  // 문·창문을 벽 방향으로 끌어 옮긴다 (원래 방의 벽 기준 거리)
  const drag = useFloorDrag({
    onStart: () => useEditor.getState().selectStruct({ kind: "opening", id: o.id }),
    onMove: (_d, p) => {
      const s = useEditor.getState();
      const room = s.rooms.find((r) => r.id === o.roomId);
      if (!room) return;
      const a = room.points[o.edge], b = room.points[(o.edge + 1) % room.points.length];
      const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const t = ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / L;
      s.updateOpening(o.id, { offset: Math.round(t * 100) / 100 });
    },
  });

  // 벽이 숨겨지면 문·창문도 함께 숨긴다
  const groupRef = useRef<Group>(null);
  useFrame(({ camera }) => {
    if (groupRef.current) groupRef.current.visible = top || !cutawayHidden(edge, camera.position);
  });

  // 로컬 +z 는 그려진 벽(edge) 방의 안쪽. 문짝은 문을 단 방 안쪽으로 열린다
  const ownSide = edge.roomId === o.roomId ? 1 : -1;

  return (
    <group ref={groupRef} position={[pl.center.x, 0, pl.center.z]} rotation={[0, pl.angle, 0]}>
      {/* 프레임: 로컬 x = 벽 방향, z = 벽 두께 방향 */}
      <group raycast={noRaycast}>
        <mesh position={[-o.width / 2 + f / 2, bottom + o.height / 2, 0]}>
          <boxGeometry args={[f, o.height, T + 0.02]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[o.width / 2 - f / 2, bottom + o.height / 2, 0]}>
          <boxGeometry args={[f, o.height, T + 0.02]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[0, bottom + o.height - f / 2, 0]}>
          <boxGeometry args={[o.width, f, T + 0.02]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {o.kind === "window" && (
          <>
            <mesh position={[0, bottom + f / 2, 0]}>
              <boxGeometry args={[o.width, f, T + 0.02]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[0, bottom + o.height / 2, 0]}>
              <boxGeometry args={[o.width - 2 * f, o.height - 2 * f, 0.01]} />
              <meshStandardMaterial color="#bcd6ea" transparent opacity={top ? 0.9 : 0.35} />
            </mesh>
          </>
        )}
        {o.kind === "window" && top && (
          // 평면도: 벽 위에 창문 표시
          <mesh position={[0, edge.height + 0.01, 0]}>
            <boxGeometry args={[o.width, 0.01, T + 0.01]} />
            <meshBasicMaterial color={selected ? "#2f6fed" : "#9cc3e4"} />
          </mesh>
        )}
        {o.kind === "door" && (
          <>
            {/* 80° 열린 문짝 */}
            <group position={[-o.width / 2 + f, 0, (ownSide * T) / 2]} rotation={[0, ownSide * -1.4, 0]}>
              <mesh position={[(o.width - 2 * f) / 2, o.height / 2, 0]}>
                <boxGeometry args={[o.width - 2 * f, o.height - f, 0.035]} />
                <meshStandardMaterial color="#c9a97e" />
              </mesh>
            </group>
            {/* 바닥의 문 열림 반경 */}
            <mesh
              position={[-o.width / 2 + f, 0.006, (ownSide * T) / 2]}
              rotation={[-Math.PI / 2, 0, ownSide > 0 ? -Math.PI / 2 : 0]}
            >
              <ringGeometry args={[o.width - 2 * f - 0.012, o.width - 2 * f, 32, 1, 0, Math.PI / 2]} />
              <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} />
            </mesh>
          </>
        )}
      </group>
      {/* 구조 편집: 누르거나 끌 수 있는 영역 */}
      {structure && (
        <mesh position={[0, bottom + o.height / 2, 0]} {...drag} onClick={(e) => e.stopPropagation()}>
          <boxGeometry args={[o.width, Math.max(o.height, 0.3), T + 0.08]} />
          <meshBasicMaterial transparent opacity={selected ? 0.25 : 0.0} color="#2f6fed" depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// ---------- 바닥 ----------
function Floor({ room }: { room: RoomShape }) {
  const geo = useMemo(() => floorGeometry(room.points), [room.points]);
  const structure = useEditor((s) => s.mode === "structure");
  const sel = useEditor((s) => s.structSel);
  const selected = !!sel && "roomId" in sel && sel.roomId === room.id;
  const applied = useRef({ x: 0, z: 0 });

  // 구조 편집: 바닥을 끌어 방 전체를 옮긴다 (다른 방 벽에 가까우면 붙는다)
  const drag = useFloorDrag({
    onStart: () => {
      applied.current = { x: 0, z: 0 };
      useEditor.getState().selectStruct({ kind: "room", roomId: room.id });
    },
    onMove: (d) => {
      const s = useEditor.getState();
      const me = s.rooms.find((r) => r.id === room.id);
      if (!me) return;
      const orig = { ...me, points: me.points.map((p) => ({ x: p.x - applied.current.x, z: p.z - applied.current.z })) };
      const others = s.rooms.filter((r) => r.id !== room.id);
      const want = snapRoomMove(orig, others, { x: Math.round(d.x * 100) / 100, z: Math.round(d.z * 100) / 100 });
      s.moveRoom(room.id, { x: want.x - applied.current.x, z: want.z - applied.current.z });
      applied.current = want;
    },
  });

  return (
    <mesh
      geometry={geo}
      receiveShadow
      {...(structure ? drag : {})}
      onClick={(e) => {
        if (e.delta > 4) return;
        if (structure) {
          e.stopPropagation();
          useEditor.getState().selectStruct({ kind: "room", roomId: room.id });
        } else useEditor.getState().select(null);
      }}
    >
      <meshStandardMaterial color={structure && selected ? "#dfe7f7" : "#e7ddcd"} roughness={0.9} />
    </mesh>
  );
}

/** 모든 방의 바닥·벽·문·창문 */
export function PlanMesh() {
  const rooms = useEditor((s) => s.rooms);
  const openings = useEditor((s) => s.openings);
  const { edges, pieces, placements } = useMemo(() => buildWalls(rooms, openings), [rooms, openings]);
  const byEdge = useMemo(() => {
    const m = new Map<Edge, WallPiece[]>();
    for (const p of pieces) m.set(p.edge, [...(m.get(p.edge) ?? []), p]);
    return m;
  }, [pieces]);
  const b = bounds(rooms);
  const gw = Math.ceil(b.maxX - b.minX) + 6, gd = Math.ceil(b.maxZ - b.minZ) + 6;

  return (
    <group>
      <Grid
        position={[(b.minX + b.maxX) / 2, -0.001, (b.minZ + b.maxZ) / 2]}
        args={[gw, gd]}
        cellSize={0.1}
        sectionSize={1}
        cellColor="#d6cbb9"
        sectionColor="#b9ab95"
        cellThickness={0.5}
        sectionThickness={1}
        fadeDistance={80}
        raycast={noRaycast}
      />
      {rooms.map((r) => (
        <Floor key={r.id} room={r} />
      ))}
      {edges.map((e) => {
        const ps = byEdge.get(e);
        return ps ? <Wall key={`${e.roomId}-${e.index}`} edge={e} pieces={ps} /> : null;
      })}
      {placements.map((pl) => (
        <OpeningMesh key={pl.opening.id} pl={pl} />
      ))}
    </group>
  );
}
