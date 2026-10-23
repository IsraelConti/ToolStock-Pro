import { mkdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const outputDir = "release";
await mkdir(outputDir, { recursive: true });
const output = join(outputDir, `ToolStock-PC-${packageJson.version}-portable.zip`);
const entries = [
  "src", "windows", "scripts", "package.json", "package-lock.json", "README.md",
  "PRIVACY_POLICY.md", "TOOLSTOCK_PRIVACY_POLICY.md"
];
const result = spawnSync("zip", ["-r", "-q", output, ...entries], { stdio: "inherit" });
if (result.error || result.status !== 0) {
  console.error("No se pudo crear el ZIP portable. En Windows usa el explorador para comprimir estas mismas carpetas, o instala zip.");
  process.exit(1);
}
console.log(`Paquete portable creado: ${output}`);
