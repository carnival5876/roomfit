"use client";

import { useRef } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Plane, Vector3 } from "three";
import { useEditor } from "@/store/editorStore";

const FLOOR = new Plane(new Vector3(0, 1, 0), 0);
type Controls = { enabled: boolean } | null;

/**
 * 바닥 위에서 끌기. 시작점 대비 이동량(x, z)을 onMove 로 넘긴다.
 * 끄는 동안 카메라 조작을 끄고, 끝나면 다시 켠다.
 */
export function useFloorDrag(handlers: {
  onStart?: (p: Vector3) => void;
  onMove: (delta: { x: number; z: number }, p: Vector3, e: ThreeEvent<PointerEvent>) => void;
  onEnd?: (moved: boolean) => void;
}) {
  const controls = useThree((s) => s.controls) as unknown as Controls;
  const start = useRef<Vector3 | null>(null);
  const moved = useRef(false);
  const hit = useRef(new Vector3());

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (!e.ray.intersectPlane(FLOOR, hit.current)) return;
    (e.target as unknown as Element).setPointerCapture(e.pointerId);
    start.current = hit.current.clone();
    moved.current = false;
    if (controls) controls.enabled = false;
    useEditor.getState().setDragging(true);
    handlers.onStart?.(start.current);
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!start.current || !e.ray.intersectPlane(FLOOR, hit.current)) return;
    e.stopPropagation();
    const d = { x: hit.current.x - start.current.x, z: hit.current.z - start.current.z };
    if (!moved.current && Math.hypot(d.x, d.z) < 0.01) return;
    moved.current = true;
    handlers.onMove(d, hit.current, e);
  };
  const end = (e: ThreeEvent<PointerEvent>) => {
    if (!start.current) return;
    e.stopPropagation();
    (e.target as unknown as Element).releasePointerCapture(e.pointerId);
    start.current = null;
    if (controls) controls.enabled = true;
    useEditor.getState().setDragging(false);
    handlers.onEnd?.(moved.current);
  };
  return { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end };
}
