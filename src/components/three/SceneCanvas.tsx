"use client";

import { Suspense, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
  useGLTF,
} from "@react-three/drei";
import { PlanMesh } from "./PlanMesh";
import { StructureHandles } from "./StructureHandles";
import { bounds } from "@/lib/plan";
import { FurnitureItem } from "./FurnitureItem";
import { useEditor } from "@/store/editorStore";
import { CATALOG, getProduct } from "@/lib/catalog";
import type { Warning } from "@/lib/types";

CATALOG.forEach((p) => useGLTF.preload(p.modelUrl));

function Cameras() {
  const viewMode = useEditor((s) => s.viewMode);
  const fitVersion = useEditor((s) => s.fitVersion);
  const inset = useEditor((s) => s.bottomInset);
  const size = useThree((s) => s.size);
  // 방을 고치는 중에는 카메라를 그대로 두고, 시점 전환·방 추가·불러오기 때만 집 전체에 맞춘다
  const frame = useMemo(() => {
    const b = bounds(useEditor.getState().rooms);
    const w = b.maxX - b.minX, d = b.maxZ - b.minZ;
    return { cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2, w, d, span: Math.max(w, d, 3) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, fitVersion, inset]);
  const key = `${viewMode}-${fitVersion}-${inset}`;

  if (viewMode === "top") {
    // 아래 패널에 가려지는 부분을 빼고 맞춘 뒤, 보이는 영역 가운데로 올린다
    const visibleH = Math.max(120, size.height - inset);
    const zoom = Math.min(size.width / (frame.w + 1.6), visibleH / (frame.d + 2.0));
    const tz = frame.cz + inset / 2 / zoom;
    return (
      <>
        <OrthographicCamera key={key} makeDefault position={[frame.cx, 40, tz + 0.0001]} zoom={zoom} near={0.1} far={200} />
        <OrbitControls
          key={key}
          makeDefault
          enableRotate={false}
          target={[frame.cx, 0, tz]}
          minZoom={zoom * 0.3}
          maxZoom={zoom * 8}
        />
      </>
    );
  }
  const { cx, cz } = frame;
  // 세로로 긴 화면(휴대폰)에서는 집 전체가 들어오도록 더 멀리서 본다
  const aspect = size.width / Math.max(1, size.height - inset);
  const span = frame.span * Math.max(1, 1.15 / aspect);
  return (
    <>
      <PerspectiveCamera
        key={key}
        makeDefault
        fov={45}
        position={[cx + span * 0.9, span * 1.1, cz + span * 1.3]}
        near={0.05}
        far={400}
      />
      <OrbitControls
        key={key}
        makeDefault
        target={[cx, 0.6, cz]}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={1}
        maxDistance={span * 4}
        enableDamping
      />
    </>
  );
}

export function SceneCanvas({ warnings }: { warnings: Record<string, Warning[]> }) {
  const items = useEditor((s) => s.items);
  const selectedId = useEditor((s) => s.selectedId);
  const mode = useEditor((s) => s.mode);

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      onPointerMissed={(e) => {
        if (e.button !== 0) return;
        const st = useEditor.getState();
        st.select(null);
        st.selectStruct(null);
      }}
      gl={{ preserveDrawingBuffer: true }}
    >
      <color attach="background" args={["#efece6"]} />
      <Cameras />
      <hemisphereLight args={["#ffffff", "#d8cbb6", 0.9]} />
      <directionalLight
        position={[3, 6, 4]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.0005}
      />
      <PlanMesh />
      <StructureHandles />
      <Suspense fallback={null}>
        {items.map((it) => {
          const p = getProduct(it.productId);
          if (!p) return null;
          return (
            <FurnitureItem
              key={it.id}
              item={it}
              product={p}
              selected={it.id === selectedId}
              warnings={warnings[it.id] ?? []}
              interactive={mode === "furniture"}
            />
          );
        })}
      </Suspense>
    </Canvas>
  );
}
