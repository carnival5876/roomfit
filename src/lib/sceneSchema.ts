import type { Opening, PlacedItem, RoomShape, SceneData, Vec2 } from "./types";
import { getProduct } from "./catalog";
import { area, clampOpening, normalizePolygon, rectPoints, selfIntersects } from "./plan";

// 장면 데이터 검사·변환. 서버는 저장 전에, 앱은 불러올 때 쓴다.
// 예전 형식(schemaVersion 1, 직사각형 방 하나)은 새 형식(2)으로 바꾼다.

export const LIMITS = {
  rooms: 30,
  points: 64,
  openings: 300,
  items: 300,
  coord: 200, // ±200m
  heightMin: 2,
  heightMax: 5,
  roomAreaMin: 0.5, // ㎡
};

const isNum = (v: unknown, min = -1e6, max = 1e6): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;
const isVec3 = (v: unknown) => {
  const r = v as Record<string, unknown> | null;
  return !!r && typeof r === "object" && isNum(r.x) && isNum(r.y) && isNum(r.z);
};
const v3 = (o: unknown) => {
  const r = o as { x: number; y: number; z: number };
  return { x: r.x, y: r.y, z: r.z };
};

type Result = { ok: true; scene: SceneData } | { ok: false; error: string };

/** 예전 직사각형 방 → 가운데가 원점인 방 하나 (가구 좌표는 그대로 맞는다) */
function fromV1(s: Record<string, unknown>): Result {
  const room = s.room as Record<string, unknown> | undefined;
  if (!room || !isNum(room.width, 1, 20) || !isNum(room.depth, 1, 20) || !isNum(room.height, 2, 5))
    return { ok: false, error: "방 치수가 올바르지 않습니다" };
  const w = room.width as number, d = room.depth as number;
  return parseScene({
    schemaVersion: 2,
    rooms: [{ id: "room-1", name: "거실", points: rectPoints(-w / 2, -d / 2, w, d), height: room.height }],
    openings: [],
    items: s.items,
  });
}

export function parseScene(input: unknown): Result {
  if (!input || typeof input !== "object") return { ok: false, error: "장면 데이터가 없습니다" };
  const s = input as Record<string, unknown>;
  if (s.schemaVersion === 1) return fromV1(s);
  if (s.schemaVersion !== 2) return { ok: false, error: "지원하지 않는 장면 버전입니다" };

  // 방
  if (!Array.isArray(s.rooms) || s.rooms.length === 0 || s.rooms.length > LIMITS.rooms)
    return { ok: false, error: "방이 하나 이상 있어야 합니다" };
  const rooms: RoomShape[] = [];
  const roomIds = new Set<string>();
  for (const raw of s.rooms) {
    const r = raw as Record<string, unknown>;
    if (!isId(r?.id) || roomIds.has(r.id)) return { ok: false, error: "방 ID가 올바르지 않습니다" };
    if (!isNum(r.height, LIMITS.heightMin, LIMITS.heightMax)) return { ok: false, error: "천장 높이가 올바르지 않습니다" };
    if (!Array.isArray(r.points) || r.points.length < 3 || r.points.length > LIMITS.points)
      return { ok: false, error: "방 모양이 올바르지 않습니다" };
    const pts: Vec2[] = [];
    for (const p of r.points) {
      const q = p as Record<string, unknown>;
      if (!isNum(q?.x, -LIMITS.coord, LIMITS.coord) || !isNum(q.z, -LIMITS.coord, LIMITS.coord))
        return { ok: false, error: "방 꼭짓점 좌표가 올바르지 않습니다" };
      pts.push({ x: q.x as number, z: q.z as number });
    }
    const points = normalizePolygon(pts);
    if (points.length < 3 || area(points) < LIMITS.roomAreaMin || selfIntersects(points))
      return { ok: false, error: "방 모양이 꼬여 있거나 너무 작습니다" };
    roomIds.add(r.id);
    rooms.push({ id: r.id, name: String(r.name ?? "방").slice(0, 30) || "방", points, height: r.height });
  }

  // 문·창문
  const openings: Opening[] = [];
  const rawOpenings = s.openings ?? [];
  if (!Array.isArray(rawOpenings) || rawOpenings.length > LIMITS.openings)
    return { ok: false, error: "문·창문 목록이 올바르지 않습니다" };
  for (const raw of rawOpenings) {
    const o = raw as Record<string, unknown>;
    if (!isId(o?.id) || (o.kind !== "door" && o.kind !== "window")) return { ok: false, error: "문·창문 정보가 올바르지 않습니다" };
    const room = rooms.find((r) => r.id === o.roomId);
    if (!room || !Number.isInteger(o.edge) || (o.edge as number) < 0 || (o.edge as number) >= room.points.length) continue; // 벽이 사라졌으면 버림
    if (!isNum(o.offset, 0, 1000) || !isNum(o.width, 0.1, 20) || !isNum(o.height, 0.1, 5) || !isNum(o.sill, 0, 5))
      return { ok: false, error: "문·창문 크기가 올바르지 않습니다" };
    const a = room.points[o.edge as number], b = room.points[((o.edge as number) + 1) % room.points.length];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    openings.push(
      clampOpening(
        { id: o.id, kind: o.kind, roomId: room.id, edge: o.edge as number, offset: o.offset, width: o.width, height: o.height, sill: o.sill },
        L,
        room.height,
      ),
    );
  }

  // 가구
  if (!Array.isArray(s.items) || s.items.length > LIMITS.items) return { ok: false, error: "가구 목록이 올바르지 않습니다" };
  const items: PlacedItem[] = [];
  for (const raw of s.items) {
    const it = raw as Record<string, unknown>;
    if (!isId(it?.id)) return { ok: false, error: "가구 ID가 올바르지 않습니다" };
    if (typeof it.productId !== "string" || !getProduct(it.productId))
      return { ok: false, error: "카탈로그에 없는 상품이 있습니다" };
    if (!isVec3(it.position) || !isVec3(it.rotation) || !isVec3(it.scale))
      return { ok: false, error: "가구 위치·회전값이 올바르지 않습니다" };
    items.push({ id: it.id, productId: it.productId, position: v3(it.position), rotation: v3(it.rotation), scale: v3(it.scale) });
  }

  return { ok: true, scene: { schemaVersion: 2, rooms, openings, items } };
}

export const DEFAULT_SCENE: SceneData = {
  schemaVersion: 2,
  rooms: [{ id: "room-1", name: "거실", points: rectPoints(-2.1, -1.8, 4.2, 3.6), height: 2.4 }],
  openings: [],
  items: [],
};
