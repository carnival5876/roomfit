import type { Product, ProductCategory } from "./types";

// 1단계용 테스트 카탈로그. 실제 상품과 연결되지 않은 테스트 모델이며 가격은 예시값이다.
// 3단계에서 상품 카탈로그 API로 교체한다.
const test = (
  p: Omit<Product, "priceStatus" | "priceCheckedAt" | "imageUrl" | "purchaseUrl" | "isTest">,
): Product => ({
  ...p,
  priceStatus: "sample",
  priceCheckedAt: null,
  imageUrl: null,
  purchaseUrl: null,
  isTest: true,
});

export const CATALOG: Product[] = [
  test({
    id: "test-sofa-3p",
    name: "3인 패브릭 소파",
    category: "sofa",
    price: 590000,
    width: 2.0, depth: 0.9, height: 0.85,
    color: "아이보리",
    description: "테스트용 3인 소파 모델",
    modelUrl: "/models/sofa-3p.glb",
    collides: true,
  }),
  test({
    id: "test-coffee-table",
    name: "원목 커피 테이블",
    category: "coffee_table",
    price: 159000,
    width: 1.0, depth: 0.5, height: 0.45,
    color: "오크",
    description: "테스트용 커피 테이블 모델",
    modelUrl: "/models/coffee-table.glb",
    collides: true,
  }),
  test({
    id: "test-bed-queen",
    name: "퀸 침대 프레임",
    category: "bed",
    price: 690000,
    width: 1.6, depth: 2.1, height: 0.95,
    color: "월넛 / 화이트",
    description: "테스트용 퀸 침대 모델 (헤드보드 포함)",
    modelUrl: "/models/bed-queen.glb",
    collides: true,
  }),
  test({
    id: "test-desk",
    name: "1200 책상",
    category: "desk",
    price: 189000,
    width: 1.2, depth: 0.6, height: 0.74,
    color: "아이보리 / 블랙",
    description: "테스트용 책상 모델",
    modelUrl: "/models/desk.glb",
    collides: true,
  }),
  test({
    id: "test-chair",
    name: "원목 의자",
    category: "chair",
    price: 79000,
    width: 0.45, depth: 0.5, height: 0.85,
    color: "오크",
    description: "테스트용 의자 모델",
    modelUrl: "/models/chair.glb",
    collides: true,
  }),
  test({
    id: "test-bookshelf",
    name: "5단 책장",
    category: "bookshelf",
    price: 129000,
    width: 0.8, depth: 0.3, height: 1.8,
    color: "화이트",
    description: "테스트용 책장 모델",
    modelUrl: "/models/bookshelf.glb",
    collides: true,
  }),
  test({
    id: "test-rug",
    name: "베이지 러그",
    category: "rug",
    price: 99000,
    width: 2.0, depth: 1.4, height: 0.01,
    color: "베이지",
    description: "테스트용 러그 모델 (겹침 검사 제외)",
    modelUrl: "/models/rug.glb",
    collides: false,
  }),
];

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  sofa: "소파",
  bed: "침대",
  desk: "책상",
  dining_table: "식탁",
  chair: "의자",
  storage: "수납장",
  bookshelf: "책장",
  coffee_table: "커피 테이블",
  rug: "러그",
  lighting: "조명",
};

const byId = new Map(CATALOG.map((p) => [p.id, p]));
export const getProduct = (id: string) => byId.get(id);
