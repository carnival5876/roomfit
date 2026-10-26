// 충돌·벽 침범·평면 계산 점검 스크립트
// 실행: npm run check:geometry
import { computeWarnings } from "../src/lib/geometry";
import { getProduct } from "../src/lib/catalog";
import { parseScene } from "../src/lib/sceneSchema";
import {
  WALL_THICKNESS as T, allEdges, area, normalizePolygon, buildWalls, lShapePoints, rectPoints, roomBesideEdge, selfIntersects,
  signedArea, snapRoomMove,
} from "../src/lib/plan";
import type { Opening, PlacedItem, RoomShape, Warning } from "../src/lib/types";
import { useEditor } from "../src/store/editorStore";

let fail = 0;
const check = (name: string, ok: boolean, info = "") => {
  if (!ok) fail++;
  console.log(ok ? "PASS" : "FAIL", name, ok ? "" : info);
};
const near = (a: number, b: number, e = 1e-3) => Math.abs(a - b) < e;

const mk = (id: string, productId: string, x: number, z: number, ry = 0): PlacedItem => ({
  id, productId,
  position: { x, y: 0, z },
  rotation: { x: 0, y: ry, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
});
const room = (id: string, points = rectPoints(-2.1, -1.8, 4.2, 3.6), height = 2.4): RoomShape => ({ id, name: id, points, height });
type K = Warning["kind"];

// ---------- 가구 경고 (직사각형 방 4.2 × 3.6, 가운데 원점) ----------
const R1 = [room("r1")];
const cases: [string, RoomShape[], PlacedItem[], Record<string, K[]>][] = [
  ["소파 중앙", R1, [mk("a", "test-sofa-3p", 0, 0)], { a: [] }],
  ["소파 뒷벽에 딱 붙음", R1, [mk("a", "test-sofa-3p", 0, -1.35)], { a: [] }],
  ["소파 벽 침범", R1, [mk("a", "test-sofa-3p", 0, -1.4)], { a: ["wall"] }],
  ["소파 90° 회전, 오른쪽 벽에 딱 붙음", R1, [mk("a", "test-sofa-3p", 1.65, 0, Math.PI / 2)], { a: [] }],
  ["소파 90° 회전, 벽 침범", R1, [mk("a", "test-sofa-3p", 1.7, 0, Math.PI / 2)], { a: ["wall"] }],
  ["의자 방 바깥", R1, [mk("a", "test-chair", 3, 0)], { a: ["outside"] }],
  ["소파+테이블 겹침", R1, [mk("a", "test-sofa-3p", 0, 0), mk("b", "test-coffee-table", 0, 0.5)], { a: ["overlap"], b: ["overlap"] }],
  ["소파+테이블 맞닿음", R1, [mk("a", "test-sofa-3p", 0, 0), mk("b", "test-coffee-table", 0, 0.7)], { a: [], b: [] }],
  ["러그 위 소파", R1, [mk("a", "test-sofa-3p", 0, 0), mk("b", "test-rug", 0, 0)], { a: [], b: [] }],
  ["45° 의자 2개 (AABB면 오탐)", R1, [mk("a", "test-chair", 0, 0, Math.PI / 4), mk("b", "test-chair", 0.36, 0.36, Math.PI / 4)], { a: [], b: [] }],
  ["책장 천장 낮은 방", [room("r1", undefined, 2.0)], [mk("a", "test-bookshelf", 0, 0)], { a: [] }],
  ["책장 천장 1.7m", [{ ...room("r1"), height: 1.7 }], [mk("a", "test-bookshelf", 0, 0)], { a: ["too_tall"] }],
];

// ㄱ자 방: 0..6 × 0..5 에서 오른쪽 위 3×2.5 를 잘라냄. 안쪽 모서리는 (3, 2.5)
const L = [room("L", lShapePoints(0, 0, 6, 5, 3, 2.5))];
cases.push(
  ["ㄱ자 방: 아래쪽 넓은 곳 소파", L, [mk("a", "test-sofa-3p", 4.5, 3.8)], { a: [] }],
  ["ㄱ자 방: 잘린 부분은 방 바깥", L, [mk("a", "test-chair", 4.5, 1)], { a: ["outside"] }],
  ["ㄱ자 방: 안쪽 모서리가 침대를 파고듦", L, [mk("a", "test-bed-queen", 2.6, 2.9)], { a: ["wall"] }],
  ["ㄱ자 방: 안쪽 모서리에 딱 붙은 책상", L, [mk("a", "test-desk", 2.4, 2.2)], { a: [] }],
);

// 대각선 벽: 오른쪽 위 모서리를 1.5m 깎은 방
const diag = [room("D", normalizePolygon([{ x: 0, z: 0 }, { x: 2.5, z: 0 }, { x: 4, z: 1.5 }, { x: 4, z: 4 }, { x: 0, z: 4 }]))];
cases.push(
  ["대각선 벽 근처 의자 OK", diag, [mk("a", "test-chair", 2.6, 1.2)], { a: [] }],
  ["대각선 벽을 뚫는 책상", diag, [mk("a", "test-desk", 3.0, 0.9)], { a: ["wall"] }],
);

for (const [name, rooms, items, expected] of cases) {
  const w = computeWarnings(rooms, items, getProduct);
  const got = Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v.map((x) => x.kind)]));
  check(name, JSON.stringify(got) === JSON.stringify(expected), JSON.stringify(got));
}

// ---------- 다각형 ----------
check("ㄱ자 넓이 = 30 - 7.5", near(area(L[0].points), 22.5));
check("저장 순서는 반시계(넓이 양수)", signedArea(L[0].points) > 0 && signedArea(diag[0].points) > 0);
check("꼬인 모양 감지", selfIntersects([{ x: 0, z: 0 }, { x: 2, z: 2 }, { x: 2, z: 0 }, { x: 0, z: 2 }]));

// ---------- 벽: 공유벽은 한 번만 ----------
const A = room("A", rectPoints(0, 0, 4, 3));
const eA = allEdges([A]).find((e) => near(e.a.x, 4) || near(e.b.x, 4) && near(e.a.x, 4))!;
const rightA = allEdges([A]).find((e) => near(e.a.x, 4) && near(e.b.x, 4))!;
const B = room("B", roomBesideEdge(rightA, 3));
check("옆 방은 벽 두께만큼 떨어짐", near(Math.min(...B.points.map((p) => p.x)), 4 + T), JSON.stringify(B.points));
void eA;
const edgesAB = allEdges([A, B]);
const leftB = edgesAB.find((e) => e.roomId === "B" && near(e.a.x, 4 + T) && near(e.b.x, 4 + T))!;
check("B 의 맞닿은 벽은 숨김", leftB.hidden.length === 1 && near(leftB.hidden[0][1] - leftB.hidden[0][0], 3), JSON.stringify(leftB.hidden));
check("A 의 벽은 그대로", edgesAB.filter((e) => e.roomId === "A").every((e) => e.hidden.length === 0));

// 문을 B 쪽 숨긴 벽에 달아도 A 의 벽(실제로 그려진 벽)에 구멍이 난다
const door: Opening = { id: "d1", kind: "door", roomId: "B", edge: leftB.index, offset: 1.5, width: 0.9, height: 2.1, sill: 0 };
const w1 = buildWalls([A, B], [door]);
check("문 위치는 A 의 벽", w1.placements.length === 1 && w1.placements[0].edge.roomId === "A", JSON.stringify(w1.placements.map((p) => p.edge.roomId)));
const piecesOnRightA = w1.pieces.filter((p) => p.edge.roomId === "A" && p.edge.index === rightA.index);
check("문 구멍: 아래 없음, 위(2.1~2.4)만", piecesOnRightA.some((p) => near(p.y0, 2.1) && near(p.y1, 2.4)) && !piecesOnRightA.some((p) => p.y1 < 2.1 && p.y0 === 0 && near(p.quad[1].z - p.quad[0].z, 0.9)));
const win: Opening = { id: "w1", kind: "window", roomId: "A", edge: 0, offset: 2, width: 1.2, height: 1.2, sill: 0.9 };
const w2 = buildWalls([A], [win]);
const p0 = w2.pieces.filter((p) => p.edge.index === 0);
check("창문 구멍: 아래(0~0.9)·위(2.1~2.4) 조각", p0.some((p) => near(p.y0, 0) && near(p.y1, 0.9)) && p0.some((p) => near(p.y0, 2.1) && near(p.y1, 2.4)));
const widthSum = p0.filter((p) => p.y0 === 0 && near(p.y1, 2.4)).reduce((s, p) => s + Math.hypot(p.quad[1].x - p.quad[0].x, p.quad[1].z - p.quad[0].z), 0);
check("창문 양옆 벽 길이 = 4 - 1.2", near(widthSum, 2.8), String(widthSum));

// ---------- 방 이동 스냅 ----------
const C = room("C", rectPoints(4 + T + 0.08, 0.5, 3, 2)); // 8cm 떨어짐
const snapped = snapRoomMove(C, [A], { x: 0, z: 0 }).delta;
check("가까이 가져가면 벽 두께 간격으로 붙음", near(snapped.x, -0.08), JSON.stringify(snapped));
const C2 = room("C2", rectPoints(4 + T + 0.05, 0.12, 3, 2)); // 5cm 떨어지고 12cm 어긋남
const al2 = snapRoomMove(C2, [A], { x: 0, z: 0 });
check("붙이기 + 윗벽 일직선 (두 방향)", near(al2.delta.x, -0.05) && near(al2.delta.z, -0.12) && al2.guides.length === 2, JSON.stringify(al2));
// 옆 방 벽을 2cm 파고든 상태 → 모서리가 아니라 벽 두께만큼 띄워 붙어야 함
const C3 = room("C3", rectPoints(4 + 0.02, 0, 3, 3));
const al3 = snapRoomMove(C3, [A], { x: 0, z: 0 }, 1.0);
check("벽을 파고든 방은 벽 두께만큼 밀어 붙임", near(al3.delta.x, T - 0.02) && near(al3.delta.z, 0), JSON.stringify(al3.delta));
// A 아래에 놓은 방: 아래로는 벽 두께만큼 띄워 붙이고, 가로는 A 모서리(x=4)에 맞춤
const C4 = room("C4", rectPoints(4 + T, 3.3, 2, 2));
const al4 = snapRoomMove(C4, [A], { x: 0, z: 0 }, 0.2);
check("아래로 붙이고 모서리 줄맞춤", near(al4.delta.z, -(0.3 - T)) && near(al4.delta.x, -T), JSON.stringify(al4.delta));
const far = snapRoomMove(room("F", rectPoints(6, 6, 2, 2)), [A], { x: 0, z: 0 });
check("멀리 있으면 그대로", near(far.delta.x, 0) && near(far.delta.z, 0) && far.guides.length === 0);

// ---------- 저장 형식 변환 ----------
const v1 = parseScene({ schemaVersion: 1, room: { width: 4.2, depth: 3.6, height: 2.4 }, items: [mk("a", "test-sofa-3p", 0, 0)] });
check("예전 형식 → 새 형식", v1.ok && v1.scene.schemaVersion === 2 && v1.scene.rooms.length === 1 && near(area(v1.scene.rooms[0].points), 4.2 * 3.6));
const bad = parseScene({ schemaVersion: 2, rooms: [room("x", [{ x: 0, z: 0 }, { x: 2, z: 2 }, { x: 2, z: 0 }, { x: 0, z: 2 }])], openings: [], items: [] });
check("꼬인 방은 저장 거부", !bad.ok);
const clamp = parseScene({ schemaVersion: 2, rooms: [A], openings: [{ ...win, offset: 99, width: 9 }], items: [] });
check("벽보다 큰 창문은 벽 안으로 맞춤", clamp.ok && clamp.scene.openings[0].width <= 3.9 && clamp.scene.openings[0].offset < 4);

// ---------- 방을 옮기면 안의 가구도 같이 ----------
const st = useEditor.getState();
st.loadScene("t", {
  schemaVersion: 2,
  rooms: [A, B],
  openings: [],
  items: [mk("inA", "test-chair", 2, 1.5), mk("inB", "test-chair", 2, 5)],
});
useEditor.getState().moveRoom("A", { x: -1, z: 0.5 });
const after = useEditor.getState().items;
const pa = after.find((i) => i.id === "inA")!.position, pb = after.find((i) => i.id === "inB")!.position;
check("방 A 를 옮기면 A 안 가구도 이동", near(pa.x, 1) && near(pa.z, 2));
check("다른 방 가구는 그대로", near(pb.x, 2) && near(pb.z, 5));

process.exit(fail ? 1 : 0);
