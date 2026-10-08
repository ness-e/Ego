# Research Modules Registry — Fuente Única de Configuración por Módulo (Ego)

> **Fuente canónica** para el comando `/research <módulo>`. El comando carga esta
> tabla para sustituir los `{{placeholders}}` de `prompts/research-module.md`.
>
> **Cómo se agregan módulos:** SOLO vía el flujo del comando (`/research <nuevo>`):
> si el módulo no está en esta tabla pero existe como directorio en el repo, el
> comando pregunta al usuario (tool `question`) los campos faltantes y agrega la
> fila acá. Prohibido editar filas existentes sin pasar por una investigación.
>
> **Campos:** Módulo · Tipo · Ecosistema · Usuarios objetivo · Competidores mínimos · Nota específica.

| Módulo | Tipo | Ecosistema | Usuarios objetivo | Competidores mínimos | Nota específica |
|--------|------|-----------|-------------------|---------------------|-----------------|
| `desktop` | App Desktop (Electron + React 19) | `apps/desktop` | Usuario final, desarrolladores | `Hermes Agent`, `Khoj`, `OpenClaw`, `Claude Desktop` | Electron main (Node 22) + renderer Chromium (@assistant-ui/react). Sandbox=true, contextIsolation=true. Preload fuertemente tipado. |
| `memory` | Memory Gateway & Storage | `packages/memory` | Sub-Egos, Cognitive Runtime | `Mem0`, `Zep`, `Letta / MemGPT` | Gateway único a NativeVantaDB (napi-rs in-process BM25) y vantadb-mcp (L0-L3 + ONNX). Project Memory y namespaces ego.* |
| `models` | Model Router & Adapters | `packages/models` | Cognitive Runtime | `LiteLLM`, `AI SDK v7`, `OpenRouter` | Enrutador multi-modelo con fallback, clasificación de complejidad y costo. Soporte BYOK y proveedores locales/remotos. |
| `runtime` | Cognitive Runtime & Loops | `packages/runtime` | Sub-Egos y Meta-Ego | `LangGraph`, `AutoGPT`, `CrewAI` | ToolExecutionLoop propio, orquestación de turnos, ensamblaje de contexto dinámico y delegación entre Sub-Egos. |
| `execution` | Execution Manager & Governance | `packages/execution` | Cognitive Runtime | `Temporal`, `Inngest` | Control de cuotas, timeouts, presupuestos de tokens, abort controllers y aprobación HITL para acciones destructivas. |
| `tools` | Tool Registry & Native Connectors | `packages/tools` | Cognitive Runtime | `Model Context Protocol (MCP)`, `LangChain Tools` | Registry nativo Nivel A (filesystem, git, terminal) + cliente MCP para integraciones Nivel B/C. Zod schemas estrictos. |
| `events` | Event Bus & Logging | `packages/events` | Runtime y UI | `Node EventEmitter`, `RxJS` | EventBus desacoplado, EventNormalizer, structured logs en JSONL para trazabilidad total de acciones cognitivas. |

## Plantilla por módulo

| Módulo | Plantilla (`prompts/`) |
|--------|------------------------|
| `memory` · `models` · `runtime` · `execution` · `tools` · `events` | `research-module.md` |
| `desktop` | `research-module-product.md` (variante producto — UX/a11y/IPC en vez de API interna) |

## Módulo competidor principal por defecto (para la dimensión "diferenciación")

| Módulo | {{COMPETIDOR_PRINCIPAL}} |
|--------|--------------------------|
| `desktop` | `Hermes Agent` |
| `memory` | `Mem0` |
| `models` | `AI SDK Router` |
| `runtime` | `OpenClaw Runtime` |
| `execution` | `Coucou HITL Engine` |
| `tools` | `MCP SDK` |
| `events` | `Coucou Event Ingress` |

## Docs/arquitectura asociadas por módulo

| Módulo | Doc canónica |
|--------|--------------|
| `desktop` | `docs/architecture/workspace.md` + `docs/product/ux.md` |
| `memory` | `docs/architecture/namespaces.md` + `packages/memory/README.md` |
| `models` | `docs/architecture/vision-general.md` |
| `runtime` | `docs/architecture/agentes.md` |
| `execution` | `docs/architecture/vision-general.md` |
| `tools` | `docs/engineering/integraciones.md` |
| `events` | `docs/engineering/stack-tecnico.md` |
