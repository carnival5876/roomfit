import type { PlacedItem, Product, RoomShape, Warning } from "./types";
import { pointInPolygon, segmentsCross } from "./plan";

type P2 = { x: number; z: number };

const EPS = 0.001; // 1mm 이하 접촉은 겹침으로 보지 않음

/** 가구의 바닥 투영(회전된 사각형) 꼭짓점 4개 */
export function footprint(item: PlacedItem, product: Product): P2[] {
  const hw = (product.width * item.scale.x) / 2;
  const hd = (product.depth * item.scale.z) / 2;
  const t = item.rotation.y;
  const c = Math.cos(t), s = Math.sin(t);
  // three.js Y축 회전: (x, z) -> (x cos + z sin, -x sin + z cos)
  return [
    [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd],
  ].map(([lx, lz]) => ({
    x: item.position.x + lx * c + lz * s,
    z: item.position.z - lx * s + lz * c,
  }));
}

function project(poly: P2[], ax: P2) {
  let min = Infinity, max = -Infinity;
  for (const p of poly) {
    const d = p.x * ax.x + p.z * ax.z;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max] as const;
}

/** 분리축 정리(SAT)로 두 볼록 사각형의 겹침 판정 */
export function polygonsOverlap(a: P2[], b: P2[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
      const ax = { x: -(p2.z - p1.z), z: p2.x - p1.x };
      const len = Math.hypot(ax.x, ax.z) || 1;
      ax.x /= len; ax.z /= len;
      const [amin, amax] = project(a, ax);
      const [bmin, bmax] = project(b, ax);
      if (amax <= bmin + EPS || bmax <= amin + EPS) return false;
    }
  }
  return true;
}

/** 바닥 투영을 가운데 쪽으로 1mm 줄인다 (벽에 딱 붙은 가구를 침범으로 보지 않도록) */
function shrink(fp: P2[], by = 0.001): P2[] {
  const cx = fp.reduce((s, p) => s + p.x, 0) / fp.length;
  const cz = fp.reduce((s, p) => s + p.z, 0) / fp.length;
  return fp.map((p) => {
    const dx = p.x - cx, dz = p.z - cz;
    const L = Math.hypot(dx, dz) || 1;
    return { x: p.x - (dx / L) * by, z: p.z - (dz / L) * by };
  });
}

/** 가구 바닥 투영이 방 안에 온전히 들어가는지 (꺾인 방·대각선 벽 포함) */
function fitsInRoom(fp: P2[], room: RoomShape) {
  const pts = room.points;
  if (!fp.every((c) => pointInPolygon(c, pts))) return false;
  // ㄱ자 안쪽 모서리처럼 벽이 가구 안으로 파고드는 경우
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    for (let j = 0; j < fp.length; j++) if (segmentsCross(a, b, fp[j], fp[(j + 1) % fp.length])) return false;
    if (pointInPolygon(a, fp)) return false;
  }
  return true;
}

/** 배치된 모든 가구의 경고 계산. 배치를 막지 않고 경고만 반환한다. */
export function computeWarnings(
  rooms: RoomShape[],
  items: PlacedItem[],
  getProduct: (id: string) => Product | undefined,
): Record<string, Warning[]> {
  const result: Record<string, Warning[]> = {};
  const fps = items.map((it) => {
    const p = getProduct(it.productId);
    return p ? { it, p, fp: footprint(it, p) } : null;
  });

  for (const e of fps) {
    if (!e) continue;
    const w: Warning[] = [];
    const { it, p, fp } = e;
    const center = { x: it.position.x, z: it.position.z };
    const room = rooms.find((r) => pointInPolygon(center, r.points));
    if (!room) w.push({ kind: "outside", message: "방 바깥에 놓여 있습니다" });
    else {
      if (!fitsInRoom(shrink(fp), room)) w.push({ kind: "wall", message: "벽을 침범합니다" });
      if (p.height * it.scale.y > room.height + EPS) w.push({ kind: "too_tall", message: "천장보다 높습니다" });
    }
    result[it.id] = w;
  }

  for (let i = 0; i < fps.length; i++) {
    for (let j = i + 1; j < fps.length; j++) {
      const a = fps[i], b = fps[j];
      if (!a || !b || !a.p.collides || !b.p.collides) continue;
      if (polygonsOverlap(a.fp, b.fp)) {
        result[a.it.id].push({ kind: "overlap", message: `${b.p.name}와(과) 겹칩니다` });
        result[b.it.id].push({ kind: "overlap", message: `${a.p.name}와(과) 겹칩니다` });
      }
    }
  }
  return result;
}

export const toCm = (m: number) => Math.round(m * 100);
export const radToDeg = (r: number) => {
  const d = Math.round((r * 180) / Math.PI) % 360;
  return d < 0 ? d + 360 : d;
};
export const degToRad = (d: number) => (d * Math.PI) / 180;
