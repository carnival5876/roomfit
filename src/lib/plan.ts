import type { Opening, RoomShape, Vec2 } from "./types";

// 평면(방·벽·문·창문) 계산. three.js 와 무관한 순수 함수만 둔다.
//
// 규약
// - 방 다각형은 안쪽 벽면 기준, (x, z) 반시계(넓이 양수). 안쪽은 진행 방향 왼쪽, 바깥 법선 n = (dz, -dx)
// - 벽은 다각형 바깥쪽으로 WALL_THICKNESS 두께. 이웃한 방은 벽 두께만큼 떨어져 붙고, 그 벽은 한 번만 그린다
// - 문·창문은 (방, 벽 번호, 벽 시작점에서의 거리)로 저장한다

export const WALL_THICKNESS = 0.12;
export const EPS = 1e-6;
const SNAP_TOL = 0.02; // 2cm: 공유벽·문 위치 판정 허용 오차

// ---------- 벡터 ----------
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z });
export const mul = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, z: a.z * k });
export const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.z * b.z;
export const cross = (a: Vec2, b: Vec2) => a.x * b.z - a.z * b.x;
export const len = (a: Vec2) => Math.hypot(a.x, a.z);
export const dist = (a: Vec2, b: Vec2) => len(sub(a, b));
export const round2 = (v: number) => Math.round(v * 100) / 100; // 1cm

// ---------- 다각형 ----------
/** 신발끈 공식 넓이. (x, z) 반시계면 양수 */
export function signedArea(pts: Vec2[]) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a.x * b.z - b.x * a.z;
  }
  return s / 2;
}

export const area = (pts: Vec2[]) => Math.abs(signedArea(pts));

/** 반시계로 맞추고, 겹친 꼭짓점을 지운다 */
export function normalizePolygon(pts: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (const p of pts) {
    const q = { x: round2(p.x), z: round2(p.z) };
    const last = out[out.length - 1];
    if (!last || dist(last, q) > 0.005) out.push(q);
  }
  if (out.length > 1 && dist(out[0], out[out.length - 1]) <= 0.005) out.pop();
  return signedArea(out) < 0 ? out.reverse() : out;
}

export function pointInPolygon(p: Vec2, pts: Vec2[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** 두 선분이 서로 가로지르는지 (끝점 접촉은 제외) */
export function segmentsCross(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2) {
  const d1 = cross(sub(a2, a1), sub(b1, a1));
  const d2 = cross(sub(a2, a1), sub(b2, a1));
  const d3 = cross(sub(b2, b1), sub(a1, b1));
  const d4 = cross(sub(b2, b1), sub(a2, b1));
  return d1 * d2 < -EPS && d3 * d4 < -EPS;
}

/** 다각형 변끼리 서로 가로지르면(꼬인 모양) true */
export function selfIntersects(pts: Vec2[]) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsCross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

export function centroid(pts: Vec2[]): Vec2 {
  const a = signedArea(pts);
  if (Math.abs(a) < EPS) return mul(pts.reduce(add, { x: 0, z: 0 }), 1 / pts.length);
  let cx = 0, cz = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const f = p.x * q.z - q.x * p.z;
    cx += (p.x + q.x) * f;
    cz += (p.z + q.z) * f;
  }
  return { x: cx / (6 * a), z: cz / (6 * a) };
}

export function bounds(rooms: RoomShape[]) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const r of rooms)
    for (const p of r.points) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
  if (!isFinite(minX)) return { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
  return { minX, maxX, minZ, maxZ };
}

// ---------- 벽 ----------
export type Edge = {
  roomId: string;
  roomIndex: number;
  index: number;
  a: Vec2; // 안쪽 시작점
  b: Vec2; // 안쪽 끝점
  u: Vec2; // 진행 방향 단위벡터
  n: Vec2; // 바깥 법선 단위벡터
  length: number; // 안쪽 길이 (m)
  ao: Vec2; // 바깥 시작점 (모서리 맞춤)
  bo: Vec2; // 바깥 끝점
  height: number;
  /** 다른 방 벽과 겹쳐 그리지 않는 구간 [t0, t1] (m, a 기준) */
  hidden: [number, number][];
  /** 반대편에 다른 방이 붙어 있는 벽 (방 사이 벽) */
  shared: boolean;
};

export function roomEdges(room: RoomShape, roomIndex: number, T = WALL_THICKNESS): Edge[] {
  const pts = room.points;
  const n = pts.length;
  const normals = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const d = sub(q, p);
    const L = len(d) || 1;
    return { u: mul(d, 1 / L), n: { x: d.z / L, z: -d.x / L }, L };
  });
  // 꼭짓점 i 의 바깥 모서리점 (앞 벽 i-1, 뒷 벽 i 의 바깥면 교점)
  const outer = pts.map((p, i) => {
    const n1 = normals[(i - 1 + n) % n].n, n2 = normals[i].n;
    const k = 1 + dot(n1, n2);
    if (k < 0.05) return add(p, mul(n2, T)); // 거의 되돌아가는 모서리
    return add(p, mul(add(n1, n2), T / k));
  });
  return pts.map((p, i) => ({
    roomId: room.id,
    roomIndex,
    index: i,
    a: p,
    b: pts[(i + 1) % n],
    u: normals[i].u,
    n: normals[i].n,
    length: normals[i].L,
    ao: outer[i],
    bo: outer[(i + 1) % n],
    height: room.height,
    hidden: [],
    shared: false,
  }));
}

/**
 * 모든 방의 벽. 이웃한 방과 맞닿은 구간(한 방의 바깥면 = 다른 방의 안쪽 벽면)은
 * 앞 순서 방의 벽만 남기고 뒤 순서 방의 벽은 hidden 으로 표시한다.
 */
export function allEdges(rooms: RoomShape[], T = WALL_THICKNESS): Edge[] {
  const edges = rooms.flatMap((r, i) => roomEdges(r, i, T));
  for (const e of edges) {
    for (const f of edges) {
      if (f.roomIndex >= e.roomIndex) continue; // 앞 순서 방(f)이 벽을 가진다
      if (dot(e.u, f.u) > -0.999) continue; // 서로 반대 방향이어야 함
      const s = dot(sub(e.a, f.a), f.n); // e 가 f 의 바깥면 위에 있는가
      if (Math.abs(s - T) > SNAP_TOL || Math.abs(dot(sub(e.b, f.a), f.n) - T) > SNAP_TOL) continue;
      const t0 = dot(sub(f.a, e.a), e.u), t1 = dot(sub(f.b, e.a), e.u);
      const lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(e.length, Math.max(t0, t1));
      if (hi - lo > SNAP_TOL) {
        e.hidden.push([lo, hi]);
        f.shared = true;
      }
    }
    e.hidden = mergeIntervals(e.hidden);
  }
  return edges;
}

function mergeIntervals(iv: [number, number][]): [number, number][] {
  const s = [...iv].sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  for (const r of s) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + EPS) last[1] = Math.max(last[1], r[1]);
    else out.push([...r]);
  }
  return out;
}

function subtractIntervals(base: [number, number], cut: [number, number][]): [number, number][] {
  let parts: [number, number][] = [base];
  for (const [c0, c1] of cut) {
    parts = parts.flatMap(([p0, p1]) => {
      if (c1 <= p0 || c0 >= p1) return [[p0, p1] as [number, number]];
      const r: [number, number][] = [];
      if (c0 > p0) r.push([p0, c0]);
      if (c1 < p1) r.push([c1, p1]);
      return r;
    });
  }
  return parts.filter(([p0, p1]) => p1 - p0 > 0.001);
}

/**
 * 3D 에서 방 안이 보이도록 숨길 벽인지: 카메라가 벽 바깥쪽에 있는 바깥벽.
 * 방 사이 벽은 숨기지 않는다.
 */
export function cutawayHidden(e: Edge, cam: { x: number; y: number; z: number }, T = WALL_THICKNESS) {
  if (e.shared) return false;
  const outside = dot(sub({ x: cam.x, z: cam.z }, e.a), e.n) > T;
  return outside && cam.y < e.height * 4;
}

// ---------- 문·창문 ----------
export const OPENING_DEFAULTS = {
  door: { width: 0.9, height: 2.1, sill: 0 },
  window: { width: 1.2, height: 1.2, sill: 0.9 },
} as const;

/** 문·창문이 벽 안에 들어가도록 위치·크기를 맞춘다 */
export function clampOpening(o: Opening, edgeLength: number, wallHeight: number): Opening {
  const width = Math.min(Math.max(o.width, 0.3), Math.max(0.3, edgeLength - 0.1));
  const sill = o.kind === "door" ? 0 : Math.min(Math.max(o.sill, 0), wallHeight - 0.3);
  const height = Math.min(Math.max(o.height, 0.3), wallHeight - sill - 0.05);
  const half = width / 2 + 0.05;
  const offset = edgeLength < 2 * half ? edgeLength / 2 : Math.min(Math.max(o.offset, half), edgeLength - half);
  return { ...o, width: round2(width), height: round2(height), sill: round2(sill), offset: round2(offset) };
}

/** 문·창문이 있는 벽(원래 방 기준)의 안쪽 가운데 점과 방향 */
export function openingFrame(o: Opening, rooms: RoomShape[]) {
  const ri = rooms.findIndex((r) => r.id === o.roomId);
  if (ri < 0) return null;
  const room = rooms[ri];
  if (o.edge < 0 || o.edge >= room.points.length) return null;
  const a = room.points[o.edge], b = room.points[(o.edge + 1) % room.points.length];
  const d = sub(b, a);
  const L = len(d);
  if (L < EPS) return null;
  const u = mul(d, 1 / L);
  return { center: add(a, mul(u, o.offset)), u, n: { x: u.z, z: -u.x }, length: L, room };
}

export type WallPiece = {
  edge: Edge;
  quad: [Vec2, Vec2, Vec2, Vec2]; // 안쪽 a, 안쪽 b, 바깥 b, 바깥 a
  y0: number;
  y1: number;
};

export type OpeningPlacement = {
  opening: Opening;
  edge: Edge; // 실제로 구멍이 난(그려진) 벽
  t: number; // edge.a 에서 가운데까지
  center: Vec2; // 벽 두께 가운데
  angle: number; // three.js rotation.y (로컬 +X 가 벽 방향)
};

/** 그릴 벽 조각과 문·창문 위치를 만든다 */
export function buildWalls(rooms: RoomShape[], openings: Opening[], T = WALL_THICKNESS) {
  const edges = allEdges(rooms, T);
  const pieces: WallPiece[] = [];
  const placements: OpeningPlacement[] = [];

  const frames = openings.map((o) => ({ o, f: openingFrame(o, rooms) }));

  for (const e of edges) {
    const visible = subtractIntervals([0, e.length], e.hidden);
    if (!visible.length) continue;

    // 이 벽(두께 안)에 있는 문·창문: 이 방 것 + 맞닿은 이웃 방 것
    const holes: { o: Opening; t0: number; t1: number }[] = [];
    for (const { o, f } of frames) {
      if (!f || Math.abs(cross(f.u, e.u)) > 0.01) continue;
      const s = dot(sub(f.center, e.a), e.n);
      if (s < -SNAP_TOL || s > T + SNAP_TOL) continue;
      const t = dot(sub(f.center, e.a), e.u);
      if (t < -EPS || t > e.length + EPS) continue;
      if (!visible.some(([v0, v1]) => t >= v0 - EPS && t <= v1 + EPS)) continue;
      const h = Math.min(o.width / 2, t, e.length - t);
      holes.push({ o, t0: t - h, t1: t + h });
      placements.push({
        opening: o,
        edge: e,
        t,
        center: add(add(e.a, mul(e.u, t)), mul(e.n, T / 2)),
        angle: -Math.atan2(e.u.z, e.u.x),
      });
    }

    const H = e.height;
    const quadAt = (t0: number, t1: number): WallPiece["quad"] => {
      const a = add(e.a, mul(e.u, t0)), b = add(e.a, mul(e.u, t1));
      const ao = t0 <= EPS ? e.ao : add(a, mul(e.n, T));
      const bo = t1 >= e.length - EPS ? e.bo : add(b, mul(e.n, T));
      return [a, b, bo, ao];
    };

    for (const v of visible) {
      for (const [p0, p1] of subtractIntervals(v, holes.map((h) => [h.t0, h.t1]))) {
        pieces.push({ edge: e, quad: quadAt(p0, p1), y0: 0, y1: H });
      }
      for (const h of holes) {
        const t0 = Math.max(h.t0, v[0]), t1 = Math.min(h.t1, v[1]);
        if (t1 - t0 < 0.001) continue;
        const bottom = h.o.kind === "door" ? 0 : h.o.sill;
        const top = Math.min(H, bottom + h.o.height);
        if (bottom > 0.001) pieces.push({ edge: e, quad: quadAt(t0, t1), y0: 0, y1: bottom });
        if (top < H - 0.001) pieces.push({ edge: e, quad: quadAt(t0, t1), y0: top, y1: H });
      }
    }
  }
  return { edges, pieces, placements };
}

// ---------- 방 만들기 ----------
export function rectPoints(x: number, z: number, w: number, d: number): Vec2[] {
  return normalizePolygon([
    { x, z },
    { x: x + w, z },
    { x: x + w, z: z + d },
    { x, z: z + d },
  ]);
}

/** ㄱ자: 전체 w×d 에서 한쪽 모서리 cw×cd 를 잘라낸 모양 */
export function lShapePoints(x: number, z: number, w: number, d: number, cw: number, cd: number): Vec2[] {
  return normalizePolygon([
    { x, z },
    { x: x + w - cw, z },
    { x: x + w - cw, z: z + cd },
    { x: x + w, z: z + cd },
    { x: x + w, z: z + d },
    { x, z: z + d },
  ]);
}

/** 벽 바깥쪽에 벽 두께만큼 띄워 붙는 새 직사각형 방 */
export function roomBesideEdge(e: Edge, depth: number, T = WALL_THICKNESS): Vec2[] {
  const a = add(e.a, mul(e.n, T)), b = add(e.b, mul(e.n, T));
  return normalizePolygon([a, b, add(b, mul(e.n, depth)), add(a, mul(e.n, depth))]);
}

export type SnapGuide = { a: Vec2; b: Vec2 };

type SnapCand = {
  corr: Vec2; // 이동량 보정
  d: number; // 보정 크기 (작을수록 우선)
  dir: Vec2; // 보정 방향 (같은 방향은 한 번만 적용)
  guide: (finalDelta: Vec2) => SnapGuide; // 맞춘 뒤 보여 줄 안내선
};

/** f 의 직선(offset 만큼 바깥) 위에서 f 와 e 를 모두 덮는 구간 */
function lineGuide(f: Edge, offset: number, e: Edge, d: Vec2): SnapGuide {
  const base = add(f.a, mul(f.n, offset));
  const ts = [0, f.length, dot(sub(add(e.a, d), f.a), f.u), dot(sub(add(e.b, d), f.a), f.u)];
  const lo = Math.min(...ts) - 0.3, hi = Math.max(...ts) + 0.3;
  return { a: add(base, mul(f.u, lo)), b: add(base, mul(f.u, hi)) };
}

/**
 * 방을 옮길 때 다른 방에 맞춰 이동량을 보정한다 (자석처럼).
 * - 마주 보는 벽: 벽 두께만큼 띄워 정확히 붙임
 * - 같은 방향 벽: 일직선으로 맞춤 (예: 두 방의 윗벽 라인)
 * - 모서리: 다른 방 꼭짓점과 가로·세로 위치 맞춤
 * 서로 다른 두 방향까지 적용하고, 맞춘 위치를 안내선으로 돌려준다.
 */
export function snapRoomMove(
  moving: RoomShape,
  others: RoomShape[],
  delta: Vec2,
  tol = 0.2,
  T = WALL_THICKNESS,
): { delta: Vec2; guides: SnapGuide[] } {
  const moved: RoomShape = { ...moving, points: moving.points.map((p) => add(p, delta)) };
  const me = roomEdges(moved, 0, T);
  const oe = others.flatMap((r, i) => roomEdges(r, i + 1, T));
  const cands: SnapCand[] = [];

  for (const e of me) {
    for (const f of oe) {
      const c = dot(e.u, f.u);
      if (c < -0.999) {
        // 마주 보는 벽 → 붙이기
        const s = dot(sub(e.a, f.a), f.n) - T;
        if (Math.abs(s) > tol) continue;
        const t0 = dot(sub(f.a, e.a), e.u), t1 = dot(sub(f.b, e.a), e.u);
        if (Math.min(e.length, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) < -tol) continue;
        const corr = mul(f.n, -s);
        cands.push({ corr, d: Math.abs(s), dir: f.n, guide: (fd) => lineGuide(f, T, e, sub(fd, delta)) });
      } else if (c > 0.999) {
        // 같은 방향 벽 → 일직선 맞추기 (가까운 벽만)
        const s = dot(sub(e.a, f.a), f.n);
        if (Math.abs(s) > tol) continue;
        const corr = mul(f.n, -s);
        cands.push({ corr, d: Math.abs(s) + 0.005, dir: f.n, guide: (fd) => lineGuide(f, 0, e, sub(fd, delta)) });
      }
    }
  }
  // 꼭짓점 가로·세로 맞추기. 벽 맞추기가 있는 방향에서는 쓰지 않도록 순위를 크게 낮춘다
  // (벽끼리 붙어야 할 때 꼭짓점을 맞추면 벽이 겹친다)
  const otherPts = others.flatMap((r) => r.points);
  for (const p of moved.points) {
    for (const q of otherPts) {
      const dx = q.x - p.x, dz = q.z - p.z;
      if (Math.abs(dx) <= tol)
        cands.push({ corr: { x: dx, z: 0 }, d: Math.abs(dx) + 1, dir: { x: 1, z: 0 },
          guide: (fd) => ({ a: q, b: add(p, sub(fd, delta)) }) });
      if (Math.abs(dz) <= tol)
        cands.push({ corr: { x: 0, z: dz }, d: Math.abs(dz) + 1, dir: { x: 0, z: 1 },
          guide: (fd) => ({ a: q, b: add(p, sub(fd, delta)) }) });
    }
  }

  cands.sort((p, q) => p.d - q.d);
  let out = delta;
  const chosen: SnapCand[] = [];
  for (const c of cands) {
    if (chosen.some((u) => Math.abs(cross(u.dir, c.dir)) < 0.1)) continue; // 같은 방향은 한 번만
    out = add(out, c.corr);
    chosen.push(c);
    if (chosen.length >= 2) break;
  }
  const final = { x: round2(out.x), z: round2(out.z) };
  return { delta: final, guides: chosen.map((c) => c.guide(final)) };
}

/** 꼭짓점을 옮길 때: 1cm 단위 + 이웃 꼭짓점, 다른 방 꼭짓점과 가로·세로 줄맞춤 */
export function snapVertex(p: Vec2, prev: Vec2, next: Vec2, tol = 0.08, others: Vec2[] = []): Vec2 {
  let { x, z } = p;
  let bx = tol, bz = tol;
  for (const q of [prev, next]) {
    if (Math.abs(p.x - q.x) < bx) { x = q.x; bx = Math.abs(p.x - q.x); }
    if (Math.abs(p.z - q.z) < bz) { z = q.z; bz = Math.abs(p.z - q.z); }
  }
  for (const q of others) {
    if (Math.abs(p.x - q.x) < bx) { x = q.x; bx = Math.abs(p.x - q.x); }
    if (Math.abs(p.z - q.z) < bz) { z = q.z; bz = Math.abs(p.z - q.z); }
  }
  return { x: round2(x), z: round2(z) };
}
