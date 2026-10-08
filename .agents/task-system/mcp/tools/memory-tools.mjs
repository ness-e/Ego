// memory-tools.mjs — Herramientas de memoria, decisiones, lecciones e historial (.agents/memory, history)
import { readFileSync, writeFileSync, existsSync, appendFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"

export function registerMemoryTools(server, { AGENTS_ROOT, PROJECT_ROOT }) {
  const MEMORY_DIR = join(AGENTS_ROOT, "task-system", "memory")
  const HISTORY_DIR = join(AGENTS_ROOT, "history", "sessions")
  const DECISIONS_FILE = join(MEMORY_DIR, "decisions.md")
  const LESSONS_FILE = join(MEMORY_DIR, "lessons.md")
  const OUTCOMES_FILE = join(MEMORY_DIR, "skill-outcomes.json")

  // 1. memory_read_decisions
  server.tool(
    "memory_read_decisions",
    {
      query: z.string().optional().describe("Filtro opcional de búsqueda en texto")
    },
    async ({ query }) => {
      try {
        if (!existsSync(DECISIONS_FILE)) {
          return { content: [{ type: "text", text: "No decisions.md file found." }] }
        }
        const content = readFileSync(DECISIONS_FILE, "utf-8")
        if (!query) {
          return { content: [{ type: "text", text: content }] }
        }
        const lines = content.split("\n")
        const filtered = lines.filter(l => l.toLowerCase().includes(query.toLowerCase())).join("\n")
        return { content: [{ type: "text", text: filtered || "No matches found for query." }] }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error reading decisions: ${err.message}` }] }
      }
    }
  )

  // 2. memory_record_decision
  server.tool(
    "memory_record_decision",
    {
      title: z.string().describe("Título de la decisión (ADR)"),
      context: z.string().describe("Contexto o problema que motivó la decisión"),
      decision: z.string().describe("Decisión tomada y justificación técnica"),
      consequences: z.string().describe("Consecuencias, trade-offs y próximos pasos")
    },
    async ({ title, context, decision, consequences }) => {
      try {
        const timestamp = new Date().toISOString().split("T")[0]
        const block = `\n\n### ADR-${Date.now().toString().slice(-4)}: ${title} (${timestamp})\n- **Contexto:** ${context}\n- **Decisión:** ${decision}\n- **Consecuencias:** ${consequences}\n`
        appendFileSync(DECISIONS_FILE, block, "utf-8")
        return { content: [{ type: "text", text: `✅ Decisión registrada exitosamente en decisions.md.` }] }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error recording decision: ${err.message}` }] }
      }
    }
  )

  // 3. memory_read_lessons
  server.tool(
    "memory_read_lessons",
    {
      query: z.string().optional().describe("Filtro opcional de búsqueda en texto")
    },
    async ({ query }) => {
      try {
        if (!existsSync(LESSONS_FILE)) {
          return { content: [{ type: "text", text: "No lessons.md file found." }] }
        }
        const content = readFileSync(LESSONS_FILE, "utf-8")
        if (!query) {
          return { content: [{ type: "text", text: content }] }
        }
        const lines = content.split("\n")
        const filtered = lines.filter(l => l.toLowerCase().includes(query.toLowerCase())).join("\n")
        return { content: [{ type: "text", text: filtered || "No matches found for query." }] }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error reading lessons: ${err.message}` }] }
      }
    }
  )

  // 4. memory_record_lesson
  server.tool(
    "memory_record_lesson",
    {
      incident: z.string().describe("Qué falló o qué incidente se presentó"),
      rootCause: z.string().describe("Causa raíz del problema"),
      mitigation: z.string().describe("Mitigación o regla preventiva para el futuro")
    },
    async ({ incident, rootCause, mitigation }) => {
      try {
        const timestamp = new Date().toISOString().split("T")[0]
        const block = `\n\n### Lección ${timestamp}: ${incident.slice(0, 50)}\n- **Incidente:** ${incident}\n- **Causa Raíz:** ${rootCause}\n- **Mitigación Preventiva:** ${mitigation}\n`
        appendFileSync(LESSONS_FILE, block, "utf-8")
        return { content: [{ type: "text", text: `✅ Lección aprendida registrada exitosamente en lessons.md.` }] }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error recording lesson: ${err.message}` }] }
      }
    }
  )

  // 5. memory_record_outcome
  server.tool(
    "memory_record_outcome",
    {
      skillName: z.string().describe("Nombre de la skill evaluada"),
      success: z.boolean().describe("Indica si la skill resolvió la tarea satisfactoriamente"),
      taskId: z.string().optional().describe("ID de la tarea"),
      feedback: z.string().optional().describe("Observaciones o notas sobre el desempeño de la skill")
    },
    async ({ skillName, success, taskId, feedback }) => {
      try {
        let data = { outcomes: [] }
        if (existsSync(OUTCOMES_FILE)) {
          try {
            data = JSON.parse(readFileSync(OUTCOMES_FILE, "utf-8"))
          } catch {
            data = { outcomes: [] }
          }
        }
        data.outcomes.push({
          timestamp: new Date().toISOString(),
          skill: skillName,
          success,
          taskId: taskId || "N/A",
          feedback: feedback || ""
        })
        writeFileSync(OUTCOMES_FILE, JSON.stringify(data, null, 2), "utf-8")
        return { content: [{ type: "text", text: `✅ Resultado de la skill '${skillName}' registrado.` }] }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error recording outcome: ${err.message}` }] }
      }
    }
  )

  // 6. memory_session_history
  server.tool(
    "memory_session_history",
    {
      limit: z.number().optional().default(10).describe("Límite de sesiones a listar (más recientes primero)")
    },
    async ({ limit }) => {
      try {
        if (!existsSync(HISTORY_DIR)) {
          return { content: [{ type: "text", text: "No sessions history found in .agents/history/sessions" }] }
        }
        const files = readdirSync(HISTORY_DIR)
          .filter(f => f.endsWith(".json"))
          .map(f => {
            const p = join(HISTORY_DIR, f)
            return { file: f, time: statSync(p).mtimeMs, sizeBytes: statSync(p).size }
          })
          .sort((a, b) => b.time - a.time)
          .slice(0, limit)
          .map(f => ({
            session: f.file.replace(/\.json$/, ""),
            updated: new Date(f.time).toISOString(),
            size: f.sizeBytes
          }))

        return { content: [{ type: "text", text: JSON.stringify({ count: files.length, sessions: files }, null, 2) }] }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error listing session history: ${err.message}` }] }
      }
    }
  )
}
