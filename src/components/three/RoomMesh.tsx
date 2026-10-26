"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
import type { Mesh } from "three";
import type { Room } from "@/lib/types";
import { useEditor } from "@/store/editorStore";

const WALL_T = 0.1; // 벽 두께. 방 내부 치수에 영향을 주지 않도록 바깥쪽으로 둔다.

/** 실제 치수의 바닥과 벽. 카메라 쪽 벽은 자동으로 숨겨 내부가 보이게 한다. */
export function RoomMesh({ room }: { room: Room }) {
  const { width: W, depth: D, height: H } = room;
  const select = useEditor((s) => s.select);
  const top = useEditor((s) => s.viewMode === "top");
  const walls = useRef<(Mesh | null)[]>([]);
  // 평면 시점에서는 벽을 낮은 외곽선으로 그려 그림자와 시야 가림을 없앤다
  const wallH = top ? 0.02 : H;

  // [x, z, 가로, 깊이, 법선 축, 부호]
  const defs: [number, number, number, number, "x" | "z", number][] = [
    [0, -D / 2 - WALL_T / 2, W + WALL_T * 2, WALL_T, "z", -1], // 뒤
    [0, D / 2 + WALL_T / 2, W + WALL_T * 2, WALL_T, "z", 1], // 앞
    [-W / 2 - WALL_T / 2, 0, WALL_T, D, "x", -1], // 왼쪽
    [W / 2 + WALL_T / 2, 0, WALL_T, D, "x", 1], // 오른쪽
  ];

  useFrame(({ camera }) => {
    defs.forEach(([, , , , axis, sign], i) => {
      const m = walls.current[i];
      if (!m) return;
      const limit = axis === "x" ? W / 2 : D / 2;
      const c = axis === "x" ? camera.position.x : camera.position.z;
      // 카메라가 벽 바깥쪽에 있으면 숨김 (위에서 내려다보는 경우는 유지)
      m.visible = top || !(c * sign > limit && camera.position.y < H * 4);
    });
  });

  return (
    <group>
      {/* 바닥: 클릭하면 선택 해제 */}
      <mesh
        rotation-x={-Math.PI / 2}
        receiveShadow
        onClick={(e) => {
          if (e.delta < 4) select(null);
        }}
      >
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#e7ddcd" roughness={0.9} />
      </mesh>
      <Grid
        position={[0, 0.001, 0]}
        args={[W, D]}
        cellSize={0.1}
        sectionSize={1}
        cellColor="#cdbfa9"
        sectionColor="#a8987f"
        cellThickness={0.5}
        sectionThickness={1}
        fadeDistance={60}
        raycast={() => null}
      />
      {defs.map(([x, z, w, d], i) => (
        <mesh
          key={i}
          ref={(m) => {
            walls.current[i] = m;
          }}
          position={[x, wallH / 2, z]}
          castShadow={!top}
          receiveShadow={!top}
          raycast={() => null}
        >
          <boxGeometry args={[w, wallH, d]} />
          <meshStandardMaterial color={top ? "#4a4540" : "#f6f3ee"} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}
