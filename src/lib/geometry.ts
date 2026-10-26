import type { PlacedItem, Product, Room, Warning } from "./types";

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

/** 배치된 모든 가구의 경고 계산. 배치를 막지 않고 경고만 반환한다. */
export function computeWarnings(
  room: Room,
  items: PlacedItem[],
  getProduct: (id: string) => Product | undefined,
): Record<string, Warning[]> {
  const result: Record<string, Warning[]> = {};
  const hw = room.width / 2, hd = room.depth / 2;
  const fps = items.map((it) => {
    const p = getProduct(it.productId);
    return p ? { it, p, fp: footprint(it, p) } : null;
  });

  for (const e of fps) {
    if (!e) continue;
    const w: Warning[] = [];
    const { it, p, fp } = e;
    const centerInside =
      Math.abs(it.position.x) <= hw && Math.abs(it.position.z) <= hd;
    const cornerOut = fp.some(
      (c) => Math.abs(c.x) > hw + EPS || Math.abs(c.z) > hd + EPS,
    );
    if (!centerInside) w.push({ kind: "outside", message: "방 바깥에 놓여 있습니다" });
    else if (cornerOut) w.push({ kind: "wall", message: "벽을 침범합니다" });
    if (p.height * it.scale.y > room.height + EPS)
      w.push({ kind: "too_tall", message: "천장보다 높습니다" });
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
