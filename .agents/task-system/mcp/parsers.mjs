// parsers.mjs — Parsers y extractores de tareas y planes (.agents/task-system)
import { randomUUID } from "node:crypto"
import { validateBacklogFormat, validatePlanFormat, validateTaskFileFormat } from "./format-validator.mjs"

export { validateBacklogFormat, validatePlanFormat, validateTaskFileFormat }

export function extractField(block, field) {
  const m = block.match(new RegExp(`- \\*\\*${field}:\\*\\*\\s*(.+)`))
  return m ? m[1].trim() : ""
}

export function extractState(block) {
  const m = block.match(/- \*\*Estado:\*\*\s*(.+)/i)
  const raw = m
    ? m[1].trim()
    // Fallback: formato compacto con estado inline (`… · ⬜ PENDING`)
    : (block.match(/·\s*(⬜ PENDING|⏳ EN PROGRESO|⏳ IN PROGRESS|✅ COMPLETED|❌ FAILED)\s*(?:\n|$)/) || [null, ""])[1]
  if (raw.includes("✅")) return "✅ COMPLETED"
  if (raw.includes("❌")) return "❌ FAILED"
  if (raw.includes("⏳")) return "⏳ IN PROGRESS"
  return "⬜ PENDING"
}

/**
 * Parsea el backlog canónico de 10 columnas de Ego (docs/roadmap/Backlog.md)
 */
export function parseTasksFromBacklog(content) {
  const lines = content.split("\n")
  const tasks = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith("|") || !line.endsWith("|")) continue
    if (/^\|(?:\s*:?-+:?\s*\|)+$/.test(line)) continue // separador

    const cells = line.split("|").slice(1, -1).map(c => c.trim())
    if (cells.length < 8) continue
    if (cells[0].toLowerCase() === "id" || cells[0].startsWith("**") || cells[0] === "—") continue

    const id = cells[0].replace(/^[`*]+|[`*]+$/g, "").trim()
    if (!id || !/^[A-Z]{2,6}-\d{1,4}$/i.test(id)) continue

    const severity = cells[1] || ""
    const title = cells[2] ? cells[2].replace(/^\*\*|\*\*$/g, "").trim() : ""
    const pathRef = cells[3] ? cells[3].replace(/^`|`$/g, "").trim() : ""
    const effort = cells[4] || ""
    const priority = cells[5] || ""
    const estadoRaw = cells[6] || ""
    const description = cells[7] || ""
    const notes = cells[8] || ""
    const dependencies = cells[9] || ""

    let state = "⬜ PENDING"
    if (estadoRaw.includes("✅") || estadoRaw.toLowerCase().includes("completad")) {
      state = "✅ COMPLETED"
    } else if (estadoRaw.includes("⏳") || estadoRaw.toLowerCase().includes("curso")) {
      state = "⏳ IN PROGRESS"
    } else if (estadoRaw.includes("🚫") || estadoRaw.toLowerCase().includes("descartad")) {
      state = "🚫 DISCARDED"
    } else if (estadoRaw.includes("❌") || estadoRaw.toLowerCase().includes("fallid")) {
      state = "❌ FAILED"
    } else if (estadoRaw.includes("⏸️") || estadoRaw.toLowerCase().includes("bloquead")) {
      state = "⏸️ BLOCKED"
    }

    tasks.push({
      id,
      name: title,
      severity,
      files: pathRef,
      effort,
      priority,
      state,
      description,
      contract: `Ver: ${pathRef || "Backlog.md"}`,
      notes,
      dependencies,
      source: "Backlog.md",
      lineIndex: i,
      rawRow: line
    })
  }

  return tasks
}

/**
 * Parsea planes tanto en formato de bloques Markdown como en formato de tabla
 */
export function parseTasks(content) {
  const tasks = []

  // 1. Detección de bloques '### Task ...'
  // Un header canónico válido de tarea debe tener '### Task <num>:' o '### Task: <code/title>'
  // No acepta '### Task\n' (nota) ni '### Task 5\n' (sin ':') ni '### Task 2 Second task' (sin ':')
  const taskHeaderPattern = /^###\s+Task(?:\s+(\d+))?:\s*(.+)$/gim

  const matches = []
  let match
  while ((match = taskHeaderPattern.exec(content)) !== null) {
    matches.push({
      index: match.index,
      numId: match[1] || null,
      fullTitle: match[2].trim()
    })
  }

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i]
    const startIndex = cur.index
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : content.length
    let block = content.slice(startIndex, nextIndex)

    const boundaryMatch = block.match(/\n(?=##\s+|---\s*|===\s*)/)
    if (boundaryMatch) {
      block = block.slice(0, boundaryMatch.index)
    }

    // Extraer ID y Name:
    const codeMatch = cur.fullTitle.match(/^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\b/i)
    let taskId = ""
    let taskName = cur.fullTitle

    if (codeMatch) {
      taskId = codeMatch[1]
    } else {
      taskId = cur.numId || `Task-${tasks.length + 1}`
    }

    tasks.push({
      id: taskId,
      name: taskName,
      priority: extractField(block, "Prioridad"),
      effort: extractField(block, "Esfuerzo"),
      files: extractField(block, "Archivos clave") || extractField(block, "Scope"),
      contract: extractField(block, "Contrato") || extractField(block, "Contract"),
      state: extractState(block),
      source: extractField(block, "Fuente"),
      notes: extractField(block, "Notas"),
      block,
    })
  }

  // 2. Si no hubo bloques, buscar tabla de tareas en el plan
  if (tasks.length === 0 && /\|(?:\s*:?-+:?\s*\|)+/.test(content)) {
    const lines = content.split("\n")
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line.startsWith("|") || !line.endsWith("|")) continue
      if (/^\|(?:\s*:?-+:?\s*\|)+$/.test(line)) continue

      const cells = line.split("|").slice(1, -1).map(c => c.trim())
      if (cells.length < 3) continue
      if (cells[0].toLowerCase() === "id" || cells[0].startsWith("**")) continue

      const id = cells[0].replace(/^`|`$/g, "").trim()
      if (!id || !/^[A-Z0-9_-]+$/i.test(id)) continue

      tasks.push({
        id,
        name: cells[1] ? cells[1].replace(/^\*\*|\*\*$/g, "") : id,
        files: cells.length > 3 ? cells[3] : "",
        priority: cells.length > 4 ? cells[4] : "",
        state: extractState(line),
        contract: cells.length > 5 ? cells[5] : "",
        block: line
      })
    }
  }

  return tasks
}

function recitationBlocks(content) {
  const out = []
  const re = /=== RECITATION(?:\s+([^\s=]+))?\s*===\n([\s\S]*?)=== END RECITATION ===/g
  for (const m of content.matchAll(re)) out.push({ id: m[1] || null, body: m[2], index: m.index, length: m[0].length })
  return out
}

export function parseRecitation(content, taskId = null) {
  const blocks = recitationBlocks(content)
  if (blocks.length === 0) return null
  let block = null
  if (taskId) {
    block = blocks.find(b => b.id === String(taskId)) || blocks[blocks.length - 1]
  } else {
    block = blocks[blocks.length - 1]
  }
  const b = block.body
  const extract = (field) => {
    const r = b.match(new RegExp(`${field}:\\s*(.+?)(?:\\n|$)`))
    return r ? r[1].trim() : ""
  }
  return {
    taskId: block.id,
    activeGoal: extract("Objetivo activo"),
    status: extract("Estado"),
    lastAction: extract("Última acción"),
    result: extract("Resultado"),
    nextAction: extract("Próxima acción"),
    contract: extract("Contrato"),
    nextTask: extract("Próxima tarea si completa"),
  }
}

export const STATE_MAP = {
  completed: "✅ COMPLETED",
  failed: "❌ FAILED",
  discarded: "🚫 DISCARDED",
  "in-progress": "⏳ EN PROGRESO",
  pending: "⬜ PENDING",
}

export function findTaskById(content, taskId) {
  const esc = taskId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  // Buscar en bloque por número o por código
  const isNumeric = /^\d+$/.test(taskId)
  const headerRegex = isNumeric
    ? new RegExp(`###\\s+Task\\s+${esc}:`, "i")
    : new RegExp(`###\\s+Task(?:\\s+\\d+)?:\\s*${esc}(?=[\\s:—]|$)`, "i")

  const m = content.match(headerRegex)
  if (m) {
    const startIndex = m.index
    const rest = content.slice(startIndex)
    const nextHeader = rest.slice(1).match(/\n(?=###\s+Task|\n##\s+|---|===)/i)
    const length = nextHeader ? nextHeader.index + 1 : rest.length
    return { index: startIndex, length, header: content.slice(startIndex, startIndex + length), isTable: false }
  }

  // Buscar en fila de tabla
  const tablePattern = new RegExp(`^\\|\\s*\`?${esc}\`?\\s*\\|.*$`, "m")
  const tm = content.match(tablePattern)
  if (tm) {
    return { index: tm.index, length: tm[0].length, header: tm[0], isTable: true }
  }

  return null
}

export function updateState(content, taskId, newState) {
  const mapped = STATE_MAP[newState.toLowerCase()]
  if (!mapped) return content // Estado desconocido: no-op estricto

  const taskInfo = findTaskById(content, taskId)
  if (!taskInfo) return content

  if (taskInfo.isTable) {
    let row = taskInfo.header
    row = row.replace(/⬜\s*PENDING|⏳\s*(?:EN PROGRESO|IN PROGRESS)|✅\s*COMPLETED|❌\s*FAILED|🚫\s*DISCARDED/i, mapped)
    return content.slice(0, taskInfo.index) + row + content.slice(taskInfo.index + taskInfo.length)
  }

  const taskBlock = content.slice(taskInfo.index, taskInfo.index + taskInfo.length)
  let updated = taskBlock.replace(/(- \*\*Estado:\*\*\s*)(?:⬜ PENDING|⏳ EN PROGRESO|⏳ IN PROGRESS|✅ COMPLETED|❌ FAILED|🚫 DISCARDED)/i, `$1${mapped}`)
  if (updated === taskBlock) updated = taskBlock.replace(/(- \*\*Estado:\*\*\s*).+/i, `$1${mapped}`)
  if (updated === taskBlock) {
    updated = taskBlock.replace(/(·\s*)(⬜ PENDING|⏳ EN PROGRESO|⏳ IN PROGRESS|✅ COMPLETED|❌ FAILED|🚫 DISCARDED)(\s*)$/im, `$1${mapped}$3`)
  }
  if (updated === taskBlock) return content
  return content.slice(0, taskInfo.index) + updated + content.slice(taskInfo.index + taskInfo.length)
}

export function updateRecitation(content, data) {
  const tag = data.taskId ? ` ${data.taskId}` : ""
  const open = `=== RECITATION${tag} ===`
  if (!content.includes(open)) {
    const rec = [open, `Campaign ID: ${data.campaignId || ""}`, `Objetivo activo: ${data.activeGoal || ""}`, `Estado: ${data.status || "in-progress"}`, `Última acción: ${data.lastAction || ""}`, `Resultado: ${data.result || ""}`, `Próxima acción: ${data.nextAction || ""}`, `Contrato: ${data.contract || ""}`, `Próxima tarea si completa: ${data.nextTask || ""}`, "=== END RECITATION ==="].join("\n")
    return content.trimEnd() + "\n\n" + rec + "\n"
  }
  const openRe = open.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const re = new RegExp(`${openRe}\\n[\\s\\S]*?=== END RECITATION ===`)
  const body = [`Campaign ID: ${data.campaignId || ""}`, `Objetivo activo: ${data.activeGoal || ""}`, `Estado: ${data.status || "in-progress"}`, `Última acción: ${data.lastAction || ""}`, `Resultado: ${data.result || ""}`, `Próxima acción: ${data.nextAction || ""}`, `Contrato: ${data.contract || ""}`, `Próxima tarea si completa: ${data.nextTask || ""}`, "=== END RECITATION ==="].join("\n")
  return content.replace(re, `${open}\n${body}`)
}

function isPlaceholderId(id) {
  return /^(\([^)]*\)|TODO|TBD|<[^>]+>)$/.test(id)
}

export function extractCampaignId(content) {
  for (const m of content.matchAll(/> \*\*Campaign ID:\*\*\s*(.+)/g)) {
    const id = m[1].trim()
    if (id && !isPlaceholderId(id)) return id
  }
  return null
}

export function getOrCreateCampaignId(content) {
  const existing = extractCampaignId(content)
  if (existing) {
    let kept = false
    const cleaned = content.split("\n").filter(l => {
      if (!/^> \*\*Campaign ID:\*\*/.test(l)) return true
      if (kept || !l.includes(existing)) return false
      kept = true
      return true
    })
    return { campaignId: existing, content: cleaned.join("\n") }
  }
  const id = randomUUID()
  const line = `> **Campaign ID:** ${id}`
  if (/> \*\*Campaign ID:\*\*/.test(content)) {
    return { campaignId: id, content: content.replace(/^> \*\*Campaign ID:\*\*.*/m, line) }
  }
  const updated = content.replace(/(^>\s\*\*Inicio:\*\*)/m, `${line}\n$1`)
  return { campaignId: id, content: updated }
}

export function extractAutonomous(content) {
  const m = content.match(/^>\s*\*\*Autonomous:\*\*\s*(true|false)\s*$/im)
  return m ? m[1].toLowerCase() === "true" : null
}