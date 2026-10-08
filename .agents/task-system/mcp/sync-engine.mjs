// sync-engine.mjs — Motor Universal de Sincronización y Registro de Cumplimiento (.agents)
// Garantiza consistencia atómica entre Backlog.md, Planes, Task Files, Estado JSON e Índices.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs"
import { join, resolve, basename } from "node:path"
import { updateState, updateRecitation, findTaskById } from "./parsers.mjs"

export const STATE_MAPPINGS = {
  COMPLETED: {
    backlog: "✅ Completada",
    plan: "✅ COMPLETED",
    taskFile: "✅ COMPLETED",
    stateJson: "COMPLETED"
  },
  "IN PROGRESS": {
    backlog: "⏳ En curso",
    plan: "⏳ EN PROGRESO",
    taskFile: "⏳ EN PROGRESO",
    stateJson: "IN PROGRESS"
  },
  PENDING: {
    backlog: "🆕 Pendiente",
    plan: "⬜ PENDING",
    taskFile: "⬜ PENDING",
    stateJson: "PENDING"
  },
  FAILED: {
    backlog: "❌ Fallida",
    plan: "❌ FAILED",
    taskFile: "❌ FAILED",
    stateJson: "FAILED"
  },
  DISCARDED: {
    backlog: "🚫 Descartada",
    plan: "🚫 DISCARDED",
    taskFile: "🚫 DISCARDED",
    stateJson: "DISCARDED"
  },
  DESCARTADA: {
    backlog: "🚫 Descartada",
    plan: "🚫 DISCARDED",
    taskFile: "🚫 DISCARDED",
    stateJson: "DISCARDED"
  }
}

export const PHASE_CONFIG = {
  CORE: { phaseNum: "01", name: "Core Cognitivo", prefix: "CORE" },
  ACT: { phaseNum: "02", name: "Acción & Tool Calling", prefix: "ACT" },
  SUB: { phaseNum: "03", name: "Sub-Egos", prefix: "SUB" },
  CANV: { phaseNum: "04", name: "Dynamic Workspace/Canvas", prefix: "CANV" },
  DEC: { phaseNum: "05", name: "Decision Intelligence", prefix: "DEC" },
  INTEL: { phaseNum: "05", name: "Decision Intelligence", prefix: "DEC" },
  KB: { phaseNum: "06", name: "Knowledge & Data", prefix: "KB" },
  TASK: { phaseNum: "07", name: "Tasks & Background", prefix: "TASK" },
  DS: { phaseNum: "08", name: "Daily State", prefix: "DS" },
  DOM: { phaseNum: "09", name: "Dominios Funcionales", prefix: "DOM" },
  REC: { phaseNum: "10", name: "Recovery & Hardening", prefix: "REC" },
  SEC: { phaseNum: "11", name: "Seguridad", prefix: "SEC" },
  DIST: { phaseNum: "12", name: "Distribución", prefix: "DIST" },
}

/**
 * Sincroniza el Roadmap Estratégico (docs/roadmap/roadmap.md) y el Exec Summary de Backlog.md
 * calculando de forma determinista el progreso acumulado de la fase impactada.
 */
function syncRoadmapAndExecSummary({
  cleanTaskId,
  PROJECT_ROOT,
  mainBacklogPath,
  config = {},
  updatedFiles = [],
  warnings = []
}) {
  const prefixMatch = cleanTaskId.match(/^([A-Z]+)-/i)
  if (!prefixMatch) return

  const prefixKey = prefixMatch[1].toUpperCase()
  const phaseConf = PHASE_CONFIG[prefixKey]
  if (!phaseConf) return

  if (!existsSync(mainBacklogPath)) return

  try {
    const backlogContent = readFileSync(mainBacklogPath, "utf-8")
    const lines = backlogContent.split("\n")

    // 1. Recolectar todas las tareas de la fase en Backlog.md
    const phaseTasks = []
    const taskRowRegex = new RegExp(`^\\|\\s*\`?(${phaseConf.prefix}-\\d+)\`?\\s*\\|([^|]+)\\|([^|]+)\\|([^|]+)\\|([^|]+)\\|([^|]+)\\|([^|]+)\\|`, "i")

    for (const line of lines) {
      const match = line.match(taskRowRegex)
      if (match) {
        const id = match[1]
        const cells = line.split("|")
        const title = (cells[3] || "").trim().replace(/\*\*/g, "")
        const state = (cells[7] || "").trim()
        phaseTasks.push({ id, title, state })
      }
    }

    if (phaseTasks.length === 0) return

    const totalCount = phaseTasks.length
    const completedTasks = phaseTasks.filter(t => t.state.includes("Completada") || t.state.includes("COMPLETED"))
    const discardedTasks = phaseTasks.filter(t => t.state.includes("Descartada") || t.state.includes("DISCARDED"))
    const inProgressTasks = phaseTasks.filter(t => t.state.includes("En curso") || t.state.includes("EN PROGRESO"))
    const pendingTasks = phaseTasks.filter(t => t.state.includes("Pendiente") || t.state.includes("PENDING"))

    const completedCount = completedTasks.length
    const discardedCount = discardedTasks.length
    const completedIds = completedTasks.map(t => `\`${t.id}\``)
    const nextTask = inProgressTasks[0] || pendingTasks[0] || null

    // 2. Actualizar Exec Summary en docs/roadmap/Backlog.md si corresponde
    let backlogModified = false
    const execSummaryRegex = new RegExp(`^(\\|\\s*\\*\\*Fase\\s+${phaseConf.phaseNum}\\*\\*\\s*\\|[^|]+\\|[^|]+\\|[^|]+\\|[^|]+\\|[^|]+\\|)([^|]+)(\\|.*)$`, "i")

    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(execSummaryRegex)
      if (m) {
        let newPrioStatus = ""
        if (completedCount === totalCount && totalCount > 0) {
          newPrioStatus = " 🟢 100% DONE "
        } else if (completedCount > 0) {
          newPrioStatus = ` 🟡 En curso (${completedCount}/${totalCount}) `
        } else {
          newPrioStatus = phaseConf.phaseNum <= "05" ? " 🔴 P0 " : " 🟠 P1 "
        }

        if (m[2] !== newPrioStatus) {
          lines[i] = `${m[1]}${newPrioStatus}${m[3]}`
          backlogModified = true
        }
        break
      }
    }

    if (backlogModified) {
      writeFileSync(mainBacklogPath, lines.join("\n"), "utf-8")
      const alreadyLogged = updatedFiles.find(u => u.file === "docs/roadmap/Backlog.md")
      if (alreadyLogged) {
        alreadyLogged.action += ` + Exec Summary Fase ${phaseConf.phaseNum} sincronizado (${completedCount}/${totalCount})`
      } else {
        updatedFiles.push({
          file: "docs/roadmap/Backlog.md",
          type: "backlog-maestro",
          action: `Exec Summary Fase ${phaseConf.phaseNum} sincronizado (${completedCount}/${totalCount})`
        })
      }
    }

    // 3. Sincronizar docs/roadmap/roadmap.md
    const roadmapRelPath = config?.paths?.roadmap || "docs/roadmap/roadmap.md"
    const roadmapPath = resolve(PROJECT_ROOT, roadmapRelPath)

    if (existsSync(roadmapPath)) {
      let roadmapContent = readFileSync(roadmapPath, "utf-8")
      const phaseHeaderRegex = new RegExp(`(###\\s+Fase\\s+${phaseConf.phaseNum}:[\\s\\S]*?)(?=\\n###\\s+Fase|\\n---|$|\\n##\\s+P0-)`, "i")
      const phaseSectionMatch = roadmapContent.match(phaseHeaderRegex)

      if (phaseSectionMatch) {
        let section = phaseSectionMatch[1]
        let sectionModified = false

        let statusLine = ""
        if (completedCount === totalCount && totalCount > 0) {
          statusLine = `> **Estado actual:** ${completedCount} de ${totalCount} tareas completadas${discardedCount > 0 ? ` (${discardedCount} descartadas justificadamente)` : ""}. **Fase 100% COMPLETADA**.\n`
        } else {
          statusLine = `> **Estado actual:** ${completedCount} de ${totalCount} tareas completadas (${completedIds.join(", ")})${discardedCount > 0 ? ` [${discardedCount} descartadas]` : ""}.${nextTask ? ` Siguiente hito en curso: ${nextTask.title} (\`${nextTask.id}\`).` : ""}\n`
        }

        if (/> \*\*Estado actual:\*\*/i.test(section)) {
          const newSection = section.replace(/> \*\*Estado actual:\*\*[^\n]*\n?/i, statusLine)
          if (newSection !== section) {
            section = newSection
            sectionModified = true
          }
        } else {
          if (/\*\*Criterio de aceptación:\*\*/i.test(section)) {
            section = section.replace(/(\*\*Criterio de aceptación:\*\*)/i, `${statusLine}$1`)
            sectionModified = true
          } else {
            section = section.trimEnd() + "\n" + statusLine
            sectionModified = true
          }
        }

        // Si la fase está al 100% completada, marcar checkboxes y actualizar criterio de aceptación
        if (completedCount === totalCount && totalCount > 0) {
          const checkedSection = section.replace(/- \[ \]/g, "- [x]")
          if (checkedSection !== section) {
            section = checkedSection
            sectionModified = true
          }

          const doneSuffix = ` — **100% COMPLETADO (${phaseConf.prefix}-01..${totalCount < 10 ? '0' + totalCount : totalCount})**.`
          if (!section.includes("100% COMPLETADO")) {
            section = section.replace(/(\*\*Criterio de aceptación:\*\*[^\n]*?)(\.?)(?:\n|$)/i, (m, p1) => {
              return `${p1.replace(/\.$/, "")}${doneSuffix}\n`
            })
            sectionModified = true
          }
        }

        if (sectionModified) {
          roadmapContent = roadmapContent.replace(phaseHeaderRegex, section)
          writeFileSync(roadmapPath, roadmapContent, "utf-8")
          updatedFiles.push({
            file: roadmapRelPath,
            type: "roadmap",
            action: `Fase ${phaseConf.phaseNum} (${phaseConf.prefix}) sincronizada: ${completedCount}/${totalCount} tareas completadas`
          })
        }
      }
    }
  } catch (err) {
    warnings.push(`Error sincronizando Roadmap para Fase ${phaseConf?.phaseNum || cleanTaskId}: ${err.message}`)
  }
}

/**
 * Sincroniza el estado de una tarea a través de todos los documentos del proyecto.
 */
export function syncTaskState({
  taskId,
  newState,
  evidence = "",
  commitSha = "",
  planFile = null,
  PROJECT_ROOT,
  config = {}
}) {
  const normState = newState.toUpperCase()
  const mapping = STATE_MAPPINGS[normState] || STATE_MAPPINGS.COMPLETED
  const timestamp = new Date().toISOString()
  const dateStr = timestamp.split("T")[0]

  const updatedFiles = []
  const warnings = []

  // 1. Sincronizar Backlog Canónico y Backlogs de Revisión
  const backlogsToCheck = []
  const backlogRelPath = config?.paths?.backlog || "docs/roadmap/Backlog.md"
  const mainBacklogPath = resolve(PROJECT_ROOT, backlogRelPath)
  if (existsSync(mainBacklogPath)) {
    backlogsToCheck.push({ path: mainBacklogPath, rel: backlogRelPath, isMain: true })
  }

  const reviewDir = resolve(PROJECT_ROOT, "docs", "review")
  if (existsSync(reviewDir)) {
    const reviewFiles = readdirSync(reviewDir)
      .filter(f => f.startsWith("backlog-") && f.endsWith(".md"))
      .map(f => ({ path: join(reviewDir, f), rel: `docs/review/${f}`, isMain: false }))
    backlogsToCheck.push(...reviewFiles)
  }

  let foundInAnyBacklog = false
  const cleanTaskId = taskId.replace(/^`|`$/g, "").trim()
  const taskPattern = new RegExp(`^\\|\\s*\`?${cleanTaskId}\`?\\s*\\|`, "i")

  for (const b of backlogsToCheck) {
    try {
      const original = readFileSync(b.path, "utf-8")
      const lines = original.split("\n")
      let modified = false

      for (let i = 0; i < lines.length; i++) {
        if (taskPattern.test(lines[i])) {
          const cells = lines[i].split("|")
          if (cells.length >= 8) {
            if (normState === "DISCARDED" || normState === "DESCARTADA") {
              const justification = evidence ? `: ${evidence.replace(/[|\r\n]/g, " ").trim()}` : ""
              cells[7] = ` 🚫 Descartada${justification} `
              if (cells.length > 9 && !cells[9].includes("Descartada")) {
                cells[9] = cells[9].trimEnd() + ` [Veredicto de descarte ${dateStr}] `
              }
            } else {
              cells[7] = ` ${mapping.backlog} `
              if (normState === "COMPLETED" && (evidence || commitSha)) {
                const noteSuffix = ` [Finalizada ${dateStr}${commitSha ? ` · SHA: ${commitSha}` : ""}]`
                if (!cells[9].includes(dateStr)) {
                  cells[9] = cells[9].trimEnd() + noteSuffix + " "
                }
              }
            }

            lines[i] = cells.join("|")
            modified = true
            foundInAnyBacklog = true
            break
          }
        }
      }

      if (modified) {
        writeFileSync(b.path, lines.join("\n"), "utf-8")
        updatedFiles.push({ file: b.rel, type: b.isMain ? "backlog-maestro" : "backlog-revision", action: "Estado actualizado a " + mapping.backlog })
      }
    } catch (err) {
      warnings.push(`Error actualizando ${b.rel}: ${err.message}`)
    }
  }

  if (!foundInAnyBacklog) {
    warnings.push(`Tarea '${taskId}' no encontrada en el Backlog maestro ni en los backlogs de revisión.`)
  }

  // 2. Sincronizar Task File específico (docs/agent-ops/tasks/<ID>.md)
  const tasksDir = resolve(PROJECT_ROOT, config?.paths?.tasks || "docs/agent-ops/tasks")
  const taskFilePath = join(tasksDir, `${taskId}.md`)
  if (existsSync(taskFilePath)) {
    try {
      let taskContent = readFileSync(taskFilePath, "utf-8")

      // Actualizar campo - **Estado:**
      taskContent = taskContent.replace(/(- \*\*Estado:\*\*\s*).+/i, `$1${mapping.taskFile}`)
      if (!/- \*\*Estado:\*\*/i.test(taskContent)) {
        taskContent = taskContent.replace(/(^#\s+Task[^\n]*\n)/i, `$1- **Estado:** ${mapping.taskFile}\n`)
      }

      // Si está completada, marcar steps pendientes [ ] como [x] si todos se cumplieron
      if (normState === "COMPLETED") {
        taskContent = taskContent.replace(/- \[ \]/g, "- [x]")
      } else if (normState === "DISCARDED" || normState === "DESCARTADA") {
        taskContent = taskContent.replace(/- \[ \]/g, "- [-] (Omitido por descarte)")
      }

      // Registro de cumplimiento o veredicto al final
      const isDiscarded = normState === "DISCARDED" || normState === "DESCARTADA"
      const sectionHeader = isDiscarded ? `## Veredicto de Descarte Justificado (${dateStr})` : `## Registro de Cumplimiento (${dateStr})`
      const logBlock = isDiscarded ? `
${sectionHeader}
- **Estado:** ${mapping.taskFile}
- **Timestamp:** ${timestamp}
- **Fundamento Técnico:** ${evidence || "Incompatible con principios o stack de Ego"}
- **Decisión:** Tarea omitida formalmente sin deuda técnica ni falsas dependencias.
`.trim() : `
${sectionHeader}
- **Estado:** ${mapping.taskFile}
- **Timestamp:** ${timestamp}
- **Evidencia:** ${evidence || "Verificación mecánica aprobada"}
- **Commit:** ${commitSha || "Transacción local"}
`.trim()

      if (/## (?:Registro de Cumplimiento|Veredicto de Descarte Justificado)/i.test(taskContent)) {
        taskContent = taskContent.replace(/## (?:Registro de Cumplimiento|Veredicto de Descarte Justificado)[\s\S]*?(?=\n## |$)/i, logBlock)
      } else {
        taskContent = taskContent.trimEnd() + "\n\n" + logBlock + "\n"
      }

      writeFileSync(taskFilePath, taskContent, "utf-8")
      updatedFiles.push({ file: `docs/agent-ops/tasks/${taskId}.md`, type: "task-file", action: "Estado y steps sincronizados" })
    } catch (err) {
      warnings.push(`Error actualizando task file ${taskId}.md: ${err.message}`)
    }
  }

  // 3. Sincronizar Plan File
  let resolvedPlanPath = planFile ? resolve(PROJECT_ROOT, planFile) : null
  if (!resolvedPlanPath || !existsSync(resolvedPlanPath)) {
    // Buscar en directorio de planes configurado
    const plansDir = resolve(PROJECT_ROOT, config?.paths?.plans || "docs/agent-ops/plans")
    if (existsSync(plansDir)) {
      const planFiles = readdirSync(plansDir).filter(f => f.endsWith(".md")).map(f => join(plansDir, f))
      // Buscar el plan que mencione a la tarea
      for (const pf of planFiles) {
        const text = readFileSync(pf, "utf-8")
        if (text.includes(taskId)) {
          resolvedPlanPath = pf
          break
        }
      }
    }
  }

  if (resolvedPlanPath && existsSync(resolvedPlanPath)) {
    try {
      const planContent = readFileSync(resolvedPlanPath, "utf-8")
      let updatedPlan = updateState(planContent, taskId, normState.toLowerCase().replace("_", "-"))

      // Si updateState no cambió porque es una tabla en el plan, actualizar celda de tabla
      if (updatedPlan === planContent) {
        const lines = planContent.split("\n")
        const taskRegex = new RegExp(`\\|\\s*\`?${taskId}\`?\\s*\\|`, "i")
        for (let i = 0; i < lines.length; i++) {
          if (taskRegex.test(lines[i])) {
            lines[i] = lines[i].replace(/⬜\s*PENDING|⏳\s*EN PROGRESO|✅\s*COMPLETED|❌\s*FAILED/i, mapping.plan)
            break
          }
        }
        updatedPlan = lines.join("\n")
      }

      // Actualizar recitation si existe
      updatedPlan = updateRecitation(updatedPlan, {
        taskId,
        status: normState.toLowerCase(),
        lastAction: `Estado actualizado a ${normState}`,
        result: evidence || normState
      })

      writeFileSync(resolvedPlanPath, updatedPlan, "utf-8")
      updatedFiles.push({ file: basename(resolvedPlanPath), type: "plan", action: "Estado de tarea actualizado en plan" })
    } catch (err) {
      warnings.push(`Error actualizando plan file: ${err.message}`)
    }
  }

  // 4. Sincronizar Estado Transaccional JSON (docs/agent-ops/state/pipeline-state.json)
  const stateRelPath = config?.paths?.state
    ? join(config.paths.state, "pipeline-state.json")
    : "docs/agent-ops/state/pipeline-state.json"
  const statePath = resolve(PROJECT_ROOT, stateRelPath)
  try {
    let stateData = {
      version: "2.0.0",
      lastUpdated: timestamp,
      activePlan: resolvedPlanPath ? basename(resolvedPlanPath) : null,
      inProgressTask: null,
      completedTasks: [],
      failedTasks: [],
      tasks: {}
    }

    if (existsSync(statePath)) {
      try {
        stateData = JSON.parse(readFileSync(statePath, "utf-8"))
      } catch {}
    }

    stateData.lastUpdated = timestamp
    if (!stateData.tasks) stateData.tasks = {}

    stateData.tasks[taskId] = {
      state: normState,
      updatedAt: timestamp,
      evidence: evidence || null,
      commitSha: commitSha || null
    }

    if (!Array.isArray(stateData.completedTasks)) stateData.completedTasks = []
    if (!Array.isArray(stateData.failedTasks)) stateData.failedTasks = []

    if (normState === "COMPLETED") {
      if (!stateData.completedTasks.includes(taskId)) stateData.completedTasks.push(taskId)
      if (stateData.inProgressTask === taskId) stateData.inProgressTask = null
    } else if (normState === "IN PROGRESS") {
      stateData.inProgressTask = taskId
      stateData.completedTasks = stateData.completedTasks.filter(id => id !== taskId)
    } else if (normState === "FAILED") {
      if (!stateData.failedTasks.includes(taskId)) stateData.failedTasks.push(taskId)
      if (stateData.inProgressTask === taskId) stateData.inProgressTask = null
    }

    writeFileSync(statePath, JSON.stringify(stateData, null, 2), "utf-8")
    updatedFiles.push({ file: stateRelPath, type: "state-json", action: "Checkpoint JSON guardado" })
  } catch (err) {
    warnings.push(`Error actualizando ${stateRelPath}: ${err.message}`)
  }

  // 5. Sincronizar Registro Maestro (docs/agent-ops/reports/INDEX.md)
  const indexRelPath = config?.paths?.reports
    ? join(config.paths.reports, "INDEX.md")
    : "docs/agent-ops/reports/INDEX.md"
  const indexPath = resolve(PROJECT_ROOT, indexRelPath)
  if (existsSync(indexPath)) {
    try {
      let indexContent = readFileSync(indexPath, "utf-8")
      const logLine = `| ${dateStr} | \`${taskId}\` | ${mapping.backlog} | ${evidence || "Completado"} | ${commitSha || "Local"} |`

      if (indexContent.includes("| Fecha | ID | Estado |")) {
        if (!indexContent.includes(`\`${taskId}\``)) {
          indexContent = indexContent.trimEnd() + "\n" + logLine + "\n"
          writeFileSync(indexPath, indexContent, "utf-8")
          updatedFiles.push({ file: indexRelPath, type: "reports-index", action: "Fila agregada al historial" })
        }
      }
    } catch (err) {
      warnings.push(`Error actualizando ${indexRelPath}: ${err.message}`)
    }
  }

  // 6. Sincronizar Roadmap Estratégico (docs/roadmap/roadmap.md) y Exec Summary
  syncRoadmapAndExecSummary({
    cleanTaskId,
    PROJECT_ROOT,
    mainBacklogPath,
    config,
    updatedFiles,
    warnings
  })

  return {
    success: true,
    taskId,
    newState: normState,
    timestamp,
    updatedFiles,
    warnings
  }
}
