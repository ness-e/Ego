// format-validator.mjs — Validador Estricto de Formato y Diagnósticos Accionables (.agents)
// Asegura que Backlog, Planes y Task Files cumplan el esquema canónico y ofrece guías de autoreparación.

export function validateBacklogFormat(content, filename = "Backlog.md") {
  const lines = content.split("\n")
  const errors = []
  const warnings = []
  let tableFound = false
  let validTaskRowsCount = 0
  let validGateRowsCount = 0

  // Esquemas válidos en el Backlog:
  // 1. Tareas Canónicas (10 cols): | ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |
  // 2. Matrices de Compuertas (7 cols): | ID Compuerta | Repo Origen | Patrón / Feature | Ficha Canónica | Tareas Habilitadas | Decisión | Estado |
  const CANONICAL_TASK_COLS = 10
  const GATE_MATRIX_COLS = 7

  let currentTableType = "unknown" // "canonical-tasks" | "gate-matrix" | "exec-summary" | "unknown"

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith("|")) {
      if (line.startsWith("#")) currentTableType = "unknown"
      continue
    }

    // Detectar fila separadora (|---|---|...)
    if (/^\|(?:\s*:?-+:?\s*\|)+$/.test(line)) {
      tableFound = true
      continue
    }

    // Procesar fila de datos
    const rawCells = line.split("|").slice(1, -1)
    if (rawCells.length === 0) continue

    const cells = rawCells.map(c => c.trim())
    const firstCellLower = cells[0].toLowerCase()

    // Detectar tipo de tabla según cabecera
    if (firstCellLower.includes("id compuerta") || (cells.length === 7 && line.toLowerCase().includes("compuerta"))) {
      tableFound = true
      currentTableType = "gate-matrix"
      continue
    }

    if (firstCellLower === "id") {
      tableFound = true
      if (cells.length === CANONICAL_TASK_COLS || (cells[1] && /severidad|criticidad/i.test(cells[1]))) {
        currentTableType = "canonical-tasks"
      } else if (cells.length === GATE_MATRIX_COLS) {
        currentTableType = "gate-matrix"
      }
      continue
    }

    if (firstCellLower === "fase") {
      tableFound = true
      currentTableType = "exec-summary"
      continue
    }

    // Fila de datos con ID
    const id = cells[0].replace(/^[`*]+|[`*]+$/g, "").trim()
    if (!id || !/^[A-Z]{2,6}-\d{1,4}$/i.test(id)) continue

    // Determinar si es compuerta o tarea canónica
    const isGateId = /^(?:COUC|HERM|OCLW|CARP|HELM|KHOJ|DSEK)-\d+$/i.test(id)
    const isGateTable = currentTableType === "gate-matrix" || (isGateId && cells.length === GATE_MATRIX_COLS)

    if (isGateTable) {
      if (cells.length !== GATE_MATRIX_COLS) {
        errors.push(`Línea ${i + 1} (Compuerta ${id}): Fila contiene ${cells.length} columnas en vez de ${GATE_MATRIX_COLS} esperadas en la Matriz de Compuertas.`)
        continue
      }
      validGateRowsCount++
    } else {
      // Tarea canónica de 10 columnas
      if (cells.length !== CANONICAL_TASK_COLS) {
        errors.push(`Línea ${i + 1} (Tarea ${id}): Fila contiene ${cells.length} columnas en vez de ${CANONICAL_TASK_COLS} esperadas en el Catálogo Canónico. Formato de celdas desalineado.`)
        continue
      }

      const estado = cells[6] // Columna Estado
      const validStates = ["✅ Completada", "🆕 Pendiente", "⏳ En curso", "⏸️ Bloqueada", "🧊 Icebox", "🔮 Futuro", "🚫 Descartada", "❌ Fallida", "❌ Descartada"]
      const hasValidState = validStates.some(st => estado.includes(st) || estado.includes(st.split(" ")[1])) || estado.startsWith("🚫 Descartada")

      if (!hasValidState) {
        warnings.push(`Línea ${i + 1} (Tarea ${id}): Estado '${estado}' no coincide con los estados canónicos: [${validStates.join(", ")}].`)
      }

      validTaskRowsCount++
    }
  }

  const isValid = tableFound && errors.length === 0

  let fixGuide = ""
  if (!isValid) {
    fixGuide = `
=== GUÍA PARA CORREGIR FORMATO EN ${filename} ===
1. Asegúrese de que cada sección de tareas contenga una tabla markdown válida de 10 columnas:
   | ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |
   |---|---|---|---|---|---|---|---|---|---|
2. Cada fila debe comenzar y terminar con '|' y contener exactamente 10 celdas.
3. Estados soportados: 🆕 Pendiente | ⏳ En curso | ✅ Completada | 🚫 Descartada: <Fundamento> | ⏸️ Bloqueada | 🧊 Icebox | 🔮 Futuro
`.trim()
  }

  return {
    isValid,
    filename,
    tableFound,
    validRowsCount: validTaskRowsCount + validGateRowsCount,
    validTaskRowsCount,
    validGateRowsCount,
    errors,
    warnings,
    fixGuide
  }
}

export function validatePlanFormat(content, filename = "plan.md") {
  const errors = []
  const warnings = []

  // Un plan puede contener tareas en formato bloques (### Task ...) o tabla
  const hasTaskBlocks = /### Task\s+/i.test(content)
  const hasTable = /\|(?:\s*:?-+:?\s*\|)+/.test(content) && content.includes("| ID |")

  if (!hasTaskBlocks && !hasTable) {
    errors.push(`El archivo '${filename}' no contiene tareas reconocibles. Debe incluir bloques '### Task ...' o una tabla markdown de tareas.`)
  }

  let tasksCount = 0
  if (hasTaskBlocks) {
    const blocks = content.split(/\n(?=### Task\s+)/i)
    for (const block of blocks) {
      const match = block.match(/### Task\s+(?:(\d+):?\s*)?([A-Z0-9_-]+)?(?:\s*[:—]\s*(.+))?/i)
      if (!match) continue
      tasksCount++
      const taskId = match[2] || match[1] || `Task-${tasksCount}`

      if (!block.includes("- **Estado:**") && !block.includes("- **State:**") && !/·\s*(⬜|⏳|✅|❌)/.test(block)) {
        warnings.push(`Tarea '${taskId}': Falta campo explícito '- **Estado:** [⬜ PENDING | ⏳ EN PROGRESO | ✅ COMPLETED | ❌ FAILED]'.`)
      }
      if (!block.includes("- **Contrato:**") && !block.includes("- **Contract:**")) {
        warnings.push(`Tarea '${taskId}': Se recomienda definir un '- **Contrato:**' con criterios de aceptación verificables.`)
      }
    }
  }

  const isValid = errors.length === 0
  let fixGuide = ""
  if (!isValid || warnings.length > 0) {
    fixGuide = `
=== GUÍA PARA CORREGIR FORMATO EN ${filename} ===
Estructura recomendada para cada tarea en un plan:
### Task 1: CANV-01 — Título descriptivo
- **Prioridad:** 🔴 P0
- **Esfuerzo:** 🟡 2-3d
- **Archivos clave:** packages/runtime/schemas/
- **Contrato:** Comando de verificación y salida esperada
- **Estado:** ⬜ PENDING
`.trim()
  }

  return {
    isValid,
    filename,
    tasksCount,
    errors,
    warnings,
    fixGuide
  }
}

export function validateTaskFileFormat(content, filename = "task.md") {
  const errors = []
  const warnings = []

  if (!/^#\s+(?:Task:\s*)?[A-Z0-9_-]+/im.test(content)) {
    errors.push(`El archivo '${filename}' debe iniciar con '# Task: <ID> — <Título>'.`)
  }

  if (!/- \*\*Estado:\*\*/i.test(content) && !/- \*\*State:\*\*/i.test(content)) {
    warnings.push(`Falta campo '- **Estado:** ⬜ PENDING | ⏳ EN PROGRESO | ✅ COMPLETED'.`)
  }

  if (!/## (?:Contrato|Contract)/i.test(content)) {
    warnings.push(`Se recomienda una sección '## Contrato' con el comando determinista de verificación.`)
  }

  if (!/## Steps/i.test(content) && !/### Steps/i.test(content)) {
    warnings.push(`Se recomienda una sección de '## Steps de ejecución' con checkboxes '- [ ] Step 1...'.`)
  }

  const isValid = errors.length === 0
  let fixGuide = ""
  if (!isValid || warnings.length > 0) {
    fixGuide = `
=== GUÍA PARA CORREGIR FORMATO DE TASK FILE (${filename}) ===
Estructura requerida:
# Task: <ID> — <Título>
- **Estado:** ⬜ PENDING
- **Plan:** docs/agent-ops/plans/<plan>.md
- **Archivos clave:** ruta/al/archivo.ts

## Contrato
- Verificación: pwsh .agents/dev-tools/verify.ps1

## Steps de ejecución
- [ ] Step 1: Implementar lógica
- [ ] Step 2: Test y verificación
`.trim()
  }

  return {
    isValid,
    filename,
    errors,
    warnings,
    fixGuide
  }
}
