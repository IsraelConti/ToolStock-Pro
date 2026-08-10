import { build } from "esbuild";
import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/app.js"],
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: "dist/app.js",
  target: ["es2020"]
});
for (const file of ["index.html", "styles.css", "manifest.webmanifest", "app-icon.png", "pro-layout.js", "pro-layout.css", "events-pro.js", "events-pro.css"]) {
  await cp(`src/${file}`, `dist/${file}`);
}
let html = await readFile("dist/index.html", "utf8");
html = html.replace("</head>", '  <link rel="stylesheet" href="pro-layout.css">\n  <link rel="stylesheet" href="events-pro.css">\n</head>');
html = html.replace("</body>", '  <script src="pro-layout.js"></script>\n  <script src="events-pro.js"></script>\n</body>');
await writeFile("dist/index.html", html);
console.log("Moments Planner built with professional venue planner and Events PRO.");