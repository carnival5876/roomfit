// 좌표계 규약 (프로젝트 전체 공통)
// - 단위: 미터
// - Y-up. 바닥면 y = 0
// - 평면은 x-z 평면. 방은 바닥 다각형(방 안쪽 벽면 기준)으로 표현한다
// - 다각형 꼭짓점은 (x, z) 기준 반시계(넓이 양수) 순서로 저장한다. 안쪽은 진행 방향 왼쪽
// - 벽은 다각형 바깥쪽으로 WALL_THICKNESS 만큼 두께를 가진다. 이웃한 방은 벽 두께만큼 떨어져 붙는다
// - 가구 모델 원점: 바닥면 중앙, 정면 = +Z
// - rotation.y = θ 일 때 가구 정면 방향은 월드 (sin θ, cos θ)

export type Vec3 = { x: number; y: number; z: number };

export type Vec2 = { x: number; z: number };

/** 예전(1단계) 직사각형 방. 저장 데이터 변환에만 쓴다. */
export type LegacyRoom = {
  width: number; // x 방향 (m)
  depth: number; // z 방향 (m)
  height: number; // 천장 높이 (m)
};

/** 방 하나: 바닥 다각형 + 천장 높이 */
export type RoomShape = {
  id: string;
  name: string;
  points: Vec2[]; // 안쪽 벽면 기준, 반시계 순서
  height: number; // 천장 높이 (m)
};

/** 벽에 낸 문·창문. 방 roomId 의 edge 번째 벽(points[edge] → points[edge+1]) 위에 있다 */
export type Opening = {
  id: string;
  kind: "door" | "window";
  roomId: string;
  edge: number;
  offset: number; // 벽 시작점에서 문·창문 가운데까지 거리 (m)
  width: number; // m
  height: number; // m
  sill: number; // 바닥에서 아래쪽까지 높이 (m). 문은 0
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
  schemaVersion: 2;
  rooms: RoomShape[];
  openings: Opening[];
  items: PlacedItem[];
};

/** 예전 저장 형식 (불러올 때 SceneData 로 변환) */
export type SceneDataV1 = {
  schemaVersion: 1;
  room: LegacyRoom;
  items: PlacedItem[];
};

export type Warning = {
  kind: "outside" | "wall" | "overlap" | "too_tall";
  message: string;
};
