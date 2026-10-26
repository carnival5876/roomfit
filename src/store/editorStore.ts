import { create } from "zustand";
import type { Opening, PlacedItem, RoomShape, SceneData, Vec2 } from "@/lib/types";
import { getProduct } from "@/lib/catalog";
import { DEFAULT_SCENE, parseScene } from "@/lib/sceneSchema";
import {
  OPENING_DEFAULTS,
  WALL_THICKNESS,
  add,
  allEdges,
  area,
  bounds,
  centroid,
  clampOpening,
  dist,
  lShapePoints,
  len,
  mul,
  normalizePolygon,
  rectPoints,
  roomBesideEdge,
  round2,
  selfIntersects,
  signedArea,
  sub,
} from "@/lib/plan";

// 장면 데이터 + 화면 상태. three.js 객체는 저장하지 않는다.

export type ViewMode = "3d" | "top";
export type EditMode = "furniture" | "structure";

/** 구조 편집에서 선택한 것 */
export type StructSel =
  | { kind: "room"; roomId: string }
  | { kind: "wall"; roomId: string; edge: number }
  | { kind: "vertex"; roomId: string; index: number }
  | { kind: "opening"; id: string }
  | null;

export type RoomPreset = { shape: "rect" | "l"; width: number; depth: number; name: string };

type EditorState = {
  projectName: string;
  rooms: RoomShape[];
  openings: Opening[];
  items: PlacedItem[];
  selectedId: string | null; // 가구
  structSel: StructSel;
  mode: EditMode;
  viewMode: ViewMode;
  isDragging: boolean;
  /** 구조 편집 중 마지막 오류 (꼬인 모양 등) */
  structError: string | null;
  /** 바뀌면 카메라가 집 전체가 보이게 다시 맞춘다 */
  fitVersion: number;
  fitView: () => void;
  /** 화면 아래를 가리는 패널 높이(px). 카메라를 맞출 때 그만큼 피해서 보여 준다 (휴대폰) */
  bottomInset: number;
  setBottomInset: (px: number) => void;

  setProjectName: (name: string) => void;
  setMode: (m: EditMode) => void;
  setViewMode: (m: ViewMode) => void;
  setDragging: (v: boolean) => void;

  // 가구
  addItem: (productId: string) => void;
  updateItem: (id: string, patch: Partial<Pick<PlacedItem, "position" | "rotation">>) => void;
  removeItem: (id: string) => void;
  duplicateItem: (id: string) => void;
  select: (id: string | null) => void;

  // 방
  selectStruct: (sel: StructSel) => void;
  addRoom: (preset: RoomPreset) => void;
  addRoomBeside: (roomId: string, edge: number, depth: number) => void;
  updateRoom: (id: string, patch: Partial<Pick<RoomShape, "name" | "height">>) => void;
  moveRoom: (id: string, delta: Vec2) => void;
  removeRoom: (id: string) => void;
  /** 끌기 중: 정리하지 않고 꼭짓점만 옮긴다. 놓을 때 commitRoom 을 부른다 */
  setVertex: (roomId: string, index: number, p: Vec2) => void;
  /** 끌기 시작 때 모양을 기억했다가, 놓았을 때 모양이 잘못되면 되돌린다 */
  beginShapeEdit: (roomId: string) => void;
  commitRoom: (roomId: string) => void;
  insertVertex: (roomId: string, edge: number, t?: number) => void;
  removeVertex: (roomId: string, index: number) => void;
  setEdgeLength: (roomId: string, edge: number, length: number) => void;

  // 문·창문
  addOpening: (kind: Opening["kind"], roomId: string, edge: number) => void;
  updateOpening: (id: string, patch: Partial<Pick<Opening, "offset" | "width" | "height" | "sill">>) => void;
  removeOpening: (id: string) => void;

  toSceneData: () => SceneData;
  /** 서버에서 불러온 장면으로 교체 (예전 형식은 변환) */
  loadScene: (name: string, scene: unknown) => void;
};

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const ROOM_LIMITS = { min: 1, max: 20, minHeight: 2, maxHeight: 5 };

// 가입 전(비로그인) 브라우저 임시 저장 키. 가입할 때 이 방을 계정으로 가져온다.
export const GUEST_STORAGE_KEY = "roomfit-scene-v1";

const edgeLen = (r: RoomShape, e: number) => dist(r.points[e], r.points[(e + 1) % r.points.length]);

/** 방 모양이 바뀐 뒤 문·창문을 벽 안으로 다시 맞춘다 */
function refitOpenings(openings: Opening[], rooms: RoomShape[]): Opening[] {
  return openings.flatMap((o) => {
    const r = rooms.find((x) => x.id === o.roomId);
    if (!r || o.edge >= r.points.length) return [];
    return [clampOpening(o, edgeLen(r, o.edge), r.height)];
  });
}

const shapeSnapshots = new Map<string, Vec2[]>();

export const useEditor = create<EditorState>()((set, get) => ({
  projectName: "내 방",
  rooms: DEFAULT_SCENE.rooms,
  openings: [],
  items: [],
  selectedId: null,
  structSel: null,
  mode: "furniture",
  viewMode: "3d",
  isDragging: false,
  structError: null,
  fitVersion: 0,
  fitView: () => set((s) => ({ fitVersion: s.fitVersion + 1 })),
  bottomInset: 0,
  setBottomInset: (bottomInset) => set({ bottomInset }),

  setProjectName: (projectName) => set({ projectName }),
  setMode: (mode) =>
    set((s) => ({
      mode,
      selectedId: null,
      structSel: null,
      structError: null,
      // 구조 편집은 위에서 보는 평면이 가장 정확하다
      viewMode: mode === "structure" && s.mode !== "structure" ? "top" : s.viewMode,
    })),
  setViewMode: (viewMode) => set({ viewMode }),
  setDragging: (isDragging) => set({ isDragging }),

  // ---------- 가구 ----------
  addItem: (productId) => {
    if (!getProduct(productId)) return;
    const rooms = get().rooms;
    const biggest = [...rooms].sort((a, b) => area(b.points) - area(a.points))[0];
    const c = biggest ? centroid(biggest.points) : { x: 0, z: 0 };
    const item: PlacedItem = {
      id: uid(),
      productId,
      position: { x: round2(c.x), y: 0, z: round2(c.z) },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    };
    set((s) => ({ items: [...s.items, item], selectedId: item.id }));
  },

  updateItem: (id, patch) =>
    set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) })),

  removeItem: (id) =>
    set((s) => ({
      items: s.items.filter((it) => it.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  duplicateItem: (id) => {
    const src = get().items.find((it) => it.id === id);
    if (!src) return;
    const copy: PlacedItem = {
      ...src,
      id: uid(),
      position: { ...src.position, x: src.position.x + 0.3, z: src.position.z + 0.3 },
    };
    set((s) => ({ items: [...s.items, copy], selectedId: copy.id }));
  },

  select: (selectedId) => set({ selectedId }),

  // ---------- 방 ----------
  selectStruct: (structSel) => set({ structSel, structError: null }),

  addRoom: ({ shape, width, depth, name }) => {
    const { rooms } = get();
    const b = bounds(rooms);
    // 기존 방 오른쪽에 벽 두께만큼 띄워 붙인다 (바로 이어진 상태)
    const x = rooms.length ? b.maxX + WALL_THICKNESS : -width / 2;
    const z = rooms.length ? b.minZ : -depth / 2;
    const points =
      shape === "l"
        ? lShapePoints(x, z, width, depth, round2(width / 2), round2(depth / 2))
        : rectPoints(x, z, width, depth);
    const room: RoomShape = { id: uid(), name, points, height: rooms[0]?.height ?? 2.4 };
    set((s) => ({
      rooms: [...s.rooms, room],
      structSel: { kind: "room", roomId: room.id },
      structError: null,
      fitVersion: s.fitVersion + 1,
    }));
  },

  addRoomBeside: (roomId, edge, depth) => {
    const { rooms } = get();
    const ri = rooms.findIndex((r) => r.id === roomId);
    if (ri < 0) return;
    const e = allEdges(rooms).find((x) => x.roomId === roomId && x.index === edge);
    if (!e) return;
    const room: RoomShape = {
      id: uid(),
      name: `방 ${rooms.length + 1}`,
      points: roomBesideEdge(e, depth),
      height: rooms[ri].height,
    };
    set((s) => ({
      rooms: [...s.rooms, room],
      structSel: { kind: "room", roomId: room.id },
      structError: null,
      fitVersion: s.fitVersion + 1,
    }));
  },

  updateRoom: (id, patch) =>
    set((s) => {
      const rooms = s.rooms.map((r) =>
        r.id === id
          ? {
              ...r,
              ...(patch.name !== undefined ? { name: patch.name.slice(0, 30) } : {}),
              ...(patch.height !== undefined
                ? { height: Math.min(ROOM_LIMITS.maxHeight, Math.max(ROOM_LIMITS.minHeight, round2(patch.height))) }
                : {}),
            }
          : r,
      );
      return { rooms, openings: refitOpenings(s.openings, rooms) };
    }),

  moveRoom: (id, delta) =>
    set((s) => ({
      rooms: s.rooms.map((r) =>
        r.id === id ? { ...r, points: r.points.map((p) => ({ x: round2(p.x + delta.x), z: round2(p.z + delta.z) })) } : r,
      ),
    })),

  removeRoom: (id) =>
    set((s) => {
      if (s.rooms.length <= 1) return { structError: "방은 하나 이상 있어야 합니다" };
      return {
        rooms: s.rooms.filter((r) => r.id !== id),
        openings: s.openings.filter((o) => o.roomId !== id),
        structSel: null,
        structError: null,
      };
    }),

  setVertex: (roomId, index, p) =>
    set((s) => ({
      rooms: s.rooms.map((r) =>
        r.id === roomId ? { ...r, points: r.points.map((q, i) => (i === index ? { x: round2(p.x), z: round2(p.z) } : q)) } : r,
      ),
    })),

  beginShapeEdit: (roomId) => {
    const r = get().rooms.find((x) => x.id === roomId);
    if (r) shapeSnapshots.set(roomId, r.points);
  },

  commitRoom: (roomId) => {
    const s = get();
    const r = s.rooms.find((x) => x.id === roomId);
    if (!r) return;
    const snap = shapeSnapshots.get(roomId);
    shapeSnapshots.delete(roomId);
    const pts = r.points;
    const bad = pts.length < 3 || selfIntersects(pts) || signedArea(pts) < 0.5;
    if (bad) {
      set({
        rooms: s.rooms.map((x) => (x.id === roomId && snap ? { ...x, points: snap } : x)),
        structError: "벽이 서로 엇갈리는 모양은 만들 수 없어요. 원래대로 돌렸어요",
      });
      return;
    }
    // 거의 겹친 꼭짓점(5cm 이내)은 하나로 합친다
    const dupe = pts.findIndex((p, i) => dist(p, pts[(i + 1) % pts.length]) < 0.05);
    if (dupe >= 0 && pts.length > 3) {
      get().removeVertex(roomId, (dupe + 1) % pts.length);
      return;
    }
    set({ openings: refitOpenings(s.openings, s.rooms), structError: null });
  },

  insertVertex: (roomId, edge, t) =>
    set((s) => {
      const r = s.rooms.find((x) => x.id === roomId);
      if (!r || r.points.length >= 64) return {};
      const a = r.points[edge], b = r.points[(edge + 1) % r.points.length];
      const L = dist(a, b);
      const at = t ?? L / 2;
      const p = add(a, mul(sub(b, a), at / (L || 1)));
      const points = [...r.points.slice(0, edge + 1), { x: round2(p.x), z: round2(p.z) }, ...r.points.slice(edge + 1)];
      const rooms = s.rooms.map((x) => (x.id === roomId ? { ...x, points } : x));
      // 뒤쪽 벽 번호를 하나씩 민다. 나뉜 벽 위의 문·창문은 위치에 따라 앞/뒤 벽으로
      const openings = s.openings.map((o) => {
        if (o.roomId !== roomId) return o;
        if (o.edge > edge) return { ...o, edge: o.edge + 1 };
        if (o.edge === edge && o.offset > at) return { ...o, edge: edge + 1, offset: round2(o.offset - at) };
        return o;
      });
      return {
        rooms,
        openings: refitOpenings(openings, rooms),
        structSel: { kind: "vertex", roomId, index: edge + 1 },
        structError: null,
      };
    }),

  removeVertex: (roomId, index) =>
    set((s) => {
      const r = s.rooms.find((x) => x.id === roomId);
      if (!r) return {};
      if (r.points.length <= 3) return { structError: "꼭짓점은 3개 이상이어야 합니다" };
      const n = r.points.length;
      const points = r.points.filter((_, i) => i !== index);
      if (selfIntersects(points) || area(points) < 0.5)
        return { structError: "이 꼭짓점을 지우면 모양이 꼬여요" };
      const rooms = s.rooms.map((x) => (x.id === roomId ? { ...x, points } : x));
      const gone = new Set([(index - 1 + n) % n, index]); // 합쳐지는 두 벽의 문·창문은 지운다
      const openings = s.openings.flatMap((o) => {
        if (o.roomId !== roomId) return [o];
        if (gone.has(o.edge)) return [];
        return [{ ...o, edge: o.edge > index ? o.edge - 1 : o.edge }];
      });
      return { rooms, openings: refitOpenings(openings, rooms), structSel: { kind: "room", roomId }, structError: null };
    }),

  setEdgeLength: (roomId, edge, length) =>
    set((s) => {
      const r = s.rooms.find((x) => x.id === roomId);
      if (!r || !(length >= 0.2)) return {};
      const n = r.points.length;
      const ia = edge, ib = (edge + 1) % n, ic = (edge + 2) % n;
      const a = r.points[ia], b = r.points[ib], c = r.points[ic];
      const u = sub(b, a);
      const L = len(u);
      if (L < 1e-6) return {};
      const delta = mul(u, (length - L) / L);
      // 다음 벽이 직각이면 그 벽째로 평행 이동 (직사각형이 직사각형으로 남도록)
      const v = sub(c, b);
      const perpendicular = Math.abs((u.x * v.x + u.z * v.z) / (L * (len(v) || 1))) < 0.05 && n > 3;
      const points = r.points.map((p, i) =>
        i === ib || (perpendicular && i === ic) ? { x: round2(p.x + delta.x), z: round2(p.z + delta.z) } : p,
      );
      if (selfIntersects(points) || signedArea(points) < 0.5)
        return { structError: "이 길이로는 벽이 서로 엇갈려요" };
      const rooms = s.rooms.map((x) => (x.id === roomId ? { ...x, points } : x));
      return { rooms, openings: refitOpenings(s.openings, rooms), structError: null };
    }),

  // ---------- 문·창문 ----------
  addOpening: (kind, roomId, edge) =>
    set((s) => {
      const r = s.rooms.find((x) => x.id === roomId);
      if (!r) return {};
      const L = edgeLen(r, edge);
      const d = OPENING_DEFAULTS[kind];
      if (L < 0.5) return { structError: "벽이 너무 짧아요" };
      const o = clampOpening({ id: uid(), kind, roomId, edge, offset: L / 2, ...d }, L, r.height);
      return { openings: [...s.openings, o], structSel: { kind: "opening", id: o.id }, structError: null };
    }),

  updateOpening: (id, patch) =>
    set((s) => ({
      openings: s.openings.map((o) => {
        if (o.id !== id) return o;
        const r = s.rooms.find((x) => x.id === o.roomId);
        return r ? clampOpening({ ...o, ...patch }, edgeLen(r, o.edge), r.height) : o;
      }),
    })),

  removeOpening: (id) =>
    set((s) => ({ openings: s.openings.filter((o) => o.id !== id), structSel: null })),

  // ---------- 저장 ----------
  toSceneData: () => {
    const { rooms, openings, items } = get();
    return { schemaVersion: 2, rooms, openings, items };
  },

  loadScene: (projectName, scene) => {
    const parsed = parseScene(scene);
    const sc = parsed.ok ? parsed.scene : DEFAULT_SCENE;
    set({
      projectName,
      rooms: sc.rooms.map((r) => ({ ...r, points: normalizePolygon(r.points) })),
      openings: sc.openings,
      items: sc.items,
      selectedId: null,
      structSel: null,
      structError: null,
      isDragging: false,
      fitVersion: get().fitVersion + 1,
    });
  },
}));
