// 앱 화면 번들 빌드 → mobile/www (Capacitor가 이 폴더를 앱에 넣는다)
// 사용: ROOMFIT_API_URL=https://도메인 node mobile/build.mjs   (기본값은 아래 DEFAULT_API)
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const DEFAULT_API = "http://223.130.151.95:3100";
const API = (process.env.ROOMFIT_API_URL || DEFAULT_API).replace(/\/$/, "");

const root = new URL("..", import.meta.url).pathname;
const out = root + "mobile/www/";
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [root + "mobile/main.tsx"],
  outfile: out + "app.js",
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020", "safari15", "chrome90"],
  jsx: "automatic",
  alias: { "@": root + "src" },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_ROOMFIT_APP": '"1"',
    "process.env.NEXT_PUBLIC_ROOMFIT_API_URL": JSON.stringify(API),
  },
  logLevel: "warning",
});

const cssSrc = readFileSync(root + "src/app/globals.css", "utf8");
const css = (await postcss([tailwind({ base: root })]).process(cssSrc, { from: root + "src/app/globals.css" })).css;
writeFileSync(out + "app.css", css + "\nhtml,body{height:100%;background:#efece6;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}input{-webkit-user-select:text;user-select:text}#root{height:100%}\n");

cpSync(root + "public/models", out + "models", { recursive: true });

writeFileSync(out + "index.html", `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#ffffff">
<title>Roomfit</title>
<link rel="stylesheet" href="app.css">
</head>
<body>
<div id="root"></div>
<script src="app.js"></script>
</body>
</html>
`);
console.log(`mobile/www 빌드 완료 (API: ${API})`);
