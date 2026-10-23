import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const gradle = await readFile("android/app/build.gradle.kts", "utf8");
const versionName = gradle.match(/versionName\s*=\s*"([^"]+)"/)?.[1];
const versionCode = gradle.match(/versionCode\s*=\s*(\d+)/)?.[1];
const required = [
  "windows/desktop-session.mjs",
  "windows/start-toolstock.cmd",
  "windows/install-user.ps1",
  "windows/sign-release.ps1",
  "audit/sync-regression.cjs"
];
const missing = required.filter(path => !existsSync(path));
if (versionName !== packageJson.version || missing.length || Number(versionCode) < 1) {
  console.error(JSON.stringify({ ok: false, packageVersion: packageJson.version, versionName, versionCode, missing }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, packageVersion: packageJson.version, versionName, versionCode, signing: "external-key-required", realDeviceChecks: "required-before-publish" }, null, 2));
