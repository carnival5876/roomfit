import type { SceneData } from "./types";
import { getProduct } from "./catalog";

// 서버에 저장하기 전에 장면 데이터를 검사한다. 클라이언트가 보낸 값은 그대로 믿지 않는다.

const MAX_ITEMS = 300;
const isNum = (v: unknown, min = -1e6, max = 1e6): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const isVec = (v: unknown) =>
  !!v && typeof v === "object" &&
  isNum((v as Record<string, unknown>).x) &&
  isNum((v as Record<string, unknown>).y) &&
  isNum((v as Record<string, unknown>).z);

export function parseScene(input: unknown): { ok: true; scene: SceneData } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "장면 데이터가 없습니다" };
  const s = input as Record<string, unknown>;
  if (s.schemaVersion !== 1) return { ok: false, error: "지원하지 않는 장면 버전입니다" };
  const room = s.room as Record<string, unknown> | undefined;
  if (!room || !isNum(room.width, 1, 20) || !isNum(room.depth, 1, 20) || !isNum(room.height, 2, 5))
    return { ok: false, error: "방 치수가 올바르지 않습니다" };
  if (!Array.isArray(s.items) || s.items.length > MAX_ITEMS)
    return { ok: false, error: "가구 목록이 올바르지 않습니다" };

  const items: SceneData["items"] = [];
  for (const raw of s.items) {
    const it = raw as Record<string, unknown>;
    if (typeof it?.id !== "string" || it.id.length > 64) return { ok: false, error: "가구 ID가 올바르지 않습니다" };
    if (typeof it.productId !== "string" || !getProduct(it.productId))
      return { ok: false, error: "카탈로그에 없는 상품이 있습니다" };
    if (!isVec(it.position) || !isVec(it.rotation) || !isVec(it.scale))
      return { ok: false, error: "가구 위치·회전값이 올바르지 않습니다" };
    const v = (o: unknown) => {
      const r = o as { x: number; y: number; z: number };
      return { x: r.x, y: r.y, z: r.z };
    };
    items.push({ id: it.id, productId: it.productId, position: v(it.position), rotation: v(it.rotation), scale: v(it.scale) });
  }
  return {
    ok: true,
    scene: {
      schemaVersion: 1,
      room: { width: room.width as number, depth: room.depth as number, height: room.height as number },
      items,
    },
  };
}

export const DEFAULT_SCENE: SceneData = {
  schemaVersion: 1,
  room: { width: 4.2, depth: 3.6, height: 2.4 },
  items: [],
};
