import { createServer } from "node:http";
import { createApi } from "./create-api.js";
import { LISTEN_HOST } from "./listen.js";
import { formatServerConfigReport, inspectServerEnv } from "./runtime-config.js";
import { createPgStore } from "./store-pg.js";
import { verifyPlayEntitlement } from "./verify.js";

const configReport = inspectServerEnv();
if (configReport.missing.length || configReport.problems.length) {
  console.error(formatServerConfigReport(configReport));
  process.exit(1);
}

let store;
try {
  store = await createPgStore(process.env.DATABASE_URL);
} catch {
  console.error("No se pudo abrir PostgreSQL. No se imprime la cadena de conexión.");
  process.exit(1);
}
const api = createApi({
  store,
  clientId: process.env.GOOGLE_CLIENT_ID,
  verifyPlay: input => verifyPlayEntitlement({ ...input, productId: input?.productId })
});
const port = Number(process.env.PORT || 8787);
const server = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const result = await api.handle({ method: request.method, url: request.url, headers: request.headers, body: Buffer.concat(chunks).toString("utf8") });
  response.writeHead(result.status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(result.body));
});
server.listen(port, LISTEN_HOST, () => {
  console.log(`MaintenPro sync escuchando en ${LISTEN_HOST}:${port}`);
});
