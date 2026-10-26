// 테스트용 샘플 가구 GLB 생성 스크립트
// 규약: 단위 미터, Y-up, 원점 = 바닥면 중앙, 정면 = +Z
// 실행: node scripts/generate-models.mjs
import { Document, NodeIO } from "@gltf-transform/core";
import { mkdirSync } from "node:fs";

const OUT = new URL("../public/models/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

function hex(c) {
  const n = parseInt(c.replace("#", ""), 16);
  const s = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return [...s, 1];
}

// 박스 하나: 중심(cx,cy,cz), 크기(w,h,d)
function boxArrays(cx, cy, cz, w, h, d) {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const y0 = cy - h / 2, y1 = cy + h / 2;
  const z0 = cz - d / 2, z1 = cz + d / 2;
  const faces = [
    [[1, 0, 0], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]]],
    [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]],
    [[0, 1, 0], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]]],
    [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]],
    [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]],
    [[0, 0, -1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]],
  ];
  const pos = [], nor = [], idx = [];
  faces.forEach(([n, vs], f) => {
    vs.forEach((v) => { pos.push(...v); nor.push(...n); });
    const b = f * 4;
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  return { pos, nor, idx };
}

async function makeModel(name, parts) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const mats = {};
  const mesh = doc.createMesh(name);
  // 재질별로 박스를 묶어 primitive 하나로
  const groups = {};
  for (const p of parts) (groups[p.color] ??= []).push(p);
  for (const [color, boxes] of Object.entries(groups)) {
    const pos = [], nor = [], idx = [];
    for (const b of boxes) {
      const a = boxArrays(b.x ?? 0, b.y, b.z ?? 0, b.w, b.h, b.d);
      const base = pos.length / 3;
      pos.push(...a.pos); nor.push(...a.nor); idx.push(...a.idx.map((i) => i + base));
    }
    mats[color] ??= doc.createMaterial(color)
      .setBaseColorFactor(hex(color)).setRoughnessFactor(0.8).setMetallicFactor(0);
    const prim = doc.createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(pos)).setBuffer(buffer))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(new Float32Array(nor)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint16Array(idx)).setBuffer(buffer))
      .setMaterial(mats[color]);
    mesh.addPrimitive(prim);
  }
  const node = doc.createNode(name).setMesh(mesh);
  doc.createScene().addChild(node);
  await new NodeIO().write(`${OUT}${name}.glb`, doc);
  console.log("wrote", name);
}

// 바닥(y=0)에 놓이도록 y = 높이/2 + 바닥에서의 높이
const leg = (x, z, h, s = 0.04, color = "#5b4636") => ({ x, y: h / 2, z, w: s, h, d: s, color });

const models = {
  // 3인 소파 2.0 x 0.9 x 0.85
  "sofa-3p": [
    { y: 0.08, w: 2.0, h: 0.06, d: 0.9, color: "#3d3a36" },
    { y: 0.26, w: 1.64, h: 0.3, d: 0.72, z: 0.09, color: "#d9d2c5" },
    { y: 0.55, w: 1.64, h: 0.6, d: 0.18, z: -0.36, color: "#cfc7b8" },
    { x: -0.91, y: 0.4, w: 0.18, h: 0.58, d: 0.9, color: "#cfc7b8" },
    { x: 0.91, y: 0.4, w: 0.18, h: 0.58, d: 0.9, color: "#cfc7b8" },
    ...[[-0.95, 0.4], [0.95, 0.4], [-0.95, -0.4], [0.95, -0.4]].map(([x, z]) => leg(x, z, 0.05, 0.05)),
  ],
  // 커피 테이블 1.0 x 0.5 x 0.45
  "coffee-table": [
    { y: 0.43, w: 1.0, h: 0.04, d: 0.5, color: "#b98a5e" },
    { y: 0.15, w: 0.9, h: 0.02, d: 0.4, color: "#b98a5e" },
    ...[[-0.47, 0.22], [0.47, 0.22], [-0.47, -0.22], [0.47, -0.22]].map(([x, z]) => leg(x, z, 0.41, 0.04, "#8a6644")),
  ],
  // 퀸 침대 1.6 x 2.1 x 0.95 (헤드보드 포함)
  "bed-queen": [
    { y: 0.17, w: 1.6, h: 0.26, d: 2.1, color: "#a77c55" },
    { y: 0.4, w: 1.54, h: 0.2, d: 2.0, z: 0.03, color: "#f2efe8" },
    { y: 0.53, w: 0.6, h: 0.08, d: 0.35, x: -0.38, z: -0.78, color: "#ffffff" },
    { y: 0.53, w: 0.6, h: 0.08, d: 0.35, x: 0.38, z: -0.78, color: "#ffffff" },
    { y: 0.475, w: 1.6, h: 0.95, d: 0.06, z: -1.02, color: "#8f6847" },
    ...[[-0.75, 0.98], [0.75, 0.98], [-0.75, -0.98], [0.75, -0.98]].map(([x, z]) => leg(x, z, 0.04, 0.06)),
  ],
  // 책상 1.2 x 0.6 x 0.74
  "desk": [
    { y: 0.72, w: 1.2, h: 0.04, d: 0.6, color: "#e8e1d4" },
    ...[[-0.57, 0.27], [0.57, 0.27], [-0.57, -0.27], [0.57, -0.27]].map(([x, z]) => leg(x, z, 0.7, 0.04, "#2f2f2f")),
  ],
  // 의자 0.45 x 0.5 x 0.85
  "chair": [
    { y: 0.44, w: 0.45, h: 0.04, d: 0.45, z: 0.025, color: "#b98a5e" },
    { y: 0.68, w: 0.45, h: 0.3, d: 0.03, z: -0.225 + 0.015 - 0.01, color: "#b98a5e" },
    ...[[-0.2, 0.22], [0.2, 0.22], [-0.2, -0.22], [0.2, -0.22]].map(([x, z]) => leg(x, z, 0.42, 0.03, "#8a6644")),
    leg(-0.2, -0.235, 0.85, 0.03, "#8a6644"), leg(0.2, -0.235, 0.85, 0.03, "#8a6644"),
  ],
  // 책장 0.8 x 0.3 x 1.8
  "bookshelf": [
    { x: -0.39, y: 0.9, w: 0.02, h: 1.8, d: 0.3, color: "#e9e4da" },
    { x: 0.39, y: 0.9, w: 0.02, h: 1.8, d: 0.3, color: "#e9e4da" },
    { y: 0.9, z: -0.14, w: 0.76, h: 1.8, d: 0.02, color: "#ddd6c9" },
    ...[0.01, 0.45, 0.9, 1.35, 1.79].map((y) => ({ y, w: 0.76, h: 0.02, d: 0.3, color: "#e9e4da" })),
  ],
  // 러그 2.0 x 1.4 x 0.01
  "rug": [{ y: 0.005, w: 2.0, h: 0.01, d: 1.4, color: "#c9b79c" }],
};

for (const [name, parts] of Object.entries(models)) await makeModel(name, parts);
