---
description: "Start spec-driven development — redacta especificaciones técnicas estructuradas y vinculadas a la arquitectura antes de codificar"
---

Modo ponytail (full) activo vía plugin (ver `.agents/skills/ponytail/SKILL.md`).
Invocá la skill `spec-driven-development`.
Si los requisitos son ambiguos o están incompletos, invocá la skill `interview-me` para extraer la necesidad real antes de suponer.

## Flujo Automatizado de Especificación (Spec-Driven Architecture)

> Principios canónicos de `AGENTS.md` y `prompts/question-gates.md`:
> Contexto primero, opciones concretas con `(Recomendado)`, cero asunciones ciegas, trazabilidad total.

---

### Paso 1 — Extracción de Contexto y Guardrails (Grounding)

Antes de realizar cualquier pregunta al usuario, derivá la información del repositorio para evitar redundancias:

1. **Topología y Código:**
   - Invocá `codegraph_codegraph_explore` en las áreas o módulos afectados para conocer interfaces y patrones existentes.
   - Si está disponible, usá `codebase-memory` (`query_graph`, `search_graph`) para rastrear contratos previos.
2. **Documentación Canónica y Decisiones:**
   - Leé `AGENTS.md` (guardrails arquitectónicos obligatorios, reglas de seguridad y stack).
   - Revisá `docs/architecture/` y `docs/architecture/adr/` para validar consistencia de decisiones previas.
   - Leé `memory_read_decisions` del MCP `agent-system` para verificar decisiones tomadas en iteraciones previas.
3. **Validación Externa:**
   - Si la especificación involucra una nueva dependencia o API externa, validá compatibilidad contra documentación oficial (`websearch` o `webfetch`) ANTES de sugerirla.
4. **Guardrails Específicos de Ego:**
   - Context Isolation: Renderer no accede a Node/VantaDB.
   - Memoria: Solo en Main Process vía `NativeVantaDB` (`"vantadb/native"`).
   - IPC fuertemente tipado.
   - UI Budget: No sobreingeniería en presentación sin funcionalidad probada.

Todo dato derivable del repositorio se incorpora directamente a la especificación como **decisión tomada por evidencia** citando el archivo y línea (`ref: archivo:línea`).

---

### Paso 2 — Tabla de Decisiones y Tradeoffs Abiertos

Identificá exclusivamente las decisiones que requieren definición de negocio, UX o selección de tradeoff técnico:

| # | Decisión Clave | Alternativas Reales (+ Tradeoff técnico) | Default Recomendado |
|---|----------------|------------------------------------------|---------------------|
| 1 | Ej: Canal de IPC | Invoke/Handle (bidireccional síncrono) vs EventBus (asíncrono broadcast) | `(Recomendado) Invoke/Handle` |

*Criterio de rigor:* Cada fila debe tener al menos 2 alternativas reales con costos explícitos. Si solo hay una opción técnicamente viable, registrala como decidida por evidencia (`✅ Decidido por arquitectura`) y no molestes al usuario.

---

### Paso 3 — Ronda de Preguntas Interactiva

Si existen decisiones abiertas en el Paso 2:
- Utilizá la herramienta `ask_question` (o `question` según el harness) en una **única ronda agrupada (batch)**.
- Formato: opciones claras, descriptivas y con el `(Recomendado)` en la primera posición.
- Si no hay herramientas de pregunta interactivas disponibles, detenete y presenta la tabla al usuario solicitando confirmación antes de escribir el archivo de especificación.

---

### Paso 4 — Generación del Documento de Especificación

Escribí la especificación formal en:
- `docs/architecture/specs/<FEATURE_NAME>.md` (especificación de feature/módulo)
- O en `SPEC.md` (si es la especificación general del proyecto o hito mayor).

#### Estructura Canónica del Spec

```markdown
# Spec: [Nombre del Proyecto o Feature]

> Estado: 🟢 APROBADA | 🟡 EN REVISIÓN | ⚪ BORRADOR
> Fecha: YYYY-MM-DD
> Autor / Sub-Ego: [ego-lead | coder | architect]
> Referencias: docs/architecture/adr/NNN_*.md, docs/roadmap/Backlog.md

## 1. Objetivo y Problema
- **Problema real:** [Qué dolor resuelve, justificación causal en ≤3 líneas]
- **Solución propuesta:** [Resumen de la capacidad técnica entregada]

## 2. Usuarios y Casos de Uso
- **Actor principal:** [Usuario final, desarrollador, Sub-Ego interno]
- **Flujo principal (Golden Path):**
  1. Paso 1...
  2. Paso 2...

## 3. Contratos de Datos e Interfaces
- **Esquemas / Tipos (TypeScript / Zod):**
  \`\`\`typescript
  // Interfaces públicas y contratos IPC
  \`\`\`
- **Canales IPC / APIs:**
  - Canal: `namespace:action` -> Payload -> Retorno

## 4. Criterios de Aceptación (DoD Verificable)
- [ ] **AC-1:** [Comportamiento observable verificable mecánicamente]
- [ ] **AC-2:** [Comportamiento bajo condición de borde o error]
- [ ] **AC-3:** `pwsh .agents/dev-tools/verify.ps1` pasa sin regresiones ni errores de tipos.

## 5. Guardrails y Restricciones Arquitectónicas
- **Siempre:** [Patrones obligatorios, tipado estricto, manejo seguro de errores]
- **Prohibido:** [Patrones vetados: any, bypass de IPC, código de motor en renderer]
- **Impacto de seguridad:** [Análisis de permisos o superficies expuestas]

## 6. Desglose de Tareas para el Backlog
Candidatas a registrar en `docs/roadmap/Backlog.md`:
| ID Propuesto | Título de la Tarea | Esfuerzo | Prio | Dependencias |
|--------------|-------------------|----------|------|--------------|
| `FEAT-01`    | Implementar contrato e IPC | 🟢 1d | 🔴 P0 | — |
| `FEAT-02`    | Integrar en UI / Canvas    | 🟡 2d | 🔴 P0 | `FEAT-01` |
```

---

### Paso 5 — Sincronización y Registro en Memoria

Una vez escrita la especificación:
1. Registrá la decisión en el sistema de memoria MCP:
   - Invocá `memory_record_decision(entry="Spec: <NOMBRE> aprobada con contratos definidos en docs/architecture/specs/<NOMBRE>.md")`.
2. Si la especificación define un cambio arquitectónico estructural costoso de revertir, proponé o generá el ADR correspondiente en `docs/architecture/adr/`.
3. Ofrecé el siguiente paso operativo:
   - `/pipeline plan <NOMBRE>` para convertir el spec en un plan de ejecución por oleadas.
   - O incorporar las tareas desglosadas en `docs/roadmap/Backlog.md`.
