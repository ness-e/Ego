# Lenguajes — fuente vigente

| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de política de lenguajes desktop |
| Owner | ness-e |
| Fecha | 2026-10-05 |
| Fuente histórica | `../prd/07-6-arquitectura-general-y-pol-tica-de-lenguajes.md` §6.2 + `investigacion-de-diseño/` (v1 §6.2/§16, v2.0 §6.2 MANTENER, v2.1 §6.2) + `../architecture/vision-general.md` + `../engineering/stack.md` desktop |
| VantaDB verificado | 0.8.0 base dev; Adapter TS (`vantadb` napi en main); ingesta Python sistema (`vantadb-py`); motor Rust sin tocar; Go toolchain sistema |
| Regla | Este archivo se edita; `../prd/07*` queda congelado como referencia histórica |
| Decisión 2026-10-05 | Desktop Electron + Python/Go instalados ya + gates instalador; TS main+preload+renderer IPC tipado; web sin evidencia → revalidar en P0 |

## Propuesta P0 desktop (condicional medible)

Ego Electron solo desktop (ver `../engineering/stack.md`): main Node + preload IPC + renderer React + Vite (electron-vite). P0 = Adapter + KB + CRM mínimo + cuarentena/TTL/supersede + export/import locales. Requisitos del sistema en P0: Node + Python + Go instalados ya (decisión owner, no empaquetados).

## Tabla

| Componente | Lenguaje / runtime P0 desktop | Notas |
| --- | --- | --- |
| UI, chat, dashboards | TypeScript React + Vite en renderer | Sin Node directo; solo vía preload IPC |
| Main + preload + IPC | TypeScript (main Node + preload `contextIsolation`, contrato IPC tipado) | Cognitive Runtime / Sub-Egos corren en main |
| Cognitive Runtime, Decision Intelligence, Model Router, Sub-Egos, analítica | TypeScript en main (tipos end-to-end con renderer) | Cognitive Runtime propio + AI SDK (adaptador) |
| Adapter memoria | TypeScript (`vantadb` napi en main, path en carpeta usuario) | No WASM en app (E-001); rebuild gate en instalador |
| Motor memoria | Rust existente (VantaDB, sin Rust nuevo P0/P1) | Revalidación 1.0 es matriz, no fork |
| Ingesta documental y analítica | Python del sistema (instalado ya) vía scripts/sidecar stdio → `bulk_import` | No empaquetado; el instalador exige Python, no lo incluye |
| Concurrencia / workers | Go del sistema (instalado ya); worker aislado permitido desde P0 si se necesita | Sin esperar P2; solo con medida o necesidad explícita |
| Programados desktop | Cron local / tarea Electron (Inngest/BullMQ fuera P0) | Ver `stack.md` |

## Detalle

- **IPC:** renderer nunca toca VantaDB ni FS directo. Todo pasa por preload con API tipada (`ego.namespaces.json`, Zod). Desviación = bug.
- **napi:** `vantadb` nativo en main con `electron-rebuild` verificado en CI/instalador. Path datos en carpeta usuario + snapshots fichero + export.
- **Python:** se invoca como hijo por stdio con `vantadb-py`; entradas/salidas persisten en VantaDB (`research/docs`, `metrics/`). Si falta Python, la app lo exige al arrancar (no fallback silencioso).
- **Go:** toolchain disponible; su uso queda registrado y aislado (un worker, no servicio compartido).
- **Porting:** hazard Python/TS documentado + test CI de paridad (gate P0, origen `prueba/FINDINGS-080.md` V-007).

## Fallback, obs (obligatorio)

- Fallback local: Ollama LLM + Whisper STT (encaja con offline-primero desktop).
- Obs día 1 local: telemetría `metrics/` en VantaDB, trazas Jev JSON completo, p99 por fase incluyendo IPC main↔renderer.

## Sin pin / A medir

Sin pin toolchain verificado hoy (Node/Python/Go/Electron en `PLAN-EGO.md` como referencia, no contrato; solo `vantadb==0.8.0` pineado). Web 2026-10-05 sin evidencia utilizable (metasearch irrelevante, timeout/403 previos) → diseño propio no validado, no falso. Gates P0 desktop: instalador + firma + auto-update; VantaDB local + snapshots verificados; test paridad; medir arranque local, IPC p99, turno 800-1500ms/alarma 2000ms, ratio regla/Jev/LLM, costo/decisión.
