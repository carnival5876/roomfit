"use client";

import { useMemo, useRef } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import { Box3, Group, Mesh, Plane, Vector3 } from "three";
import type { PlacedItem, Product, Warning } from "@/lib/types";
import { toCm } from "@/lib/geometry";
import { useEditor } from "@/store/editorStore";

const FLOOR = new Plane(new Vector3(0, 1, 0), 0);
const SNAP_MOVE = 0.01; // 1cm
const SNAP_ROT = Math.PI / 12; // 15°

type Controls = { enabled: boolean } | null;

/**
 * GLB를 불러와 "바닥 중앙 = 원점"으로 정규화한다.
 * 상품 치수와 모델 치수가 1cm 이상 다르면 콘솔에 경고한다.
 */
function useNormalizedModel(product: Product) {
  const { scene } = useGLTF(product.modelUrl);
  return useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      if ((o as Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    clone.position.set(-center.x, -box.min.y, -center.z);
    const mismatch =
      Math.abs(size.x - product.width) > 0.01 ||
      Math.abs(size.y - product.height) > 0.01 ||
      Math.abs(size.z - product.depth) > 0.01;
    if (mismatch) {
      console.warn(
        `[Roomfit] 모델 치수 불일치: ${product.id}`,
        { model: size.toArray(), product: [product.width, product.height, product.depth] },
      );
    }
    const wrapper = new Group();
    wrapper.add(clone);
    return wrapper;
  }, [scene, product]);
}

export function FurnitureItem({
  item,
  product,
  selected,
  warnings,
}: {
  item: PlacedItem;
  product: Product;
  selected: boolean;
  warnings: Warning[];
}) {
  const model = useNormalizedModel(product);
  const controls = useThree((s) => s.controls) as unknown as Controls;
  const { select, updateItem, setDragging } = useEditor.getState();

  const drag = useRef<{ mode: "move" | "rotate"; offset: Vector3 } | null>(null);
  const hit = useRef(new Vector3());

  const begin = (mode: "move" | "rotate") => (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    select(item.id);
    if (!e.ray.intersectPlane(FLOOR, hit.current)) return;
    (e.target as unknown as Element).setPointerCapture(e.pointerId);
    drag.current = {
      mode,
      offset: new Vector3(item.position.x - hit.current.x, 0, item.position.z - hit.current.z),
    };
    if (controls) controls.enabled = false;
    setDragging(true);
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || !e.ray.intersectPlane(FLOOR, hit.current)) return;
    e.stopPropagation();
    if (d.mode === "move") {
      // 정수 연산으로 반올림해 0.35000000000000003 같은 부동소수 오차를 막는다
      const snap = (v: number) => Math.round(v / SNAP_MOVE) / (1 / SNAP_MOVE);
      updateItem(item.id, {
        position: {
          x: snap(hit.current.x + d.offset.x),
          y: 0,
          z: snap(hit.current.z + d.offset.z),
        },
      });
    } else {
      // 가구 정면(+Z)이 포인터를 향하도록
      let t = Math.atan2(hit.current.x - item.position.x, hit.current.z - item.position.z);
      if (!e.shiftKey) t = Math.round(t / SNAP_ROT) * SNAP_ROT;
      updateItem(item.id, { rotation: { x: 0, y: t, z: 0 } });
    }
  };

  const end = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    e.stopPropagation();
    (e.target as unknown as Element).releasePointerCapture(e.pointerId);
    drag.current = null;
    if (controls) controls.enabled = true;
    setDragging(false);
  };

  const hasWarning = warnings.length > 0;
  const accent = hasWarning ? "#e5484d" : "#2f6fed";
  const ringR = Math.max(product.width, product.depth) / 2 + 0.25;

  return (
    <group
      position={[item.position.x, item.position.y, item.position.z]}
      rotation={[0, item.rotation.y, 0]}
    >
      <group
        onPointerDown={begin("move")}
        onPointerMove={onMove}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "grab";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <primitive object={model} />
      </group>

      {/* 바닥 투영 표시: 선택 또는 경고 시 */}
      {(selected || hasWarning) && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.003} raycast={() => null}>
          <planeGeometry args={[product.width, product.depth]} />
          <meshBasicMaterial color={accent} transparent opacity={selected ? 0.18 : 0.12} depthWrite={false} />
        </mesh>
      )}

      {selected && (
        <>
          {/* 회전 링 + 정면 방향 핸들 */}
          <mesh rotation-x={-Math.PI / 2} position-y={0.004} raycast={() => null}>
            <ringGeometry args={[ringR - 0.012, ringR + 0.012, 96]} />
            <meshBasicMaterial color={accent} transparent opacity={0.6} depthWrite={false} />
          </mesh>
          <mesh
            position={[0, 0.05, ringR]}
            onPointerDown={begin("rotate")}
            onPointerMove={onMove}
            onPointerUp={end}
            onPointerCancel={end}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "alias";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "";
            }}
          >
            <sphereGeometry args={[0.07, 24, 16]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.3} />
          </mesh>

          <Html
            position={[0, product.height + 0.15, 0]}
            center
            style={{ pointerEvents: "none" }}
            zIndexRange={[10, 0]}
          >
            <div className="whitespace-nowrap rounded-md bg-neutral-900/85 px-2 py-1 text-[11px] font-medium text-white shadow">
              {toCm(product.width)} × {toCm(product.depth)} × {toCm(product.height)} cm
            </div>
          </Html>
        </>
      )}
    </group>
  );
}
