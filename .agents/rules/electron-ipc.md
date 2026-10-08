# Regla: Electron main/renderer + IPC (Ego desktop)

Todo el código de Ego vive en `apps/desktop/src/` (main, preload, renderer) y `packages/`.
Renderer nunca toca VantaDB ni FS: solo `window.ego` vía preload con `contextIsolation`.

- Canales IPC permitidos: `ipc.memory`, `ipc.llm.stream`, `ipc.gov.approve`, `ipc.snapshots` (ver `apps/desktop/src/ipc.ts`).
- Main aplica ACL por prefijo ANTES de `search`; el renderer nunca evalúa permisos.
- `nodeIntegration: false` siempre. `contextBridge` expone solo la API tipada.
- Desviación del contrato IPC = bug de arquitectura, no detalle.
