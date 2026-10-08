# Ego — Sistema Operativo Cognitivo (SOC)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Runtime](https://img.shields.io/badge/Runtime-Node.js_22_|_Electron_33-green.svg)](docs/engineering/stack-tecnico.md)
[![Frontend](https://img.shields.io/badge/Frontend-React_19_|_TypeScript_strict-blue.svg)](docs/engineering/stack-tecnico.md)
[![Memory](https://img.shields.io/badge/Memory-VantaDB_0.8.0_(Fjall_LSM)-purple.svg)](docs/architecture/memoria-vantadb.md)

> **"Ego es uno para el usuario y muchos por dentro."**  
> Ego es un **Sistema Operativo Cognitivo (SOC)** local-first para escritorio (Electron, Node.js 22, React 19), diseñado para orquestar la cognición, memoria, herramientas y toma de decisiones del usuario a través de especialistas colaborativos (**Sub-Egos**) operando sobre memoria compartida persistente (**VantaDB**).

---

## 🏛️ Principios Innegociables

1. **Memoria Local Persistente:** Motor embebido VantaDB 0.8.0 (Fjall LSM in-process vía NAPI-RS) con durabilidad completa tras reinicio.
2. **Project Memory Compartida:** Contexto persistente transversal entre Sub-Egos con aislamiento de estado privado (`egos/<id>/*`).
3. **Cognitive Runtime Soberano:** Núcleo de orquestación multi-turno, gestión de contexto y ejecución causal independiente.
4. **Sub-Egos Especializados:** Especialistas dinámicos configurables por dominio y capacidades (no roles rígidos).
5. **Tool-Based Execution:** Conectores Nivel A Nativos (filesystem con rollback, git local, terminal supervisado) y Nivel B (MCP Client universal).
6. **Gobernanza y Aprobación HITL:** Acciones sensibles (`riskLevel: sensitive/destructive`) requieren confirmación humana explícita.
7. **Multi-modelo & Model Router:** Enrutamiento agnóstico y dinámico de inferencia (OpenAI, Anthropic, Ollama local, etc.).
8. **Chat + Dynamic Workspace:** Separación canónica: *Chat = Intención*, *Canvas = Trabajo y Artefactos*.
9. **Local-First & Propiedad de Datos:** Soberanía completa de datos en el equipo del usuario con soporte de exportación canónica (`.vdbdump`).
10. **Operación Persistente y Extensible:** Automatización en segundo plano con límites deterministas de recursos.

---

## 📐 Arquitectura del Sistema

```
Renderer (React 19 + @assistant-ui/react) 
   │
   ▼ IPC Tipado (contextIsolation=true, sandbox=true)
Main Process (Node.js 22)
   └─ Cognitive Runtime
        ├─ Context Assembly & Recall L0-L3
        ├─ Memory Adapter ──► NativeVantaDB (in-process Fjall LSM)
        │                   └─► vantadb-mcp (subprocess cognitivo ONNX)
        ├─ Model Router ────► AI SDK v7 / Providers (Cloud & Local)
        ├─ Sub-Ego Runtime (Lifecycle, Factory, Manifests)
        ├─ Tool Registry ───► Execution Manager (Timeouts, Quotas, Abort)
        ├─ Governance Engine (Approval HITL, ActionIdentity, Quarantine)
        ├─ Event Bus (EgoEvent tipado, microtask async, zero secrets)
        └─ Dynamic Workspace Runtime (Component Registry, Canvas)
```

---

## 🛠️ Stack Tecnológico

* **Desktop Runtime:** Electron 33 + electron-vite (Main en Node.js 22, Renderer en Chromium).
* **Frontend:** React 19 + TypeScript (strict) + Tailwind CSS + `@assistant-ui/react`.
* **Memoria y Recuperación:** VantaDB 0.8.0 (`NativeVantaDB` de `"vantadb/native"` in-process) + subproceso `vantadb-mcp`.
* **Modelos & LLM:** Vercel AI SDK v7 como adaptador de protocolo + Model Router multidimensional propio.
* **Gestor de Monorepo:** pnpm workspaces (`packages/*` y `apps/*`).

---

## 🚀 Comandos de Desarrollo

```powershell
# Instalación de dependencias congeladas
pnpm install --frozen-lockfile

# Compilación completa (Renderer + Desktop Main)
pnpm build

# Ejecución de suites de prueba
pnpm test

# Verificación de tipos estricta
pnpm typecheck

# Modo desarrollo
pnpm dev
```

---

## 📚 Documentación Canónica

La autoridad y evolución de Ego se rige por la [Jerarquía Canónica](docs/jerarquia-canonica.md) (12 niveles de prelación):

* [`docs/product/principios-innegociables.md`](docs/product/principios-innegociables.md): Los 10 mandamientos de diseño.
* [`docs/architecture/arquitectura-unificada.md`](docs/architecture/arquitectura-unificada.md): Constitución técnica de Ego.
* [`docs/architecture/agentes.md`](docs/architecture/agentes.md): Arquitectura dinámica de Sub-Egos y Meta-Ego.
* [`docs/architecture/workspace-dinamico.md`](docs/architecture/workspace-dinamico.md): Canvas generativo y UI Runtime.
* [`docs/architecture/namespaces.md`](docs/architecture/namespaces.md): Estructura de memoria compartida y privada.
* [`docs/roadmap/Backlog.md`](docs/roadmap/Backlog.md): Backlog maestro en 12 fases con compuertas de extracción.

---

## 📄 Licencia

Este proyecto está licenciado bajo la **Licencia Apache 2.0**. Consulta el archivo [LICENSE](LICENSE) para más detalles.
