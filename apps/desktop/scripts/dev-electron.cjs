/**
 * Launcher dev de Electron (DIST-12).
 *
 * Fija `VITE_DEV_SERVER_URL` en `process.env` y spawnea `electron .` con
 * stdio heredado. Existe para no depender de `cross-env` ni del
 * `script-shell` de pnpm por SO: `VITE_DEV_SERVER_URL=... electron .` no es
 * portable entre cmd/pwsh/sh, este `.cjs` sí (win/linux/mac).
 *
 * Lo invoca `pnpm dev:electron` DESPUÉS de `wait-on tcp:127.0.0.1:5173`, así
 * que el puerto 5173 (Vite `strictPort`, ver `renderer/vite.config.ts`) ya
 * responde cuando Electron arranca. El main (`src/main.ts`) lee
 * `VITE_DEV_SERVER_URL` y hace `win.loadURL(...)` en dev.
 */
const { spawn } = require("node:child_process");
// Ruta al binario Electron (devDep de @ego/desktop): spawn directo sin
// shell → sin DEP0190, sin dependencia del PATH ni del script-shell.
const electronPath = require("electron");

const DEV_SERVER_URL = "http://127.0.0.1:5173";

if (!process.env.VITE_DEV_SERVER_URL) {
  process.env.VITE_DEV_SERVER_URL = DEV_SERVER_URL;
}

const child = spawn(electronPath, ["."], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    // Ctrl+C / kill: propagar señal para que `concurrently -k` limpie el resto.
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
