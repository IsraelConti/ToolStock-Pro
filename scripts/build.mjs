import { existsSync } from "node:fs";
import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { releaseConfig } from './release-config.mjs';

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/app.js"],
  bundle: true,
  minify: true,
  sourcemap: true,
  format: "iife",
  outfile: "dist/app.js",
  target: ["es2020"]
});
for (const file of ["index.html", "styles.css", "premium.css", "manifest.webmanifest", "preguntalicates.svg"]) {
  await cp(`src/${file}`, `dist/${file}`);
}
const config = await releaseConfig();
const html = await readFile('dist/index.html', 'utf8');
await writeFile('dist/index.html', html.replace('</head>', `<script>window.MaintenProRelease=${JSON.stringify({ pcDownloadUrl: config.pcDownloadUrl, publicSiteUrl: config.publicSiteUrl }).replaceAll('<', '\\u003c')};</script></head>`));
if (!existsSync("src/app-icon.png")) {
  await writeFile("src/app-icon.png", Buffer.from((await readFile("src/app-icon.b64", "utf8")).replace(/\s/g, ""), "base64"));
}
await cp("src/app-icon.png", "dist/app-icon.png");
await mkdir("android/app/src/main/assets", { recursive: true });
for (const file of ["app.js", "index.html", "styles.css", "premium.css", "manifest.webmanifest", "app-icon.png", "preguntalicates.svg"]) {
  await cp(`dist/${file}`, `android/app/src/main/assets/${file}`);
}
console.log("MaintenPro web assets built.");
