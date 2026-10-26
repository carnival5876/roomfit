"use client";

import { Suspense } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
  useGLTF,
} from "@react-three/drei";
import { RoomMesh } from "./RoomMesh";
import { FurnitureItem } from "./FurnitureItem";
import { useEditor } from "@/store/editorStore";
import { CATALOG, getProduct } from "@/lib/catalog";
import type { Warning } from "@/lib/types";

CATALOG.forEach((p) => useGLTF.preload(p.modelUrl));

function Cameras() {
  const viewMode = useEditor((s) => s.viewMode);
  const room = useEditor((s) => s.room);
  const size = useThree((s) => s.size);
  const span = Math.max(room.width, room.depth);

  if (viewMode === "top") {
    const zoom = Math.min(size.width / (room.width + 1.2), size.height / (room.depth + 1.2));
    return (
      <>
        <OrthographicCamera makeDefault position={[0, 30, 0.0001]} zoom={zoom} near={0.1} far={100} />
        <OrbitControls
          key="top"
          makeDefault
          enableRotate={false}
          target={[0, 0, 0]}
          minZoom={zoom * 0.5}
          maxZoom={zoom * 6}
        />
      </>
    );
  }
  return (
    <>
      <PerspectiveCamera
        makeDefault
        fov={45}
        position={[span * 0.9, span * 1.1, span * 1.3]}
        near={0.05}
        far={200}
      />
      <OrbitControls
        key="3d"
        makeDefault
        target={[0, 0.6, 0]}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={1}
        maxDistance={span * 4}
        enableDamping
      />
    </>
  );
}

export function SceneCanvas({ warnings }: { warnings: Record<string, Warning[]> }) {
  const room = useEditor((s) => s.room);
  const items = useEditor((s) => s.items);
  const selectedId = useEditor((s) => s.selectedId);
  const select = useEditor((s) => s.select);

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      onPointerMissed={(e) => {
        if (e.button === 0) select(null);
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
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0005}
      />
      <RoomMesh room={room} />
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
            />
          );
        })}
      </Suspense>
    </Canvas>
  );
}
