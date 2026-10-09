# Dev Tools — Entorno de Desarrollo y Herramientas (Ego)

> **Fuente de consulta operativa on-demand.** Define el herramental estándar, scripts de verificación y comandos canónicos del monorepo Ego (Electron + React 19 + TypeScript + Node 22).

---

## 1. Comandos Operativos del Monorepo (`pnpm`)

Ego se gestiona mediante un monorepo pnpm (`pnpm-workspace.yaml`).

| Comando | Propósito | Alcance |
|---|---|---|
| `pnpm install --frozen-lockfile` | Instalación reproducible y determinista de dependencias | Todo el monorepo |
| `pnpm build` | Compilación dual: `@ego/renderer` con Vite y `@ego/desktop` con TypeScript | Aplicación Desktop |
| `pnpm typecheck` | Verificación de tipos estricta sin emisión (`tsc --noEmit`) | Todo el monorepo |
| `pnpm test` | Ejecución de suites de pruebas automáticas | Todo el monorepo |
| `pnpm dev` | Entorno de desarrollo local con recarga rápida (HMR) | Aplicación Desktop |
| `pnpm lint` | Validación de estilo y buenas prácticas | Todo el monorepo |

---

## 2. Scripts de Verificación de Ingeniería (`.agents/dev-tools/`)

Scripts en PowerShell (`pwsh`) para fast-gates locales y aseguramiento de calidad antes de commits:

| Script | Propósito | Modo de Uso |
|---|---|---|
| `verify.ps1` | Fast gate universal: valida stack, ejecuta typecheck y suites de tests | `pwsh .agents/dev-tools/verify.ps1` |
| `verify_changed.ps1` | Verificación scoped al git diff: solo evalúa archivos modificados | `pwsh .agents/dev-tools/verify_changed.ps1` |
| `floor-guard.ps1` | Calidad de piso: supresiones no autorizadas, stubs vacíos, secretos o relajación de gates | `pwsh .agents/dev-tools/floor-guard.ps1` |
| `check-agents-refs.ps1` | Anti-drift: valida que toda ruta entre backticks en `AGENTS.md` exista en el disco | `pwsh .agents/dev-tools/check-agents-refs.ps1` |
| `clean-artifacts.ps1` | Limpieza de cachés temporales de build (`dist/`, `out/`, etc.) | `pwsh .agents/dev-tools/clean-artifacts.ps1 -Clean` |

---

## 3. Servidor MCP Canónico (`agent-system`)

El ecosistema de agentes se ejecuta sobre el servidor MCP unificado:

* **Punto de Entrada:** `node .agents/task-system/mcp/agent-system-server.mjs`
* **Transporte:** Stdio (JSON-RPC 2.0).
* **Dominios Provistos:**
  1. `workflow_*`: Gestión de pipelines, auditorías, especificaciones y salud.
  2. `task_*`: Ciclo de vida C0 de tareas (`task_get_next`, `task_update_state`, `task_validate_scope`, `task_verify_cmd`).
  3. `catalog_*`: Reglas normativas (`catalog_get_rule`), agentes (`catalog_get_agent`), skills y referencias.
  4. `memory_*`: Memoria persistente de decisiones y lecciones aprendidas.
  5. `campaign_*`: Descubrimiento de skills (SDP v3), traits de modelos y detección de tareas estancadas.

---

## 4. Git Aliases Recomendados

Configurados en el entorno local para agilidad de turnos:

| Alias | Comando real | Propósito |
|---|---|---|
| `git st` | `status -sb` | Estado conciso del árbol de trabajo |
| `git lg` | `log --oneline --graph --all --decorate` | Historial de commits visual |
| `git ci` | `commit` | Crear commit con mensaje semántico |
| `git co` | `checkout` | Cambio de rama o checkout |
| `git up` | `push -u origin HEAD` | Publicar rama al remoto |
| `git undo` | `reset --soft HEAD~1` | Deshacer último commit preservando cambios |

---

## 5. Flujo Diario Recomendado

```bash
# 1. Obtener la siguiente tarea pendiente
# (Vía MCP task_get_next o consulta al Backlog maestro)

# 2. Implementar cambios respetando el alcance (blast radius)
# Editar código en packages/ o apps/desktop

# 3. Verificación rápida local (pre-commit gate)
powershell -NoProfile -File .agents/dev-tools/verify_changed.ps1

# 4. Chequeo de tipos estricto
npx tsc --noEmit -p apps/desktop

# 5. Commit semántico (Conventional Commits)
git add -A
git commit -m "feat(runtime): implementar nuevo conector de herramienta"
```
