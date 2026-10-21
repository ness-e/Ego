/**
 * T-X1 — Sonda: ¿de dónde sale el tamaño del store de VantaDB en los tests?
 *
 * Reproduce el escenario de `ipc-tool-loop.test.ts` (una sesión + un turno)
 * y mide el tamaño del directorio en disco antes/después de cerrar.
 *
 * Es una SONDA de diagnóstico: su salida es el dato, así que los `console`
 * son el producto (de ahí el disable del linter).
 */
/* eslint-disable no-console */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

async function dirSizeMB(dir) {
  let total = 0;
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else {
        try {
          total += fs.statSync(full).size;
        } catch {
          /* puede desaparecer entre readdir y stat */
        }
      }
    }
  };
  walk(dir);
  return total / (1024 * 1024);
}

(async () => {
  const { EgoMemoryAdapter, EgoMemoryLifecycle } = await import(
    "@ego/memory"
  );
  const tmp = path.join(
    os.tmpdir(),
    `ego-tx1-probe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  fs.mkdirSync(tmp, { recursive: true });

  const adapter = new EgoMemoryAdapter(tmp);
  await adapter.init();
  console.log(`tras init():            ${(await dirSizeMB(tmp)).toFixed(2)} MB`);

  const lifecycle = new EgoMemoryLifecycle(adapter);
  await lifecycle.startSession("sess_t18", "default");
  await lifecycle.syncTurn("sess_t18", "turn_1", "Pregunta", "Respuesta");
  console.log(`tras 1 turno:           ${(await dirSizeMB(tmp)).toFixed(2)} MB`);

  // 20 namespaces x 50 registros (volumen típico de un test de E2E).
  for (let ns = 0; ns < 20; ns++) {
    for (let i = 0; i < 50; i++) {
      await adapter.put({
        namespace: `ns_${ns}`,
        key: `key_${i}`,
        payload: { texto: "x".repeat(500) },
        metadata: { ts: Date.now() + i },
      });
    }
  }
  console.log(`tras 1000 registros:   ${(await dirSizeMB(tmp)).toFixed(2)} MB`);

  // Ficheros: qué ocupa el store.
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else {
        try {
          files.push([path.relative(tmp, full), fs.statSync(full).size]);
        } catch {
          /* ignore */
        }
      }
    }
  };
  walk(tmp);
  files.sort((a, b) => b[1] - a[1]);
  console.log("mayores ficheros del store:");
  for (const [f, s] of files.slice(0, 8)) {
    console.log(`  ${(s / 1024 / 1024).toFixed(2).padStart(8)} MB  ${f}`);
  }
  console.log(`  total: ${files.length} ficheros`);

  await adapter.close();
  console.log(`tras close():           ${(await dirSizeMB(tmp)).toFixed(2)} MB`);
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  console.log("store eliminado:", !fs.existsSync(tmp));
})();
