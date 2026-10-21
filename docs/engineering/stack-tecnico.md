| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de stack tecnológico |
| Owner | ness-e |
| Fecha | 2026-10-06 |
| Fuente histórica | PRD v0 (no versionado en este repo) + Decisiones P18-P19 2026-10-06 |

# Stack Técnico de Ego

## Principio fundamental
**"Las tecnologías implementan Ego. No definen Ego."**

## Stack de Ego Desktop
El cliente principal de Ego para escritorio se construye sobre las siguientes tecnologías:
- **Electron**: Contenedor principal de la aplicación de escritorio (`^41.10.7` declarado en `apps/desktop/package.json`; el proceso main corre sobre el Node 24.18 embebido).
- **React + TypeScript**: Framework de UI.
- **Vite**: Bundler y herramientas de desarrollo del renderer vía **`electron-vite` 5.x (MIGRADO — T11 `fa58b8c`, layout `out/`, smoke nativo re-verificado; la nota anterior que decía "migración no hecha" quedó obsoleta). DevDeps verificadas: `electron-vite ^5.0.0`, `@vitejs/plugin-react ^4.3.4`, `@tailwindcss/vite`, `vitest`.

*Nota: Next.js NO se utiliza para la aplicación de escritorio.*

## Stack de Ego Web
**Next.js** está reservado exclusivamente para Ego Web, lo que incluye:
- Landing pages y marketing.
- Autenticación y facturación.
- Cloud Dashboard.
- Documentación pública.

## Base de datos local — VantaDB 0.8.0

### Capa de Persistencia (in-process)
- **VantaDB** v0.8.0: Motor embebido Rust con Fjall LSM, HNSW vectorial (4 niveles de cuantización), BM25 multilingüe (Tantivy), WAL anti-manipulación (SHA-256), bitemporalidad, IQL v4 y grafo dirigido con GraphRAG.
- **Binding**: `NativeVantaDB` desde `"vantadb/native"` — wrapper TypeScript asíncrono sobre `vantadb-node` (napi-rs, N-API v8).
- **NO usar**: `Client` de `"vantadb"` (WASM en memoria, sin persistencia en disco).
- **Auto-Embed**: VantaDB genera embeddings internamente via ONNX Runtime (`multilingual-e5-small`, 384d). No calcular embeddings en TypeScript.
- **Búsqueda**: en el **Fast Path** es **BM25 léxico puro** multi-namespace
  (`searchMulti` con `query_vector: []` — workaround upstream `VDB-REQ-02`, no un
  bug). El re-rank es **mono-lista** con MMR de coseno **léxica**
  (`packages/knowledge/src/HybridSearch.ts`): **no hay fusión RRF** en Ego hoy. La
  **fusión RRF + HNSW denso + embeddings ONNX** es una capacidad del motor de
  VantaDB disponible por el **Cognitive Path** (`graphragSearch`, `memoryRecall`,
  `contextAssemble`, `memoryConsolidate`, `memoryReinforce` — `vantadb-node@0.8.0`
  `index.d.ts:603-636`), hoy con **0 callsites** salvo `graphragSearch` → Ola 2
  (E2). Ver `docs/architecture/memoria-vantadb.md` §3 y
  `docs/architecture/namespaces.md`.
- **Empaquetado Electron**: `asarUnpack: ["**/*.node"]` obligatorio en `electron-builder.yml`.

### Capa Cognitiva (subprocess MCP)
- **vantadb-mcp**: Servidor MCP (88 herramientas — cifra declarada por el proyecto hermano VantaDB, no verificable desde Ego; ver R2 T09) ejecutado como subprocess stdio desde Electron main.
- Consume internamente `vanta-memory` (pipeline cognitivo L0→L3: captura, dedup, escenas, persona, dream consolidation).
- Proporciona: `context_assemble`, `memory_recall`, `dream_consolidate`, `scene_*`, `skill_*`, `code_*`.
- `vanta-memory` está implementado en Rust puro y NO tiene bindings Node.js directos.

### Reglas
- **VantaDB primero**: No habrá una segunda base de datos local sin justificación explícita.
- **Gateway único**: Todo acceso pasa por `EgoMemoryAdapter` en main process.
- **node_id es u128**: Tratar siempre como `string` en JavaScript (supera `Number.MAX_SAFE_INTEGER`).

## Seguridad Electron
- `contextIsolation = true`: Aislamiento estricto entre el proceso principal y el renderizador.
- `sandbox = true`: Renderizador en entorno aislado.
- `nodeIntegration = false`: Sin acceso a Node.js desde el renderizador.
- El renderer NUNCA accede a Node o a VantaDB directamente. Todo se canaliza a través de un script `preload` fuertemente tipado e IPC.
- Política de Seguridad de Contenido (CSP) restrictiva.

## Interfaz de Usuario (UI)
- **Navegación**: workspace dinámico componible por estado local (tabs + `SplitPane` en `App.tsx`); sin React Router por decisión EGO-FIND-04 ✅ (grep 0 usos en `renderer/`, sin la dep en `package.json`; la arquitectura workspace rechaza pantallas fijas — ver `ux-ui.md`).
- **Primitivas UI**: Radix (`@radix-ui/react-dialog`,
  `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`,
  `@radix-ui/react-select`, `@radix-ui/react-tabs`,
  `@radix-ui/react-tooltip`) + kit propio `ui-kit/` (**11 primitives**: Badge,
  Button, Input, Menu, Modal, Popover, Select, Switch, Tabs, Textarea,
  Tooltip — sobre cva+clsx+tailwind-merge) — instalado T06 `40fb103` y
  ampliado en laOLA 2026-10-20. **Principio D3 (owner 2026-10-19): las
  primitives de librería se usan siempre; un componente propio solo existe si
  hay un motivo concreto, escrito en
  [`docs/design/design-system.md`](../design/design-system.md) §8.**
- **Puerta de calidad del design system**: el design system **se aplica, no
  solo se declara**. `apps/desktop/scripts/design-lint.cjs` (linter sin
  dependencias) recorre el renderer y falla ante las reglas R1–R7 (hex fuera
  de token, `style={{}}` ad-hoc, `text-[Npx]` arbitrario, opacidad sobre texto
  dim/faint, `border-hairline` como único indicador de input, `<select>`
  nativo, paleta cruda); R8 es métrica de adopción del kit. Es un paso
  bloqueante del job `verify` de CI, **antes** del build. Contrato, ejecución
  (`node apps/desktop/scripts/design-lint.cjs [--json|--prune]`) y lista de
  excepciones: [`docs/design/design-system.md`](../design/design-system.md) §10
  y [`docs/testing/estrategia.md`](../testing/estrategia.md) §"Puertas de
  calidad automatizadas".
- **Editor de código**: **CodeMirror 6** (`codemirror ^6.0.2` + `@codemirror/*` +
  `lang-javascript|python|markdown`) en
  `apps/desktop/renderer/components/canvas/EditorView.tsx` — sustituye a
  ProseMirror (ADR-0013). *Monaco ya no está en el stack: 0 ocurrencias en
  cualquier `package.json`.*
- **Resaltado de sintaxis**: **Shiki** (`shiki ^4.5.0`) en un **Web Worker del
  renderer** (`apps/desktop/renderer/workers/shiki.worker.ts`) con fallback en
  hilo principal (ADR-0016).
- **Virtualización de listas**: `virtua` (`virtua ^0.53.5`) — lista de mensajes
  del chat virtualizada a partir de 60 mensajes (ADR-0014).
- **Terminal**: xterm.js.
- **Capa de Chat**: `@assistant-ui/react` (utilizado específicamente como capa de chat, no como framework de toda la app).
- **Workspace/Canvas**: Workspace dinámico y Canvas propios de Ego.
- **Motor de personaje**: `@ego/avatar` (`packages/avatar/`) — Web Component
  `<ego-avatar>` + Robot Studio. Copia vendorizada en
  `apps/desktop/renderer/floating/vendor/avatar/`. Decisión owner D5 (2026-10-19):
  **las tres copias se mantienen** en la Ola 1 (upstream
  `repos-referencia/avatar`, paquete, vendorizada) con script de sincronización
  verificable por SHA-256; la elección del motor canónico la cierra A6
  (ADR pendiente).

## Estado
- **Datos del proyecto**: VantaDB (persistido).
- **Estado de UI**: Zustand (`zustand ^5.0.15`, store `ui-kit/store.ts` — instalado T06 `40fb103`).
- **Cuenta y Facturación**: Cloud Control Plane (remoto).

## Modelos de IA
- **Enrutamiento**: Model Router propio de Ego.
- **Integración AI**: AI SDK utilizado únicamente como adaptador.
- Flexibilidad total: Multi-proveedor, BYOK (Bring Your Own Key), Modelos Locales, APIs compatibles con OpenAI y Custom.

## Decision Intelligence
- Capa de abstracción propia.
- **Jev** funciona como un proveedor dentro de esta capa.
- Combinación de Reglas + Modelos (ligeros) + LLMs.

## Cognitive Runtime
- **Propio de Ego**.
- No se utilizan frameworks externos como Mastra o LangGraph en el núcleo del runtime.

## Ejecución (Execution Runtime)
- El entorno de ejecución está separado del Cognitive Runtime.
- El código se ejecuta en un sandbox seguro, no en el renderer de Electron.

## Build y Distribución
- **Empaquetado**: electron-builder (config `apps/desktop/electron-builder.config.cjs`; loop de build/dev unificado con `electron-vite` tras T11).
- **Distribución**: Electron Builder o Forge.
