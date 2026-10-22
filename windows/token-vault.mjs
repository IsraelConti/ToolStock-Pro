import { spawn } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function dpapi(input, decrypt = false) {
  if (process.platform !== "win32") throw new Error("Windows DPAPI is required for persistent credentials");
  const script = `Add-Type -AssemblyName System.Security; $s=[Console]::In.ReadToEnd(); $b=[Convert]::FromBase64String($s); $r=[Security.Cryptography.ProtectedData]::${decrypt ? "Unprotect" : "Protect"}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r))`;
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", b => { output += b.toString(); });
    child.stderr.on("data", () => {});
    child.on("error", () => reject(new Error("credential-protection-unavailable")));
    child.on("exit", code => code === 0 ? resolve(Buffer.from(output.trim(), "base64")) : reject(new Error("credential-protection-unavailable")));
    child.stdin.end(Buffer.from(input).toString("base64"));
  });
}
export function createTokenVault(file) {
  return {
    async load() { try { return JSON.parse((await dpapi(await readFile(file), true)).toString("utf8")); } catch { return null; } },
    async save(value) {
      const encrypted = await dpapi(Buffer.from(JSON.stringify(value)));
      await mkdir(dirname(file), { recursive: true });
      await writeFile(`${file}.tmp`, encrypted, { mode: 0o600 });
      await rename(`${file}.tmp`, file);
    },
    async clear() { await rm(file, { force: true }); }
  };
}
