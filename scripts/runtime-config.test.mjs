import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { formatMissingServerConfig, formatServerConfigReport, inspectServerEnv, missingNames, SERVER_CONFIG_NAMES } from "../server/runtime-config.js";

const execFileAsync = promisify(execFile);
const secret = "valor-que-no-puede-salir";
const env = {
  DATABASE_URL: `postgres://user:${secret}@db.example/maintenpro`,
  GOOGLE_CLIENT_ID: "",
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: "{\"client_email\":\"a@b.c\",\"private_key\":\"-----BEGIN PRIVATE KEY-----\\nlocal\\n-----END PRIVATE KEY-----\\n\"}"
};
assert.deepEqual(missingNames(SERVER_CONFIG_NAMES, env), ["GOOGLE_CLIENT_ID"]);
const message = formatMissingServerConfig(missingNames(SERVER_CONFIG_NAMES, env));
assert.equal(message, "Falta GOOGLE_CLIENT_ID. El servicio no arranca y no se inventa ninguna sesión.");
assert.equal(message.includes(secret), false);
const shaped = inspectServerEnv({
  DATABASE_URL: `mysql://user:${secret}@db.example/maintenpro`,
  GOOGLE_CLIENT_ID: "cliente.apps.googleusercontent.com",
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: `no-json ${secret}`,
  PORT: "no-es-puerto"
});
const shapedText = formatServerConfigReport(shaped);
assert.match(shapedText, /DATABASE_URL no tiene un esquema postgresql válido/);
assert.match(shapedText, /GOOGLE_PLAY_SERVICE_ACCOUNT_JSON no es JSON/);
assert.match(shapedText, /PORT no es un puerto válido/);
assert.equal(shapedText.includes(secret), false);
assert.equal(formatMissingServerConfig(["DATABASE_URL", "GOOGLE_CLIENT_ID"]).includes(secret), false);

const childEnv = { ...process.env, DECOY_SECRET: secret };
delete childEnv.DATABASE_URL;
delete childEnv.GOOGLE_CLIENT_ID;
delete childEnv.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
const result = await execFileAsync(process.execPath, ["server/index.js"], { env: childEnv }).then(
  () => ({ code: 0, stderr: "", stdout: "" }),
  error => ({ code: error.code ?? 1, stderr: `${error.stderr || ""}`, stdout: `${error.stdout || ""}` })
);
assert.equal(result.code, 1);
assert.match(result.stderr, /Faltan DATABASE_URL, GOOGLE_CLIENT_ID y GOOGLE_PLAY_SERVICE_ACCOUNT_JSON/);
assert.match(result.stderr, /no se inventa ninguna sesión/);
assert.equal(`${result.stdout}\n${result.stderr}`.includes(secret), false);
console.log("MaintenPro runtime config OK");
