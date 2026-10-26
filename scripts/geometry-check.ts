// 충돌·벽 침범 판정 점검 스크립트
// 실행: npm run check:geometry
import { computeWarnings } from "../src/lib/geometry";
import { getProduct } from "../src/lib/catalog";
import type { PlacedItem, Warning } from "../src/lib/types";

const mk = (id: string, productId: string, x: number, z: number, ry = 0): PlacedItem => ({
  id, productId,
  position: { x, y: 0, z },
  rotation: { x: 0, y: ry, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
});
const room = { width: 4.2, depth: 3.6, height: 2.4 };
type K = Warning["kind"];

const cases: [string, PlacedItem[], Record<string, K[]>][] = [
  ["소파 중앙", [mk("a", "test-sofa-3p", 0, 0)], { a: [] }],
  ["소파 뒷벽에 딱 붙음", [mk("a", "test-sofa-3p", 0, -1.35)], { a: [] }],
  ["소파 벽 침범", [mk("a", "test-sofa-3p", 0, -1.4)], { a: ["wall"] }],
  ["소파 90° 회전, 오른쪽 벽에 딱 붙음", [mk("a", "test-sofa-3p", 1.65, 0, Math.PI / 2)], { a: [] }],
  ["소파 90° 회전, 벽 침범", [mk("a", "test-sofa-3p", 1.7, 0, Math.PI / 2)], { a: ["wall"] }],
  ["의자 방 바깥", [mk("a", "test-chair", 3, 0)], { a: ["outside"] }],
  ["소파+테이블 겹침", [mk("a", "test-sofa-3p", 0, 0), mk("b", "test-coffee-table", 0, 0.5)], { a: ["overlap"], b: ["overlap"] }],
  ["소파+테이블 맞닿음", [mk("a", "test-sofa-3p", 0, 0), mk("b", "test-coffee-table", 0, 0.7)], { a: [], b: [] }],
  ["러그 위 소파", [mk("a", "test-sofa-3p", 0, 0), mk("b", "test-rug", 0, 0)], { a: [], b: [] }],
  ["45° 의자 2개 (AABB면 오탐)", [mk("a", "test-chair", 0, 0, Math.PI / 4), mk("b", "test-chair", 0.36, 0.36, Math.PI / 4)], { a: [], b: [] }],
  ["책장 천장 낮은 방", [mk("a", "test-bookshelf", 0, 0)], { a: ["too_tall"] }],
];

let fail = 0;
for (const [name, items, expected] of cases) {
  const r = name === "책장 천장 낮은 방" ? { ...room, height: 1.7 } : room;
  const w = computeWarnings(r, items, getProduct);
  const got = Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v.map((x) => x.kind)]));
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (!ok) fail++;
  console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(got));
}
process.exit(fail ? 1 : 0);
