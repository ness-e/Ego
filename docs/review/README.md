# Review Hub — Ego Cognitive Operating System

| Campo | Valor |
| --- | --- |
| Estado | Activo — Marco de revisión y auditoría técnica |
| Owner | ness-e |
| Fecha | 2026-10-07 |

---

## Propósito

El directorio `docs/review/` centraliza los procesos de auditoría crítica, inspección de código, validación de diseño y revisión técnica de repositorios y subsistemas antes y durante su implementación.

En Ego, ninguna pieza de código entra al núcleo sin pasar por un escrutinio de:
1. **Alineación con los 10 Principios Innegociables** (`docs/product/principios-innegociables.md`).
2. **Jerarquía Canónica de Decisiones** (`docs/jerarquia-canonica.md`).
3. **Guardrails Técnicos de `AGENTS.md`** (No WASM VantaDB, No backend Python obligatorio en P0, No cálculo de embeddings en TS, Context Isolation estricto en Electron).

---

## Contenido del Directorio

Cada backlog usa la **taxonomía canónica de compuerta** (`AGENTS.md` §4):
`✅ Completada` (fichero + caller en producción verificado) · `🚫 Descartada (con justificación)`
(motivo técnico en la celda) · `🆕 Pendiente` (código asimilado sin caller; la celda dice el
cableado y su responsable) · `⏳ Futura (fase)`. **Ninguna compuerta queda en el limbo.**

> **Fuente única de recuentos:** las filas de los catálogos de este directorio.
> Sincronizado el 2026-10-19 (Ola 1, A5) con `docs/extractions/README.md` §4.1.

* [`backlog-hermes.md`](backlog-hermes.md): 30 tareas (`HERM-01..HERM-30`).
  14 ✅ · 3 🚫 · 6 🆕 · 7 ⏳. gemelo de stack: UI Chat/Composer, artifacts, layout de ventanas, hardening Windows,
  packaging.
* [`backlog-openclaw.md`](backlog-openclaw.md): 24 tareas (`OCLW-01..OCLW-24`).
  7 ✅ · 5 🚫 · 11 🆕 · 1 ⏳. admisión inmutable de runs, auto-reparación de tools, locks de sesión, workers.
* [`backlog-coucou.md`](backlog-coucou.md): 29 tareas (`COUC-01..COUC-29`).
  10 ✅ · 6 🚫 · 12 🆕 · 1 ⏳. normalización en el borde, atención, HITL con ACK, ChangeSet, SafeConfigMutation.
* [`backlog-khoj.md`](backlog-khoj.md): 13 tareas (`KHOJ-01..KHOJ-13`).
  3 ✅ · 1 🚫 · 2 🆕 · 7 ⏳. chunking de 256 tokens con solapamiento y hash, filtrado de umbral, extracción de hechos.
* [`backlog-helmor.md`](backlog-helmor.md): 10 tareas (`HELM-01..HELM-10`).
  4 ✅ · 0 🚫 · 6 🆕 · 0 ⏳. terminal output scheduler (coalescencia 16 KB/tick, ring-buffer 2 MB), puente de UI.
* [`backlog-career-ops.md`](backlog-career-ops.md): 8 tareas (`CARP-01..CARP-08`).
  2 ✅ · 3 🚫 · 2 🆕 · 1 ⏳. DATA_CONTRACT.md (User vs System), locks atómicos de filesystem, cuarentena.
* [`backlog-deepseek-harness.md`](backlog-deepseek-harness.md): 12 tareas (`DSEK-01..DSEK-12`).
  0 ✅ · 0 🚫 · 8 🆕 · 4 ⏳. sesiones versionadas, IDs opacos, patrón supersede sin borrado, migraciones aditivas.
* [`backlog-opencode.md`](backlog-opencode.md): 9 tareas (`OCDE-01..OCDE-09`).
  0 ✅ · 1 🚫 · 7 🆕 · 1 ⏳. motor de sesión/agente: permisos persistidos, compactación negociada, code mode, inbox de
  prompts.
* [`backlog-codex.md`](backlog-codex.md): 9 tareas (`CDX-01..CDX-09`).
  0 ✅ · 1 🚫 · 8 🆕 · 0 ⏳. política de tool de tres estados, caché de aprobación por clave, perfil de permisos con
  degradación, parcheo con anclaje contextual.
* [`backlog-goose.md`](backlog-goose.md): 9 tareas (`GOOS-01..GOOS-09`).
  0 ✅ · 1 🚫 · 7 🆕 · 1 ⏳. cadena componible de inspectores de tool-call, inspector de egreso de red, lease del catálogo
  de tools.
* [`backlog-cline.md`](backlog-cline.md): 9 tareas (`CLNE-01..CLNE-09`).
  0 ✅ · 2 🚫 · 6 🆕 · 1 ⏳. snapshots de working tree restaurables, guardas de bucle, caché de resultados de tool, tool
  MCP determinista.
* [`backlog-gemini-cli.md`](backlog-gemini-cli.md): 9 tareas (`GCLI-01..GCLI-09`).
  2 ✅ · 1 🚫 · 5 🆕 · 1 ⏳. motor de reglas priorizadas con identidad MCP/subagente, confianza de workspace, protección
  de `.env*`.
* [`backlog-qwen-code.md`](backlog-qwen-code.md): 9 tareas (`QWEN-01..QWEN-09`).
  0 ✅ · 2 🚫 · 6 🆕 · 1 ⏳. subagentes multi-agente, riesgo de tool MCP no derivado del nombre, piso de superficie de
  tools por rol.
* [`backlog-openhands.md`](backlog-openhands.md): 12 tareas (`OHND-01..OHND-12`).
  0 ✅ · 2 🚫 · 9 🆕 · 1 ⏳. gemelo de stack desktop: bridge IPC tipado, log de arranque en splash, router declarativo,
  sello de perfil.
* [`backlog-vibe-kanban.md`](backlog-vibe-kanban.md): 8 tareas (`VIBE-01..VIBE-08`).
  0 ✅ · 1 🚫 · 6 🆕 · 1 ⏳. worktree idempotente con lock, merge/rebase con guardas, ciclo de vida del proceso de agente.
* [`backlog-mini-swe-agent.md`](backlog-mini-swe-agent.md): 9 tareas (`MSWE-01..MSWE-09`).
  0 ✅ · 1 🚫 · 7 🆕 · 1 ⏳. taxonomía de salida terminal, observación con `elided_chars`, gate de verificación por
  `git diff`.
* [`backlog-swe-agent.md`](backlog-swe-agent.md): 9 tareas (`SWAG-01..SWAG-09`).
  0 ✅ · 2 🚫 · 7 🆕 · 0 ⏳. diseño ACI, contrato observación→prompt, presupuestos de coste independientes.
* [`backlog-crush.md`](backlog-crush.md): 9 tareas (`CRSH-01..CRSH-09`).
  0 ✅ · 1 🚫 · 8 🆕 · 0 ⏳. LSP como fuente de contexto, diagnósticos embebidos, pre-aprobación con `halt`.
* [`backlog-continue.md`](backlog-continue.md): 9 tareas (`CONT-01..CONT-09`).
  0 ✅ · 2 🚫 · 7 🆕 · 0 ⏳. registro de context providers, capacidades declaradas en config, roles y rectificación de
  selección.
* [`backlog-claude-squad.md`](backlog-claude-squad.md): 9 tareas (`CSQD-01..CSQD-09`).
  1 ✅ · 3 🚫 · 4 🆕 · 1 ⏳. rehidratación degradada a reanudable, diff a dos niveles de coste, digest de salida de
  terminal.
* [`backlog-ag-ui.md`](backlog-ag-ui.md): 8 tareas (`AGUI-01..AGUI-08`).
  0 ✅ · 4 🚫 · 3 🆕 · 1 ⏳. validación semántica A2UI, deltas RFC 6902, verificador de invariantes de stream.
* [`backlog-graphiti.md`](backlog-graphiti.md): 9 tareas (`GRPH-01..GRPH-09`).
  0 ✅ · 4 🚫 · 4 🆕 · 1 ⏳. bitemporalidad de dos ejes, detección de contradicciones, cascada de resolución de entidades.
* [`backlog-graphrag.md`](backlog-graphrag.md): 9 tareas (`GRAG-01..GRAG-09`).
  0 ✅ · 1 🚫 · 7 🆕 · 1 ⏳. priorización in/out-network con presupuesto de grafo, pipeline declarativo, caché de
  respuestas LLM.
* [`backlog-mem0.md`](backlog-mem0.md): 9 tareas (`MEM0-01..MEM0-09`).
  2 ✅ · 2 🚫 · 5 🆕 · 0 ⏳. extracción de memoria desde el turno de chat, anti-alucinación de ids, arbitraje
  ADD/UPDATE/DELETE.
* [`backlog-mcp-servers.md`](backlog-mcp-servers.md): 9 tareas (`MCPS-01..MCPS-09`).
  2 ✅ · 2 🚫 · 4 🆕 · 1 ⏳. roots declarado y no implementado, anotaciones de riesgo MCP, descubrimiento documentado y
  ausente.
**Total: 289 tareas · 47 ✅ Completada · 51 🚫 Descartada · 157 🆕 Pendiente · 34 ⏳ Futura · 0 en el limbo.**

> **Verificación mecánica:** `node scripts/audit-extraction-gates.mjs` comprueba sobre los
> 25 repos que la ficha y el backlog comparten el mismo conjunto de IDs, que cada fila
> cierra en uno de los cuatro estados canónicos (0 en el limbo) y que el recuento
> declarado coincide con las filas reales. Los 18 repos de la Ola 2 son **nuevos**: su
> `0 ✅` en la mayoría de los casos es correcto y está justificado en el §0 de su backlog
> (nada asimilado todavía; un `✅` exigiría fichero adaptado **y** caller en producción
> verificado por grep).
> **Nota sobre el patrón de extracción de `khoj`:** el fichero canónico del filtro de umbral es
> `packages/knowledge/src/filters/ScoreThresholdFilter.ts` (no `CosineThresholdFilter.ts`).
> La corrección quedó registrada en la ficha y en el backlog.

---

## Criterio de Aceptación para Reviews (Definition of Done)

Para que una revisión se considere cerrada y apta para extracción/implementación:
- [ ] **Origen comprobado:** Identificación exacta del archivo y línea en el repositorio fuente.
- [ ] **Evaluación de impedimentos:** Confirmación de que no introduce dependencias prohibidas.
- [ ] **Adaptación arquitectónica:** Especificación de cómo se reescribe el patrón en TypeScript / Node 22 / VantaDB.
- [ ] **Vínculo con el Backlog:** Asociación directa con uno o más IDs de `docs/roadmap/Backlog.md`.
- [ ] **Verificación de integración (añadido 2026-10-19):** el patrón asimilado tiene **caller en producción** verificable por grep sobre `packages/` + `apps/desktop/` (excluyendo `test/`). Si no lo tiene, la fila se declara `🆕 Pendiente` con el cableado exacto y su responsable; si el patrón no aplica, `🚫 Descartada` con fundamento técnico.
- [ ] **Sin descarte silencioso:** ningún hallazgo se borra ni se deja sin estado.
