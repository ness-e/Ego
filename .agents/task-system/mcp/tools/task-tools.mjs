// task-tools.mjs — Herramientas del motor de ciclo de vida de tareas y C0 (.agents/task-system)
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, appendFileSync, mkdirSync } from "node:fs"
import { join, resolve, basename } from "node:path"
import { execSync } from "node:child_process"
import { z } from "zod"
import {
  parseTasks,
  parseTasksFromBacklog,
  findTaskById,
  validateBacklogFormat,
  validatePlanFormat,
  validateTaskFileFormat
} from "../parsers.mjs"
import { syncTaskState, STATE_MAPPINGS } from "../sync-engine.mjs"

export function registerTaskTools(server, { AGENTS_ROOT, PROJECT_ROOT, config }) {
  // Helper para resolver el plan file activo
  function resolvePlan(planFile) {
    if (planFile) {
      const explicit = resolve(PROJECT_ROOT, planFile)
      if (existsSync(explicit)) return explicit
    }
    const configuredPlans = config?.paths?.plans ? [join(PROJECT_ROOT, config.paths.plans)] : []
    const planDirs = [
      ...configuredPlans,
      join(PROJECT_ROOT, "docs", "agent-ops", "plans"),
      join(PROJECT_ROOT, "docs", "plans"),
      join(PROJECT_ROOT, "docs", "dev", "plans"),
      join(PROJECT_ROOT, "docs", "roadmap", "plans")
    ]
    for (const dir of planDirs) {
      if (existsSync(dir)) {
        const files = readdirSync(dir)
          .filter(f => f.endsWith(".md") && !f.startsWith("."))
          .map(f => ({ path: join(dir, f), time: statSync(join(dir, f)).mtimeMs }))
          .sort((a, b) => b.time - a.time)
        if (files.length > 0) return files[0].path
      }
    }
    return null
  }

  // Helper para resolver el backlog
  function resolveBacklog() {
    const defaultRel = config?.paths?.backlog || "docs/roadmap/Backlog.md"
    const candidates = [
      join(PROJECT_ROOT, defaultRel),
      join(PROJECT_ROOT, "docs", "roadmap", "Backlog.md"),
      join(PROJECT_ROOT, "docs", "Backlog.md"),
      join(PROJECT_ROOT, "Backlog.md")
    ]
    for (const c of candidates) {
      if (existsSync(c)) return c
    }
    return null
  }

  // Helper para detectar task files incompletos o en progreso
  function findIncompleteTaskFiles() {
    const configuredTasks = config?.paths?.tasks ? [join(PROJECT_ROOT, config.paths.tasks)] : []
    const taskDirs = [
      ...configuredTasks,
      join(PROJECT_ROOT, "docs", "agent-ops", "tasks"),
      join(PROJECT_ROOT, "docs", "tasks"),
      join(PROJECT_ROOT, "docs", "dev", "tasks")
    ]
    for (const dir of taskDirs) {
      if (existsSync(dir)) {
        const files = readdirSync(dir)
          .filter(f => f.endsWith(".md") && !f.startsWith(".") && f !== "README.md")
          .map(f => join(dir, f))

        for (const file of files) {
          try {
            const text = readFileSync(file, "utf-8")
            const isCompleted = text.includes("✅ COMPLETED") || text.includes("✅ Completada")
            const isDiscarded = text.includes("🚫 DISCARDED") || text.includes("🚫 Descartada")
            if (isCompleted || isDiscarded) continue

            const isInProgress = text.includes("⏳ EN PROGRESO") || text.includes("⏳ IN PROGRESS")
            const hasPendingSteps = /- \[ \]/.test(text)
            const idMatch = basename(file, ".md")

            if (isInProgress || hasPendingSteps) {
              const titleMatch = text.match(/^#\s+(?:Task:\s*)?[A-Z0-9_-]+(?:\s*[:—]\s*(.+))?/im)
              const taskName = titleMatch?.[1]?.trim() || idMatch

              return {
                source: "task-file-in-progress",
                taskFile: basename(file),
                taskPath: file,
                taskId: idMatch,
                name: taskName,
                state: isInProgress ? "⏳ EN PROGRESO" : "⬜ PENDING",
                hasPendingSteps
              }
            }
          } catch (e) {
            // Ignorar errores de lectura en archivos individuales
          }
        }
      }
    }
    return null
  }

  // 1. task_get_next
  server.tool(
    "task_get_next",
    {
      planFile: z.string().optional().describe("Ruta opcional al plan file")
    },
    async ({ planFile }) => {
      try {
        // A. Prioridad 1: Detectar tareas con task file ya iniciado e incompleto
        const incompleteTask = findIncompleteTaskFiles()
        if (incompleteTask) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                note: "Tarea en curso detectada en docs/agent-ops/tasks/. Priorizando reanudación antes de abrir nuevas tareas.",
                ...incompleteTask
              }, null, 2)
            }]
          }
        }

        const planPath = resolvePlan(planFile)

        // B. Prioridad 2: Si hay plan file activo, obtener la siguiente tarea del plan
        if (planPath) {
          const content = readFileSync(planPath, "utf-8")
          const tasks = parseTasks(content)

          if (tasks.length === 0) {
            // Validar formato para guiar al usuario
            const validation = validatePlanFormat(content, basename(planPath))
            if (!validation.isValid || validation.warnings.length > 0) {
              return {
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    error: "Formato de plan no reconocido o mal formado.",
                    planFile: basename(planPath),
                    diagnostics: validation.errors.concat(validation.warnings),
                    howToFix: validation.fixGuide
                  }, null, 2)
                }]
              }
            }
          }

          const next = tasks.find(t => t.state.includes("PENDING") || t.state.includes("⬜") || t.state.includes("IN PROGRESS") || t.state.includes("⏳"))
          if (next) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  source: "plan",
                  planFile: basename(planPath),
                  taskId: next.id,
                  name: next.name,
                  state: next.state,
                  priority: next.priority,
                  files: next.files,
                  contract: next.contract
                }, null, 2)
              }]
            }
          }
        }

        // Si no hay plan activo o todas las tareas del plan están terminadas:
        // Cae de manera fluida y canónica al Backlog general (docs/roadmap/Backlog.md)
        const backlogPath = resolveBacklog()
        if (backlogPath) {
          const backlogContent = readFileSync(backlogPath, "utf-8")
          const backlogValidation = validateBacklogFormat(backlogContent, basename(backlogPath))

          if (!backlogValidation.isValid) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  error: "Error de formato detectado en el Backlog canónico.",
                  backlogFile: basename(backlogPath),
                  errors: backlogValidation.errors,
                  howToFix: backlogValidation.fixGuide
                }, null, 2)
              }]
            }
          }

          const backlogTasks = parseTasksFromBacklog(backlogContent)
          // Filtrar activas: '⬜ PENDING' o '⏳ IN PROGRESS'
          const activeBacklog = backlogTasks.filter(t => t.state.includes("PENDING") || t.state.includes("IN PROGRESS"))

          if (activeBacklog.length > 0) {
            // Ordenar por prioridad heurística (P0 > P1 > P2 > P3)
            const prioScore = (p) => {
              if (p.includes("P0")) return 4
              if (p.includes("P1")) return 3
              if (p.includes("P2")) return 2
              return 1
            }
            activeBacklog.sort((a, b) => prioScore(b.priority) - prioScore(a.priority))
            const chosen = activeBacklog[0]

            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  source: "backlog",
                  backlogFile: basename(backlogPath),
                  note: planPath ? `Todas las tareas en '${basename(planPath)}' están completadas. Obteniendo siguiente prioridad del Backlog maestro.` : "Sin plan activo; obteniendo siguiente tarea por prioridad desde el Backlog.",
                  taskId: chosen.id,
                  name: chosen.name,
                  severity: chosen.severity,
                  priority: chosen.priority,
                  effort: chosen.effort,
                  state: chosen.state,
                  files: chosen.files,
                  contract: chosen.contract,
                  description: chosen.description
                }, null, 2)
              }]
            }
          }
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message: "Todas las tareas registradas están completadas tanto en el plan activo como en el backlog maestro.",
              planFile: planPath ? basename(planPath) : null
            }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error in task_get_next: ${err.message}` }] }
      }
    }
  )

  // 2. task_get_detail
  server.tool(
    "task_get_detail",
    {
      taskId: z.string().describe("ID de la tarea (ej: HARD-01, CORE-02, CANV-01)"),
      planFile: z.string().optional().describe("Ruta opcional al plan file")
    },
    async ({ taskId, planFile }) => {
      try {
        const cleanId = taskId.replace(/^`|`$/g, "").trim()

        // A. Buscar primero si existe el task file dedicado en docs/agent-ops/tasks/<ID>.md
        const tasksDir = join(PROJECT_ROOT, config?.paths?.tasks || "docs/agent-ops/tasks")
        const taskFile = join(tasksDir, `${cleanId}.md`)
        if (existsSync(taskFile)) {
          const detail = readFileSync(taskFile, "utf-8")
          return { content: [{ type: "text", text: `### [Task File] ${cleanId}.md\n\n${detail}` }] }
        }

        // B. Buscar en el plan activo si existe
        const planPath = resolvePlan(planFile)
        if (planPath) {
          const content = readFileSync(planPath, "utf-8")
          const task = findTaskById(content, cleanId)
          if (task) {
            return { content: [{ type: "text", text: `### [Plan File: ${basename(planPath)}]\n\n${task.header}` }] }
          }
        }

        // C. Buscar en el Backlog canónico
        const backlogPath = resolveBacklog()
        if (backlogPath) {
          const backlogContent = readFileSync(backlogPath, "utf-8")
          const tasks = parseTasksFromBacklog(backlogContent)
          const found = tasks.find(t => t.id.toLowerCase() === cleanId.toLowerCase())
          if (found) {
            const formatted = `
# Tarea ${found.id}: ${found.name}
- **Severidad / Criticidad:** ${found.severity}
- **Prioridad:** ${found.priority}
- **Esfuerzo estimado:** ${found.effort}
- **Estado:** ${found.state}
- **Archivos / Scope:** \`${found.files}\`
- **Descripción:** ${found.description}
- **Dependencias:** ${found.dependencies}
- **Notas / Relaciones:** ${found.notes}
- **Fuente:** ${basename(backlogPath)} (Línea ${found.lineIndex + 1})
`.trim()
            return { content: [{ type: "text", text: formatted }] }
          }
        }

        return {
          isError: true,
          content: [{
            type: "text",
            text: `Tarea con ID '${cleanId}' no encontrada en task files (docs/agent-ops/tasks/), plan file activo ni en el backlog maestro.`
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error in task_get_detail: ${err.message}` }] }
      }
    }
  )

  // 3. task_update_state (Motor de Sincronización Total)
  server.tool(
    "task_update_state",
    {
      taskId: z.string().describe("ID de la tarea (ej: CORE-01, CANV-02, HERM-03)"),
      newState: z.enum(["PENDING", "IN PROGRESS", "COMPLETED", "FAILED", "DISCARDED"]).describe("Nuevo estado: PENDING | IN PROGRESS | COMPLETED | FAILED | DISCARDED"),
      evidence: z.string().optional().describe("Evidencia de verificación o justificación técnica del cambio de estado (OBLIGATORIA para DISCARDED)"),
      commitSha: z.string().optional().describe("SHA del commit asociado si se ejecutó git commit"),
      planFile: z.string().optional().describe("Ruta opcional al plan file")
    },
    async ({ taskId, newState, evidence, commitSha, planFile }) => {
      try {
        const cleanId = taskId.replace(/^`|`$/g, "").trim()

        if (newState === "DISCARDED" && (!evidence || evidence.trim().length === 0)) {
          return {
            isError: true,
            content: [{
              type: "text",
              text: `⚠️ [Directriz de Veredicto Técnico]: Descartar la tarea '${cleanId}' requiere obligatoriamente un fundamento técnico en el parámetro 'evidence' (ej: 'Incompatible con stack Electron/Node; viola AGENTS.md §4: prohibido runtime Python local').`
            }]
          }
        }

        // Ejecutar sincronización multi-archivo a través de sync-engine
        const syncResult = syncTaskState({
          taskId: cleanId,
          newState,
          evidence,
          commitSha,
          planFile,
          PROJECT_ROOT,
          config
        })

        const summary = [
          `✅ **Sincronización Total de Tarea '${cleanId}' completada.**`,
          `- **Nuevo Estado:** ${syncResult.newState}`,
          `- **Timestamp:** ${syncResult.timestamp}`,
          `- **Archivos Sincronizados (${syncResult.updatedFiles.length}):**`,
          ...syncResult.updatedFiles.map(u => `  * \`${u.file}\` (${u.type}): ${u.action}`),
        ]

        if (syncResult.warnings.length > 0) {
          summary.push(`- **Advertencias:**`)
          syncResult.warnings.forEach(w => summary.push(`  ⚠️ ${w}`))
        }

        return {
          content: [{
            type: "text",
            text: summary.join("\n")
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error updating task state: ${err.message}` }] }
      }
    }
  )

  // 4. task_validate_format (Nueva herramienta de diagnóstico y autoreparación)
  server.tool(
    "task_validate_format",
    {
      targetFile: z.string().optional().describe("Ruta opcional al archivo a validar (por defecto valida Backlog.md y el plan activo)")
    },
    async ({ targetFile }) => {
      try {
        const results = []

        if (targetFile) {
          const fullPath = resolve(PROJECT_ROOT, targetFile)
          if (!existsSync(fullPath)) {
            return { isError: true, content: [{ type: "text", text: `Archivo '${targetFile}' no encontrado.` }] }
          }
          const content = readFileSync(fullPath, "utf-8")
          const leaf = basename(fullPath).toLowerCase()

          if (leaf.includes("backlog")) {
            results.push(validateBacklogFormat(content, basename(fullPath)))
          } else if (leaf.endsWith(".md") && fullPath.includes("tasks")) {
            results.push(validateTaskFileFormat(content, basename(fullPath)))
          } else {
            results.push(validatePlanFormat(content, basename(fullPath)))
          }
        } else {
          // Validar Backlog canónico
          const backlogPath = resolveBacklog()
          if (backlogPath) {
            const bc = readFileSync(backlogPath, "utf-8")
            results.push(validateBacklogFormat(bc, basename(backlogPath)))
          }
          // Validar Plan activo si existe
          const planPath = resolvePlan()
          if (planPath) {
            const pc = readFileSync(planPath, "utf-8")
            results.push(validatePlanFormat(pc, basename(planPath)))
          }
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify(results, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error validating format: ${err.message}` }] }
      }
    }
  )

  // 5. task_validate_scope
  server.tool(
    "task_validate_scope",
    {
      taskId: z.string().describe("ID de la tarea"),
      filePath: z.string().describe("Ruta del archivo a modificar (relativa al workspace)"),
      planFile: z.string().optional().describe("Ruta opcional al plan file")
    },
    async ({ taskId, filePath, planFile }) => {
      try {
        if (!taskId || !filePath) {
          return { isError: true, content: [{ type: "text", text: "Parámetros 'taskId' y 'filePath' son obligatorios para task_validate_scope." }] }
        }

        const cleanId = String(taskId).replace(/^`|`$/g, "").trim()
        const planPath = resolvePlan(planFile)
        let declared = []

        if (planPath) {
          const content = readFileSync(planPath, "utf-8")
          const task = findTaskById(content, cleanId)
          if (task && task.files) {
            declared = task.files.split(/[,;·\n]+|\s+·\s+/).map(f => f.trim().replace(/^`|`$/g, "")).filter(Boolean)
          }
        }

        // Si no se encontró en el plan, consultar Backlog
        if (declared.length === 0) {
          const backlogPath = resolveBacklog()
          if (backlogPath) {
            const bc = readFileSync(backlogPath, "utf-8")
            const tasks = parseTasksFromBacklog(bc)
            const bTask = tasks.find(t => t.id.toLowerCase() === cleanId.toLowerCase())
            if (bTask && bTask.files) {
              declared = bTask.files.split(/[,;·\n]+|\s+·\s+/).map(f => f.trim().replace(/^`|`$/g, "")).filter(Boolean)
            }
          }
        }

        const normalized = filePath.replace(/\\/g, "/")
        const inScope = declared.length === 0 || declared.some(d => normalized.includes(d) || d.includes(normalized))

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              taskId: cleanId,
              filePath,
              inScope,
              declaredScope: declared,
              warning: inScope ? null : "El archivo a editar no está listado en el alcance explícito de la tarea."
            }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error validating scope: ${err.message}` }] }
      }
    }
  )

  // 6. task_verify_cmd (con defensas anti-RCE, allowlist y audit log append-only)
  server.tool(
    "task_verify_cmd",
    {
      command: z.string().describe("Comando determinista de verificación (ej: git status, powershell .agents/dev-tools/verify.ps1)"),
      timeoutMs: z.number().optional().default(30000).describe("Timeout en milisegundos (máximo 120000)")
    },
    async ({ command, timeoutMs }) => {
      const startTime = Date.now()
      const trimmedCmd = command.trim()

      // 1. Patrones peligrosos/destructivos bloqueados
      const DANGEROUS_PATTERNS = [
        /\brm\s+-[rRfF]+/i,
        /\bdel\s+\/[sS]/i,
        /\brd\s+\/[sS]/i,
        /\bformat\b\s+[a-z]:/i,
        /\bmkfs\b/i,
        /\bdd\s+if=/i,
        /\bchmod\s+777\b/i,
        /\bchown\b/i,
        /\bshutdown\b/i,
        /\breboot\b/i,
        /\bdiskpart\b/i,
        /\bbcdedit\b/i,
        /\bRemove-Item\b[^\n]*-Recurse[^\n]*-Force/i,
        /\bFormat-Volume\b/i,
        />\s*\\\\?\\PhysicalDrive/i
      ]

      for (const p of DANGEROUS_PATTERNS) {
        if (p.test(trimmedCmd)) {
          return {
            isError: true,
            content: [{
              type: "text",
              text: `🛑 Rechazo de Seguridad: El comando contiene patrones destructivos no permitidos por la política de seguridad (${p}).`
            }]
          }
        }
      }

      // 2. Allowlist de prefijos/binarios para verificación de ingeniería
      const ALLOWED_PREFIXES = [
        "pnpm", "npm", "npx", "node",
        "powershell", "pwsh",
        "git", "echo", "cargo",
        "python", "py", "pytest", "vitest",
        ".agents", "./.agents", "scripts", "./scripts"
      ]

      const firstToken = trimmedCmd.split(/[\s"']+/)[0].replace(/^[\.\\\/]+/, "")
      const isAllowed = ALLOWED_PREFIXES.some(prefix => {
        const cleanPfx = prefix.replace(/^[\.\\\/]+/, "")
        return firstToken.toLowerCase().startsWith(cleanPfx.toLowerCase()) || trimmedCmd.toLowerCase().startsWith(prefix.toLowerCase())
      })

      if (!isAllowed) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `🛑 Rechazo de Seguridad: El comando '${firstToken}' no forma parte de la lista blanca de verificación permitida (${ALLOWED_PREFIXES.slice(0, 8).join(", ")}...).`
          }]
        }
      }

      const safeTimeout = Math.min(Math.max(timeoutMs || 30000, 1000), 120000)
      let exitCode = 0
      let outputText = ""
      let stderrText = ""

      try {
        outputText = execSync(command, {
          cwd: PROJECT_ROOT,
          timeout: safeTimeout,
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "pipe"]
        })
      } catch (err) {
        exitCode = err.status || 1
        outputText = err.stdout || ""
        stderrText = err.stderr || err.message
      }

      const durationMs = Date.now() - startTime

      // 3. Registro de auditoría (audit log append-only)
      try {
        const reportsDir = resolve(PROJECT_ROOT, config?.paths?.reports || "docs/agent-ops/reports")
        if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true })
        const auditFile = join(reportsDir, "verify-audit.jsonl")
        const auditEntry = {
          timestamp: new Date().toISOString(),
          command: trimmedCmd,
          exitCode,
          durationMs,
          success: exitCode === 0,
          outputLength: outputText.length,
          hasStderr: stderrText.length > 0
        }
        appendFileSync(auditFile, JSON.stringify(auditEntry) + "\n", "utf-8")
      } catch {}

      if (exitCode === 0) {
        return { content: [{ type: "text", text: `✅ [Exit Code 0 · ${durationMs}ms]\n${outputText}` }] }
      } else {
        return {
          content: [{
            type: "text",
            text: `❌ [Exit Code ${exitCode} · ${durationMs}ms]\nSTDOUT:\n${outputText}\nSTDERR:\n${stderrText}`
          }]
        }
      }
    }
  )

  // 7. task_budget_status
  server.tool(
    "task_budget_status",
    {
      taskId: z.string().describe("ID de la tarea")
    },
    async ({ taskId }) => {
      try {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              taskId,
              budgetLimits: {
                maxRounds: 15,
                maxFilesModified: 10,
                maxDurationMinutes: 45
              },
              status: "ACTIVE",
              recommendation: "Mantener cambios atómicos dentro del radio de impacto declarado."
            }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error checking budget: ${err.message}` }] }
      }
    }
  )
}
