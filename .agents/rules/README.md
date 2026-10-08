# Ego — Reglas Normativas del Sistema Cognitivo (`.agents/rules/`)

> **Propósito:** Catálogo normativo prescriptivo (Must / Must-not / Por qué) por área técnica de Ego (Sistema Operativo Cognitivo). Todo agente y desarrollador debe cumplir estas directrices obligatorias al interactuar con el código.
> **Naturaleza:** Reglas duras de gobernanza técnica derivadas de `AGENTS.md` y las 25 decisiones fundacionales. No sustituyen el material de consulta (`references/`) ni los procedimientos (`skills/`).

---

## Protocolo de Carga Bajo Demanda (Lazy-Loading)

Los agentes no cargan la carpeta completa en su contexto:
1. **Identificar el área de impacto:** Consultar la tabla de índice antes de realizar cualquier cambio.
2. **Carga puntual:** Invocar la herramienta `catalog_get_rule` (o leer el archivo con la herramienta de lectura) correspondiente al módulo afectado.
3. **Cumplimiento estricto:** Las directrices son vinculantes. Ningún cambio puede relajar o evadir una regla normativa.

---

## Catálogo Canónico de Reglas de Ego (10 Reglas)

| # | Archivo | Alcance (Scope) | Propósito Normativo |
|---|---|---|---|
| 1 | `api-contract.md` | `packages/*/src/index.ts`, contratos públicos | Estabilidad de APIs públicas, exportaciones tipadas y compatibilidad hacia atrás. |
| 2 | `definition-of-done.md` | Todo el repositorio, quality gates | Criterios innegociables de aceptación (código + tests + docs + sin regresiones). |
| 3 | `electron-ipc.md` | `apps/desktop/src/` (main, preload, renderer) | Seguridad Electron (`contextIsolation=true`, `sandbox=true`), IPC fuertemente tipado. |
| 4 | `frontend-web.md` | `apps/desktop/renderer/`, `@assistant-ui/react` | Presentación React 19 desacoplada de Node. Prohibida lógica de negocio en renderer. |
| 5 | `git-workflow.md` | Git commits, ramas, PRs | Conventional Commits en inglés, cambios atómicos y trazabilidad de releases. |
| 6 | `gobernanza-desktop.md` | `packages/governance/`, HITL, permisos | Control de acceso, aprobación humana para acciones destructivas y sandbox. |
| 7 | `js-ecosystem.md` | Raíz, `packages/*`, monorepo pnpm | Node.js 22, pnpm workspaces, TypeScript strict (prohibido `any` injustificado). |
| 8 | `memory-budget.md` | `packages/memory/`, límites RSS | Gestión de memoria in-process, prevención de fugas y topes de buffers. |
| 9 | `namespaces-jev.md` | `packages/memory/`, `packages/decision/` | Jerarquía de namespaces VantaDB y enrutamiento con Decision Intelligence. |
| 10 | `task-lifecycle.md` | `docs/agent-ops/`, `task-system/` | Máquina de estados C0 (`PENDING` → `IN PROGRESS` → `COMPLETED` / `DISCARDED`). |

---

## Reglas para la Modificación del Catálogo (Metarreglas R1–R5)

1. **R1 — Un área por archivo:** Cada archivo cubre una frontera de diseño sin solapamientos.
2. **R2 — Formato canónico:** Toda regla debe estructurarse con `Must`, `Must not` y `Por qué`.
3. **R3 — Justificación causal:** Prohibido emitir prohibiciones sin fundamentar el impacto técnico.
4. **R4 — No duplicidad:** No copiar código ni documentación canónica de `docs/`; referenciar por ruta.
5. **R5 — Registro de cambios:** Cualquier mutación en las reglas requiere justificación explícita.
