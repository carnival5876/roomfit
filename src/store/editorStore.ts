import { create } from "zustand";
import type { PlacedItem, Room, SceneData } from "@/lib/types";
import { getProduct } from "@/lib/catalog";

// UI 상태와 장면 데이터만 관리한다. three.js 객체는 저장하지 않는다.

export type ViewMode = "3d" | "top";

type EditorState = {
  projectName: string;
  room: Room;
  items: PlacedItem[];
  selectedId: string | null;
  viewMode: ViewMode;
  isDragging: boolean;

  setProjectName: (name: string) => void;
  setRoom: (patch: Partial<Room>) => void;
  addItem: (productId: string) => void;
  updateItem: (id: string, patch: Partial<Pick<PlacedItem, "position" | "rotation">>) => void;
  removeItem: (id: string) => void;
  duplicateItem: (id: string) => void;
  select: (id: string | null) => void;
  setViewMode: (m: ViewMode) => void;
  setDragging: (v: boolean) => void;
  toSceneData: () => SceneData;
  /** 서버에서 불러온 방으로 장면을 교체한다 */
  loadScene: (name: string, scene: SceneData) => void;
};

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const ROOM_LIMITS = { min: 1, max: 20, minHeight: 2, maxHeight: 5 };

// 가입 전(비로그인) 브라우저 임시 저장 키. 가입할 때 이 방을 계정으로 가져온다.
export const GUEST_STORAGE_KEY = "roomfit-scene-v1";

export const useEditor = create<EditorState>()((set, get) => ({
      projectName: "내 첫 번째 방",
      room: { width: 4.2, depth: 3.6, height: 2.4 },
      items: [],
      selectedId: null,
      viewMode: "3d",
      isDragging: false,

      setProjectName: (projectName) => set({ projectName }),
      setRoom: (patch) => set((s) => ({ room: { ...s.room, ...patch } })),

      addItem: (productId) => {
        if (!getProduct(productId)) return;
        const item: PlacedItem = {
          id: uid(),
          productId,
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        };
        set((s) => ({ items: [...s.items, item], selectedId: item.id }));
      },

      updateItem: (id, patch) =>
        set((s) => ({
          items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
        })),

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
      setViewMode: (viewMode) => set({ viewMode }),
      setDragging: (isDragging) => set({ isDragging }),

      toSceneData: () => {
        const { room, items } = get();
        return { schemaVersion: 1, room, items };
      },

      loadScene: (projectName, scene) =>
        set({ projectName, room: scene.room, items: scene.items, selectedId: null, isDragging: false }),
}));
