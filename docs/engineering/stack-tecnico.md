| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de stack tecnológico |
| Owner | ness-e |
| Fecha | 2026-10-06 |
| Fuente histórica | `../prd/19-tech-stack.md` + Decisiones P18-P19 2026-10-06 |

# Stack Técnico de Ego

## Principio fundamental
**"Las tecnologías implementan Ego. No definen Ego."**

## Stack de Ego Desktop
El cliente principal de Ego para escritorio se construye sobre las siguientes tecnologías:
- **Electron**: Contenedor principal de la aplicación de escritorio.
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
- **Búsqueda**: Híbrida RRF (BM25 + HNSW + filtros bitemporales + MMR). `searchMulti` es nativo.
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
- **Navegación**: workspace dinámico componible (sin React Router en P0 — ver EGO-FIND-04 ⏳: o se instala Router o se retira esta línea; hoy la navegación la resuelve el workspace, no un router).
- **Primitivas UI**: Radix (`@radix-ui/react-dialog`, `@radix-ui/react-tabs`) + kit propio `ui-kit/` (Button/Input/Modal/Tabs/Badge, cva+clsx+tailwind-merge) — instalados T06 `40fb103`.
- **Editor de código**: Monaco Editor.
- **Terminal**: xterm.js.
- **Capa de Chat**: `@assistant-ui/react` (utilizado específicamente como capa de chat, no como framework de toda la app).
- **Workspace/Canvas**: Workspace dinámico y Canvas propios de Ego.

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
