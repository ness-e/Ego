# Ego — Directrices del Agente

> Ámbito: Ego es un Sistema Operativo Cognitivo (SOC) — aplicación desktop Electron. Fecha: 2026-10-06.
> Derivado de 25 decisiones fundacionales (Q1–Q25) en `Preguntas y respuestas.txt`.

## 1. STACK TECNOLÓGICO Y VERSIONES

* Runtime: Node.js 22 (Electron main) + Chromium (renderer)
* Framework desktop: Electron (último estable) + electron-vite
* Frontend: React 19 + TypeScript (strict) + Vite
* Chat UI: `@assistant-ui/react`
* Memoria: VantaDB 0.8.0 vía `NativeVantaDB` de `"vantadb/native"` (napi-rs, solo en main process) + `vantadb-mcp` como subprocess cognitivo (88 tools, vanta-memory L0-L3)
* Modelos: AI SDK v7 (adaptador, NO arquitectura) + Model Router propio
* Gestor de paquetes: pnpm (workspaces)
* Lenguaje de la aplicación: TypeScript (Node.js 22 main + React 19 renderer). Sidecar opcional: Python (ingesta masiva).

## 2. ARQUITECTURA Y CONVENCIONES

### Modelo conceptual

```
Renderer (React+Vite) → Preload (IPC tipado) → Main (Node)
                                                  └─ Cognitive Runtime
                                                       ├─ Context Assembly
                                                       ├─ Memory Adapter → NativeVantaDB (napi-rs in-process)
                                                       │                 → vantadb-mcp (subprocess cognitivo L0-L3)
                                                       ├─ Model Router → Providers
                                                       ├─ Decision Intelligence Layer
                                                       ├─ Sub-Ego Runtime
                                                       ├─ Tool Registry → Execution Manager
                                                       ├─ Event Bus (EgoEvent)
                                                       ├─ Permission / Approval System
                                                       └─ Integration Layer (MCP Client+Server + HTTP)
```

### Seguridad Electron

* `contextIsolation=true`, `sandbox=true`, `nodeIntegration=false`
* Preload fuertemente tipado. Renderer NO accede a Node/VantaDB.
* Lógica de negocio en main. Renderer = solo presentación.

### Terminología obligatoria

| Término | Contexto | Uso |
|---|---|---|
| Sub-Ego | Producto, UI, docs | Entidad cognitiva especializada visible al usuario |
| Agent/agente | Solo código interno | Nunca en UI, docs de producto ni comentarios visibles |
| Meta-Ego | Técnico solo | Capa interna de orquestación, NO es un Sub-Ego |

### Jerarquía de decisiones (resolver contradicciones)

```
0.Identity → 1.Principles → 2.ProductModel → 3.Capabilities →
4.Architecture → 5.Design → 6.Domains → 7.Integrations →
8.Business → 9.Roadmap → 10.Implementation → 11.Legacy
```

Regla: Capability = QUÉ. Architecture = CÓMO funciona. Design = CÓMO se experimenta. Implementation = CON QUÉ.

### 10 principios innegociables

1. Memoria local persistente (VantaDB)
2. Project Memory — contexto compartido persistente
3. Cognitive Runtime central propio
4. Sub-Egos especializados y personalizables
5. Tool-based execution (convertir intención en acción)
6. Gobernanza, permisos, aprobación de acciones sensibles
7. Multi-modelo + Model Router
8. Chat + Dynamic Workspace
9. Local-first + propiedad/exportación de datos
10. Operación persistente y extensible

### Organización del repositorio

```
Ego/
├── AGENTS.md                 ← este archivo
├── apps/                     ← aplicaciones (desktop)
├── packages/                 ← código fuente (monorepo pnpm)
│   └── memory/               ← EgoMemoryAdapter (gateway único a VantaDB)
├── docs/                     ← documentación canónica (33 archivos)
│   ├── product/              ← visión, concepto, UX, modelo económico, principios
│   ├── architecture/         ← vision-general, agentes, namespaces, dominios, workspace
│   ├── engineering/          ← stack-tecnico, lenguajes, integraciones
│   ├── roadmap/              ← 12 fases, métricas-okr
│   ├── references/           ← glosario, repos-intel
│   ├── jerarquia-canonica.md ← autoridad de decisiones
│   └── PLAN-EGO.md           ← plan maestro
├── images/                   ← recursos gráficos
├── scripts/                  ← utilidades
├── repos-referencia/         ← clones de terceros para estudio (NO son código de Ego)
└── Preguntas y respuestas.txt ← 25 decisiones fundacionales
```

### repos-referencia/ — qué extraer de cada uno

| Repo | Naturaleza | Qué extraer para Ego |
|---|---|---|
| hermes-agent | Gemelo de stack: Electron+React+assistant-ui | Gateway JSON-RPC, preload/lifecycle, chat/composer, ABC memoria, sesiones SQLite |
| khoj | IA personal open-source | Embeddings locales (gte-small), búsqueda coseno+umbral, chunking, extract_facts |
| openclaw | Gateway local + agentes WS | Runtime context, agent harness, memoria Markdown+SQLite, UI optimista |
| helmor | Tauri+React, agentes paralelos | Terminal output scheduler, UI sync bridge, coalescencia PTY |
| career-ops | Gestión de datos con contratos | DATA_CONTRACT (User vs System), escrituras atómicas con lock, cuarentena |
| deepseek-harness | Sesiones versionadas | IDs opacos, migraciones sin borrado, patrón supersede |

Regla: Estos repos son referencia de patrones. No copiar código directamente — extraer patterns y adaptar.

## 3. COMANDOS OPERATIVOS

* Instalación: `pnpm install --frozen-lockfile`
* Build desktop: `pnpm --filter @ego/desktop build`
* Type check: `npx tsc --noEmit -p apps/desktop`
* Lint: `pnpm lint`
* Dev: `pnpm --filter @ego/desktop dev`

> El agente NO ejecuta automáticamente comandos de test/runtime. Mostrar el comando para que el usuario lo ejecute manualmente. Excepción: instrucción explícita "ejecuta lo que quieras".

## 4. RESTRICCIONES DURAS (GUARDRAILS)

### Prohibiciones técnicas absolutas

* **NO Next.js** en desktop (reservado para Ego Web: landing/auth/billing)
* **NO Mastra ni LangGraph** como dependencias de núcleo (adaptadores opcionales futuros)
* **NO Jev** como componente interno (proveedor externo opcional en Decision Intelligence)
* **NO VantaDB en renderer** — solo main process vía IPC
* **NO `Client` de `"vantadb"`** (WASM) — usar `NativeVantaDB` de `"vantadb/native"` (napi-rs)
* **NO `vanta-proxy`** — FROZEN, diseñado para interceptar CLIs de terceros
* **NO `vantadb-server`** en desktop — usar modo embebido in-process
* **NO calcular embeddings en TypeScript** — VantaDB auto-embed via ONNX Runtime
* **NO lógica de negocio en renderer** — solo presentación
* **NO acceso directo a VantaDB** — todo pasa por `EgoMemoryAdapter`
* **NO "23 roles" como arquitectura** — Sub-Egos son dinámicos por dominio/capability
* **NO Dots como concepto arquitectónico** — es "Background Activity & Proactivity"

### Seguridad

* Credenciales/API keys: Credential Manager integrado con keychain del SO. Nunca en VantaDB, renderer ni código.
* Acciones sensibles (filesystem, código, servicios, finanzas, comunicación): requieren aprobación configurable.
* IPC: validar y tipar todo. El renderer es untrusted.

### Calidad

* Tipado estricto TypeScript. `any` prohibido salvo justificación explícita.
* Toda feature = Implementado + Integrado + Prueba funcional + Prueba de error + Persistencia + Sin regresiones.
* UI budget: 15-20% del esfuerzo de P0. "Funcional primero. Usable siempre. Perfecto después."

## 5. PROTOCOLO DE COMMITS Y GIT

* Convención: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`)
* Idioma de commits: inglés
* Commits atómicos: un cambio lógico por commit
* No romper build existente. `tsc --noEmit` debe pasar antes de commit.
* Nunca `--force` push sin instrucción explícita del owner.

## 6. ROADMAP — ORDEN DE IMPLEMENTACIÓN

Vertical slice progresivo. Fases 01–05 = P0-Alpha. Fases 06–12 = P0-Beta.

```
01 Core         → chat + memoria + streaming + persistencia
02 Acción       → tool calling + execution manager + approval
03 Sub-Egos     → crear + ejecutar + memoria compartida + delegación
04 Canvas       → workspace dinámico + component registry
05 Intelligence → decision router + classification + fallback
06 Knowledge    → importar + búsqueda híbrida + data views
07 Tasks        → background execution + proactividad
08 Daily State  → briefing dinámico al abrir
09 Dominios     → Knowledge, Product, Engineering, Analytics, CRM
10 Recovery     → export/import + crash recovery + migraciones
11 Security     → permisos, sandbox, IPC validation, audit
12 Distribution → installer + firma + auto-update
```

## 7. INTEGRACIONES

* MCP = protocolo estándar. Ego = MCP Client + MCP Server.
* First-party nativo (Nivel A): filesystem, git local, terminal. MCP Oficial (Nivel B): GitHub.
* HTTP/Webhooks (Nivel C) para servicios sin MCP.
* Cognitive Runtime NUNCA contiene lógica específica de servicio.
* Agregar una integración no debe modificar Runtime, Router, Sub-Egos ni Workspace.

## 8. MODELO DE NEGOCIO

* Open Source Apache 2.0. Monetización por servicios (Cloud, Sync, AI Credits).
* SaaS subscription + AI consumption separado + BYOK.

## 9. DOCUMENTACIÓN DE REFERENCIA

| Doc | Propósito |
|---|---|
| `docs/jerarquia-canonica.md` | Autoridad de decisiones (12 niveles) |
| `docs/product/principios-innegociables.md` | 10 propiedades fundamentales |
| `docs/architecture/vision-general.md` | Arquitectura completa del SOC |
| `docs/roadmap/roadmap.md` | 12 fases con criterios de aceptación |
| `docs/engineering/stack-tecnico.md` | Stack técnico detallado |
| `docs/engineering/integraciones.md` | Arquitectura MCP + conectores |
| `Preguntas y respuestas.txt` | 25 decisiones fundacionales completas |
