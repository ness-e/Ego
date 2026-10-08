// workflow-tools.mjs — Herramientas para la orquestación de comandos y pipelines (.agents/commands/)
import { readFileSync, existsSync } from "node:fs"
import { join, resolve, basename } from "node:path"
import { z } from "zod"
import { parseTasksFromBacklog } from "../parsers.mjs"

export function registerWorkflowTools(server, { AGENTS_ROOT, PROJECT_ROOT, config }) {
  const COMMANDS_DIR = join(AGENTS_ROOT, "commands")
  const PROMPTS_DIR = join(AGENTS_ROOT, "task-system", "prompts")

  // Helper para leer markdown de comandos o prompts
  function readDoc(folder, filename) {
    const target = join(folder, filename)
    return existsSync(target) ? readFileSync(target, "utf-8") : null
  }

  // 1. workflow_pipeline
  server.tool(
    "workflow_pipeline",
    {
      mode: z.enum(["plan", "task", "run", "interactive"]).describe("Modo de ejecución del pipeline"),
      target: z.string().optional().describe("Ruta al backlog/plan en modo plan, o ID de tarea en modo task"),
      planFile: z.string().optional().describe("Ruta explícita al plan file activo")
    },
    async ({ mode, target, planFile }) => {
      try {
        const cmdDoc = readDoc(COMMANDS_DIR, "pipeline.md") || ""
        let guide = ""
        const defaultBacklog = config?.paths?.backlog || "docs/roadmap/Backlog.md"

        if (mode === "plan") {
          const planPrompt = readDoc(PROMPTS_DIR, "plan.md") || ""
          guide = `### MODO PLAN ACTIVADO\nObjetivo: Crear o refinar plan desde backlog: ${target || defaultBacklog}\n\n${planPrompt}`
        } else if (mode === "task") {
          const taskPrompt = readDoc(PROMPTS_DIR, "task.md") || readDoc(PROMPTS_DIR, "pipeline-full.md") || ""
          guide = `### MODO TAREA ACTIVADO\nObjetivo: Ejecutar tarea ID: ${target}\nPlanFile: ${planFile || "auto-detect"}\n\n${taskPrompt}`
        } else if (mode === "run") {
          const runPrompt = readDoc(PROMPTS_DIR, "pipeline-run.md") || ""
          guide = `### MODO RUN ACTIVADO\nObjetivo: Ejecutar backlog completo de forma continua.\nPlanFile: ${planFile || "auto-detect"}\n\n${runPrompt}`
        } else {
          guide = `### MODO INTERACTIVO\nEvalúe el estado del proyecto con workflow_status y determine el próximo paso.`
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              mode,
              target: target || "default",
              planFile: planFile || "auto",
              instructions: guide
            }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error in workflow_pipeline: ${err.message}` }] }
      }
    }
  )

  // 2. workflow_audit
  server.tool(
    "workflow_audit",
    {
      mode: z.enum(["quick", "certify", "review", "full"]).optional().default("full").describe("Nivel de auditoría"),
      profile: z.string().optional().default("Ego").describe("Perfil de revisión (default: Ego)")
    },
    async ({ mode, profile }) => {
      try {
        const auditDoc = readDoc(COMMANDS_DIR, "audit.md") || ""
        const reviewsDir = config?.paths?.reviews || "docs/agent-ops/reviews"
        const stateDir = config?.paths?.state || "docs/agent-ops/state"
        const backlogFile = config?.paths?.backlog || "docs/roadmap/Backlog.md"
        const instructions = `### AUDIT EN MODO: ${mode.toUpperCase()} (Perfil: ${profile})\n\nReglas:\n- quick: fmt / lint / test rápidos.\n- certify: Pre-push / merge gate secuencial con hard stop al primer error.\n- review: Deep review de código sin CLI pesado.\n- full: Auditoría completa de 9 capas con scoring ISO.\n\nContrato de salida:\n1. Reporte: ${reviewsDir}/audit-${mode}-<YYYYMMDD>-<HHMMSS>.md\n2. Estado: ${stateDir}/last-audit-state.json\n3. Backlog: Hallazgos críticos/importantes registrados como FIND-* en ${backlogFile}.`

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              mode,
              profile,
              instructions,
              commandRef: auditDoc.slice(0, 500) + "..."
            }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error in workflow_audit: ${err.message}` }] }
      }
    }
  )

  // 3. workflow_ship
  server.tool(
    "workflow_ship",
    {
      dryRun: z.boolean().optional().default(false).describe("Si es true, solo evalúa el checklist sin ejecutar acciones de release")
    },
    async ({ dryRun }) => {
      try {
        const shipDoc = readDoc(COMMANDS_DIR, "ship.md") || ""
        const reportsDir = config?.paths?.reports || "docs/agent-ops/reports"
        const stateDir = config?.paths?.state || "docs/agent-ops/state"
        const instructions = `### SHIP WORKFLOW (DryRun: ${dryRun})\nFase A (Fan-out): Verificación paralela de ego-audit + ego-chaos + ego-tuner.\nFase B (Merge): Contexto principal sintetiza hallazgos.\nFase C (Decisión): GO | NO-GO + blockers + plan de rollback obligatorio.\nOutput: ${reportsDir}/ship-<timestamp>.md y ${stateDir}/last-ship-state.json.`

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ dryRun, instructions, reference: shipDoc }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error in workflow_ship: ${err.message}` }] }
      }
    }
  )

  // 4. workflow_rollback
  server.tool(
    "workflow_rollback",
    {
      checkpointId: z.string().optional().describe("ID de checkpoint, commit SHA o ID de tarea a revertir")
    },
    async ({ checkpointId }) => {
      try {
        const rollbackDoc = readDoc(COMMANDS_DIR, "rollback.md") || ""
        const stateDir = config?.paths?.state || "docs/agent-ops/state"
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              checkpointId: checkpointId || "HEAD~1",
              instructions: `Ejecutar plan de rollback validando ${stateDir}/last-ship-state.json o ${stateDir}/pipeline-state.json.`,
              reference: rollbackDoc
            }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error in workflow_rollback: ${err.message}` }] }
      }
    }
  )

  // 5. workflow_spec
  server.tool(
    "workflow_spec",
    {
      featureName: z.string().describe("Nombre de la funcionalidad o módulo a especificar"),
      interactive: z.boolean().optional().default(true).describe("Indica si requiere cuestionario HITL previo")
    },
    async ({ featureName, interactive }) => {
      try {
        const specPrompt = readDoc(PROMPTS_DIR, "spec-template.md") || readDoc(COMMANDS_DIR, "spec.md") || ""
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              featureName,
              interactive,
              instructions: `Generar SPEC.md para '${featureName}' siguiendo tabla de decisiones y question gates (P/D/V/C).`,
              template: specPrompt
            }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error in workflow_spec: ${err.message}` }] }
      }
    }
  )

  // 6. workflow_research
  server.tool(
    "workflow_research",
    {
      topic: z.string().describe("Tema, tecnología, API o arquitectura a investigar"),
      depth: z.enum(["quick", "deep", "spike"]).optional().default("quick").describe("Profundidad de la investigación")
    },
    async ({ topic, depth }) => {
      try {
        const researchPrompt = readDoc(PROMPTS_DIR, "research-agent.md") || readDoc(COMMANDS_DIR, "research.md") || ""
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              topic,
              depth,
              instructions: `Investigar '${topic}'. Restricción estricta: Entregar digest ejecutable ≤500 palabras con RESULTADO block para que el lead decida sin saturar su contexto.`,
              contract: researchPrompt.slice(0, 600) + "..."
            }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error in workflow_research: ${err.message}` }] }
      }
    }
  )

  // 7. workflow_status
  server.tool(
    "workflow_status",
    {
      detailed: z.boolean().optional().default(false).describe("Si es true, incluye detalles de últimos reports y logs")
    },
    async ({ detailed }) => {
      try {
        const statusDoc = readDoc(COMMANDS_DIR, "status.md") || ""
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              detailed,
              checklist: [
                "1. Git status: verificar cambios pendientes y rama actual",
                `2. Plan activo: revisar ${config?.paths?.plans || "docs/agent-ops/plans/"} y tareas inProgress`,
                `3. Último audit: ${config?.paths?.state || "docs/agent-ops/state"}/last-audit-state.json`,
                `4. Último ship: ${config?.paths?.state || "docs/agent-ops/state"}/last-ship-state.json`,
                "5. Spec status: verificar si existe SPEC.md"
              ],
              guide: statusDoc
            }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error in workflow_status: ${err.message}` }] }
      }
    }
  )

  // 8. ponytail_instructions
  server.tool(
    "ponytail_instructions",
    {
      mode: z.enum(["lite", "full", "ultra"]).optional().default("full").describe("Nivel de intensidad de Ponytail (lazy senior dev mode)")
    },
    async ({ mode }) => {
      const ladder = [
        "1. ¿Necesita construirse en absoluto? (YAGNI)",
        "2. ¿Ya existe en este codebase? Reutilizar lo existente, no reescribir.",
        "3. ¿La librería estándar lo resuelve? Usar stdlib.",
        "4. ¿Una característica nativa de la plataforma lo cubre? Usar la plataforma.",
        "5. ¿Una dependencia ya instalada lo resuelve? Usarla.",
        "6. ¿Puede ser una sola línea? Que sea una sola línea.",
        "7. Solo entonces: escribir el código mínimo que funcione."
      ]
      const rules = [
        "Cero abstracciones no solicitadas. Cero dependencias evitables. Cero boilerplate innecesario.",
        "Eliminación antes que adición. Código aburrido antes que código 'astuto'. Menor cantidad de archivos posible.",
        "Bug fix = causa raíz comprobable, no parche cosmético del síntoma.",
        "Cuándo NO ser perezoso: validación de inputs en fronteras, manejo de errores contra pérdida de datos, seguridad y accesibilidad."
      ]
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            mode,
            active: true,
            status: `PONYTAIL MODE ACTIVE — level: ${mode}`,
            ladder,
            rules,
            philosophy: "You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written."
          }, null, 2)
        }]
      }
    }
  )

  // 9. workflow_backlog
  server.tool(
    "workflow_backlog",
    {
      backlogPath: z.string().optional().describe("Ruta opcional al archivo de backlog"),
      filter: z.enum(["active", "all", "top3"]).optional().default("active").describe("Filtro de tareas")
    },
    async ({ backlogPath, filter }) => {
      try {
        const bp = backlogPath || config?.paths?.backlog || "docs/roadmap/Backlog.md"
        const fullPath = resolve(PROJECT_ROOT, bp)
        const guide = readDoc(COMMANDS_DIR, "backlog.md") || ""
        if (!existsSync(fullPath)) {
          return { isError: true, content: [{ type: "text", text: `Backlog file not found: ${bp}` }] }
        }
        const content = readFileSync(fullPath, "utf-8")
        const tasks = parseTasksFromBacklog(content)
        let filteredTasks = []

        if (filter === "all") {
          filteredTasks = tasks
        } else if (filter === "active") {
          filteredTasks = tasks.filter(t => t.state.includes("PENDING") || t.state.includes("IN PROGRESS"))
        } else if (filter === "top3") {
          const prioScore = (p) => {
            if (p.includes("P0")) return 4
            if (p.includes("P1")) return 3
            if (p.includes("P2")) return 2
            return 1
          }
          filteredTasks = tasks
            .filter(t => t.state.includes("PENDING") || t.state.includes("IN PROGRESS"))
            .sort((a, b) => prioScore(b.priority) - prioScore(a.priority))
            .slice(0, 3)
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              backlogPath: bp,
              filter,
              totalBytes: content.length,
              totalTasksCount: tasks.length,
              filteredCount: filteredTasks.length,
              tasks: filteredTasks.map(t => ({
                id: t.id,
                name: t.name,
                priority: t.priority,
                effort: t.effort,
                state: t.state,
                files: t.files
              })),
              instructions: guide
            }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error in workflow_backlog: ${err.message}` }] }
      }
    }
  )

  // 10. workflow_cleanca
  server.tool(
    "workflow_cleanca",
    {
      scope: z.string().optional().describe("Ruta específica a auditar (archivo o carpeta). Omitir para barrido completo.")
    },
    async ({ scope }) => {
      try {
        const guide = readDoc(COMMANDS_DIR, "cleanCA.md") || ""
        const norm = readDoc(join(AGENTS_ROOT, "references"), "clean-code-clean-architecture.md") || ""
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              scope: scope || "workspace-full",
              checklist: guide,
              normSnippet: norm.slice(0, 1000) + "..."
            }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error in workflow_cleanca: ${err.message}` }] }
      }
    }
  )

  // 11. workflow_codegraph
  server.tool(
    "workflow_codegraph",
    {
      scope: z.string().optional().describe("Scope de análisis (--path <dir> o vacio para workspace completo)")
    },
    async ({ scope }) => {
      try {
        const guide = readDoc(COMMANDS_DIR, "codeGraph.md") || ""
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              scope: scope || "workspace-full",
              phases: `Fase 0 (Sanity) -> Fases 1-12 (CBM + CodeGraph) -> Fase Final (Reporte en ${config?.paths?.reviews || "docs/agent-ops/reviews"})`,
              instructions: guide
            }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error in workflow_codegraph: ${err.message}` }] }
      }
    }
  )

  // 12. workflow_harness
  server.tool(
    "workflow_harness",
    {
      scope: z.enum(["diff", "full"]).optional().default("diff").describe("Alcance de la auditoría del harness (.agents)")
    },
    async ({ scope }) => {
      try {
        const guide = readDoc(COMMANDS_DIR, "harness.md") || ""
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              scope,
              inScope: ".agents/ (commands, agents, skills, prompts, rules, references, configs)",
              instructions: guide
            }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error in workflow_harness: ${err.message}` }] }
      }
    }
  )

  // 13. workflow_simplify
  server.tool(
    "workflow_simplify",
    {
      target: z.string().optional().describe("Ruta de archivo o módulo a simplificar. Omitir para cambios recientes.")
    },
    async ({ target }) => {
      try {
        const guide = readDoc(COMMANDS_DIR, "code-simplify.md") || ""
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              target: target || "recent-git-diff",
              objective: "Reducir complejidad preservando el comportamiento exacto y sin introducir regresiones.",
              instructions: guide
            }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error in workflow_simplify: ${err.message}` }] }
      }
    }
  )

  // 14. workflow_webperf
  server.tool(
    "workflow_webperf",
    {
      mode: z.enum(["quick", "deep"]).optional().default("quick").describe("Modo de auditoría web performance"),
      targetUrl: z.string().optional().describe("URL local o remota a inspeccionar"),
      reportPath: z.string().optional().describe("Ruta opcional a informe Lighthouse JSON o trace")
    },
    async ({ mode, targetUrl, reportPath }) => {
      try {
        const guide = readDoc(COMMANDS_DIR, "webperf.md") || ""
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              mode,
              targetUrl: targetUrl || "local dev server",
              reportPath: reportPath || "none",
              instructions: guide
            }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error in workflow_webperf: ${err.message}` }] }
      }
    }
  )

  // 15. devtools_verify_refs
  server.tool(
    "devtools_verify_refs",
    {},
    async () => {
      try {
        const agentsMdPath = join(PROJECT_ROOT, "AGENTS.md")
        if (!existsSync(agentsMdPath)) {
          return { isError: true, content: [{ type: "text", text: "AGENTS.md no encontrado en la raíz del proyecto." }] }
        }
        const rawContent = readFileSync(agentsMdPath, "utf-8")
        const content = rawContent.replace(/```[\s\S]*?```/g, "")
        const matches = [...content.matchAll(/`([^`\r\n]+)`/g)].map(m => m[1].trim())
        const checked = []
        const missing = []

        for (let tok of matches) {
          tok = tok.replace(/:\d+.*$/, "").replace(/[/\\]+$/, "")
          if (/\s/.test(tok) || /^[a-z]+:\/\//i.test(tok) || tok.startsWith("~") || tok.startsWith("/") || /[<>*?#]/.test(tok) || !tok.includes(".") || !/[/\\]/.test(tok)) {
            continue
          }
          if (/^[A-Z]\.[A-Za-z0-9]+$/.test(basename(tok))) continue
          if (tok.startsWith("prompts/")) tok = ".agents/task-system/" + tok

          const target = resolve(PROJECT_ROOT, tok)
          checked.push(tok)
          if (!existsSync(target)) {
            missing.push(tok)
          }
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              valid: missing.length === 0,
              totalChecked: checked.length,
              staleCount: missing.length,
              missing: [...new Set(missing)]
            }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error in devtools_verify_refs: ${err.message}` }] }
      }
    }
  )
}


