// 좌표계 규약 (프로젝트 전체 공통)
// - 단위: 미터
// - Y-up. 바닥면 y = 0
// - 방 원점: 바닥 중앙. 방 내부는 x ∈ [-width/2, width/2], z ∈ [-depth/2, depth/2]
// - 가구 모델 원점: 바닥면 중앙, 정면 = +Z
// - rotation.y = θ 일 때 가구 정면 방향은 월드 (sin θ, cos θ)

export type Vec3 = { x: number; y: number; z: number };

export type Room = {
  width: number; // x 방향 (m)
  depth: number; // z 방향 (m)
  height: number; // 천장 높이 (m)
};

export type ProductCategory =
  | "sofa"
  | "bed"
  | "desk"
  | "dining_table"
  | "chair"
  | "storage"
  | "bookshelf"
  | "coffee_table"
  | "rug"
  | "lighting";

/** 가격 신뢰도. verified만 확정 가격으로 표시한다. */
export type PriceStatus = "verified" | "sample" | "unknown";

/** 상품 정보 (3D 모델과 별도 엔티티) */
export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  price: number | null; // KRW
  priceStatus: PriceStatus;
  priceCheckedAt: string | null;
  width: number; // m, 가로 (x)
  depth: number; // m, 깊이 (z)
  height: number; // m
  color: string;
  description: string;
  modelUrl: string;
  imageUrl: string | null;
  purchaseUrl: string | null;
  /** 실제 상품과 연결되지 않은 테스트용 가구 */
  isTest: boolean;
  /** false면 겹침 검사에서 제외 (러그 등 바닥재) */
  collides: boolean;
};

/** 방에 배치된 가구 1개. 프로젝트 저장 시 이 데이터만 저장한다. */
export type PlacedItem = {
  id: string;
  productId: string;
  position: Vec3;
  rotation: Vec3; // 라디안. MVP에서는 y만 편집
  scale: Vec3; // MVP에서는 항상 1
};

export type SceneData = {
  schemaVersion: 1;
  room: Room;
  items: PlacedItem[];
};

export type Warning = {
  kind: "outside" | "wall" | "overlap" | "too_tall";
  message: string;
};
