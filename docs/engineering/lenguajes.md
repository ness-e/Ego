# Lenguajes — fuente vigente

| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de política de lenguajes desktop |
| Owner | ness-e |
| Fecha | 2026-10-05 |
| Fuente histórica | `../prd/07-6-arquitectura-general-y-pol-tica-de-lenguajes.md` §6.2 + `investigacion-de-diseño/` (v1 §6.2/§16, v2.0 §6.2 MANTENER, v2.1 §6.2) + `../architecture/vision-general.md` + `../engineering/stack-tecnico.md` desktop |
| VantaDB verificado | 0.8.0 base dev; Adapter TS (`NativeVantaDB` de `"vantadb/native"` en main); subprocess `vantadb-mcp` stdio (88 tools); ingesta Python sidecar opcional (`vantadb-py`); motor Rust in-process |
| Regla | Este archivo se edita; `../prd/07*` queda congelado como referencia histórica |
| Decisión canónica | Desktop Electron + TypeScript único principal; Python sidecar opcional; TS main+preload+renderer IPC tipado |

## Propuesta P0 desktop

Ego Electron solo desktop (ver [stack-tecnico.md](./stack-tecnico.md)): main Node + preload IPC + renderer React + Vite (electron-vite). P0 = Adapter + KB + CRM mínimo + cuarentena/TTL/supersede + export/import locales. Requisitos del sistema en P0: Node.js 22 instalado (Python opcional para scripts de ingesta masiva).

## Tabla de componentes y lenguajes

| Componente | Lenguaje / runtime P0 desktop | Notas |
| --- | --- | --- |
| UI, chat, dashboards | TypeScript (React 19 + Vite) en renderer | Sin Node directo; solo vía preload IPC |
| Main + preload + IPC | TypeScript (Node.js 22 + preload `contextIsolation=true`, `sandbox=true`) | Main process orquesta la aplicación |
| Cognitive Runtime, Decision Intelligence, Model Router, Sub-Egos | TypeScript en main (tipado estricto end-to-end) | Runtime cognitivo propio + AI SDK v7 (adaptador de integración) |
| Adapter memoria (Fast Path) | TypeScript (`NativeVantaDB` de `"vantadb/native"`, napi-rs in-process) | Persistencia real en disco (Fjall LSM); `Client` WASM estrictamente PROHIBIDO |
| Subprocess cognitivo (Cognitive Path) | Subproceso `vantadb-mcp` stdio (88 tools, Rust) | Consume `vanta-memory` (L0-L3) para auto-recall, context_assemble y dreams |
| Ingesta documental masiva | Python del sistema (sidecar opcional) vía stdio → `bulk_import` | Solo para ingesta avanzada; no empaquetado |
| Programados y background | TypeScript en main / timers y tareas de fondo Electron | Background Activity & Proactivity |

## Detalle de fronteras

- **IPC:** El renderer nunca toca VantaDB ni el sistema de archivos directo. Todo pasa por preload con API tipada (`ego.namespaces.json`, contratos Zod).
- **NativeVantaDB:** Addon nativo napi-rs en main con `asarUnpack: ["**/*.node"]` en instalador. Persistencia en `app.getPath("userData")`.
- **Python (opcional):** Invocado como subprocess por stdio con `vantadb-py` para tareas de extracción documental pesada. Si no está instalado, Ego opera con ingesta estándar de texto.
- **Auto-Embed:** VantaDB genera embeddings internamente vía ONNX Runtime (`multilingual-e5-small`). Cero cálculo de vectores en TypeScript.

## Observabilidad y decisiones

- **Fallback local:** Ollama LLM + Whisper STT (enfoque offline-first y privacidad local).
- **Telemetría:** Métrica de latencia p99 en `metrics/`, trazas de decisiones de la Decision Intelligence Layer, tiempo de turno de orquestación (800-1500ms).

## Verificaciones P0 desktop

- Node.js 22 + Electron + Vite.
- Pin estricto `"vantadb/native": "0.8.0"`.
- Gates P0 desktop: instalador electron-builder firmado + auto-update; VantaDB local + snapshots verificados; IPC p99 < 50ms; ratio de enrutamiento regla / modelo de decisión / LLM.
