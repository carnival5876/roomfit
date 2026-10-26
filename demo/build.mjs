// 웹 데모 빌드: JS·CSS·GLB를 한 HTML 파일에 넣는다. 실행: npm run build:demo
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const out = root + "demo/dist/";
mkdirSync(out, { recursive: true });

const r = await build({
  entryPoints: [root + "demo/main.tsx"],
  bundle: true, minify: true, write: false, format: "iife", target: "es2020",
  jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});
let js = r.outputFiles[0].text;
for (const f of readdirSync(root + "public/models")) {
  const b64 = readFileSync(root + "public/models/" + f).toString("base64");
  js = js.replaceAll(`/models/${f}`, `data:model/gltf-binary;base64,${b64}`);
}
js = js.replaceAll("</script", "<\\/script");

const cssSrc = readFileSync(root + "src/app/globals.css", "utf8");
const css = (await postcss([tailwind({ base: root })]).process(cssSrc, { from: root + "src/app/globals.css" })).css;

const html = `<title>Roomfit 편집기</title>
<style>${css}
html, body { height: 100%; background: #f5f5f5; color: #171717; }
#root { height: 100%; }
#root > div { height: 100%; }
</style>
<div id="root"></div>
<script>${js}</script>
`;
writeFileSync(out + "roomfit-demo.html", html);
console.log("demo/dist/roomfit-demo.html", (html.length / 1024).toFixed(0) + "KB");
