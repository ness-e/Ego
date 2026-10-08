> **ENTRY POINT — CodeGraph Audit Command**
> El agente DEBE leer este archivo cuando el usuario envía `/codeGraph` (o `/codeGraph <scope>`).
> Orquesta auditorías estructurales/semánticas usando **CodeGraph** + **codebase-memory-mcp**
> (CBM), **una por una**, y produce un informe final con tareas accionables clasificadas por tipo de acción.

**Anti-proliferación (Regla del sistema):** `/codeGraph` NO reemplaza a `/audit`
(gate mecánico de linters/tests vía `unified-review`) ni a `/webperf` (performance web).
Cubre el espectro *estructural/semántico* que esas herramientas no abordan:
acoplamiento, código muerto, complejidad ciclomática, impacto de cambios, API pública,
fronteras de integración y deriva de documentación. Complementa, no solapa.

**Skills a cargar:** `codebase-memory` (si está disponible), `progreso` (modo ponytail full activo vía plugin — ver `.agents/skills/ponytail/SKILL.md`).

**Prerequisitos:**
- CodeGraph indexado: verificar con `codegraph status` (CLI) / `codegraph_codegraph_explore "status"`.
- CBM indexado: `codebase-memory-mcp_list_projects` → identificar el project key del workspace actual (por defecto derivado de la ruta del workspace o listado disponible).
- Si el proyecto no aparece en CBM: ejecutar `codebase-memory-mcp_index_repository` en modo `moderate`.

**Contrato de scope:** `<scope>` opcional — `--path <dir>`, o nada = workspace completo.
Pasar el scope a cada consulta de abajo.

## Fase 0 — Sanity (antes de auditar)

0. **Mantenimiento:** al cargar la skill `codebase-memory` corre su ritual automático
   (health check CBM+CodeGraph + re-index `moderate` si es necesario). Sin índices sanos,
   las fases siguientes dan falsos negativos.
1. `codebase-memory-mcp_check_index_coverage(scopes:["."])` → confirmar cobertura del workspace.
   Si hay archivos `parse_partial`/`skipped`, grep allí antes de afirmar "no existe".
2. `git diff --name-only HEAD` → capturar archivos sin commit para la auditoría de impacto (Fase 7).
   Si vacío, usar `HEAD~1`.

## Fases de auditoría (una por una, en orden)

Cada fase: correr las llamadas indicadas, registrar hallazgos con `file:line` + evidencia (query usada).
No saltar fases.

### Fase 1 — Arquitectura y capas (CBM)
- `codebase-memory-mcp_get_architecture(aspects:["clusters","layers","boundaries","cycles"])` →
  mapear módulos *de facto* vs estructura de carpetas; detectar ciclos.
- Para cada cluster sospechoso: `codegraph_codegraph_explore "<cluster> responsabilidades"` para leer source y validar fronteras.
- Hallazgo tipo: acoplamiento indebido, capa violada, ciclo entre paquetes → 🔧 ARREGLAR / ♻️ REFACTORIZAR.

### Fase 2 — Acoplamiento entre módulos/paquetes (CBM)
- `codebase-memory-mcp_query_graph` para edges `CALLS`/`WORKSPACE_DEPENDENCY` entre módulos o paquetes;
  identificar módulos sobrecargados (muchas dependencias entrantes) y dependencias circulares.
- `codegraph_codegraph_explore` para confirmar dependencias reales vs transitivas.
- → ♻️ REFACTORIZAR (acoplamiento) / 🔍 INVESTIGAR.

### Fase 3 — Código muerto / símbolos huérfanos (CBM + CodeGraph)
- `codebase-memory-mcp_query_graph`: funciones/clases sin inbound ni outbound edges (grado 0 o solo auto-referencia).
- `codegraph_codegraph_explore` del símbolo para confirmar que no es API pública, exportación de paquete ni usado por tests.
- → ♻️ REFACTORIZAR (borrar) / 🔍 INVESTIGAR si es API pública.

### Fase 4 — Duplicación semántica (CBM)
- `codebase-memory-mcp_search_graph(semantic_query:[...])` por dominios clave del proyecto
  (parseo, serialización, storage, utilidades) → funciones conceptualmente idénticas.
- `codegraph_codegraph_explore` de ambas para comparar firmas.
- → ♻️ REFACTORIZAR (consolidar) / 🔍 INVESTIGAR.

### Fase 5 — Hotspots de complejidad (CBM)
- `codebase-memory-mcp_query_graph` filtrando:
  `transitive_loop_depth >= 3`, `linear_scan_in_loop >= 1`, `alloc_in_loop >= 1`,
  `unguarded_recursion = true`, `complexity` alto.
- `codegraph_codegraph_explore` del hot path para leer el bloque.
- → ⚡ OPTIMIZAR / ♻️ REFACTORIZAR.

### Fase 6 — API pública / contratos (CodeGraph + CBM)
- Explorar exports públicos del paquete / crate / módulo principal (`index.ts`, `lib.rs`, `__all__`, etc.) → superficie pública.
- `codebase-memory-mcp_trace_path(function_name, direction:"inbound")` → consumidores externos.
- Contrastar contra cambios de versión y contratos de API.
- → ✏️ MODIFICAR (API) / 🔧 ARREGLAR (contrato roto) / 🔍 INVESTIGAR.

### Fase 7 — Radio de impacto / pre-merge (CBM)
- `codebase-memory-mcp_detect_changes(scope:"impact", direction:"inbound", base_branch:"main", since:"HEAD~1")`
  → qué toca el diff actual. Si no está soportado o falla, usar `git diff --name-only HEAD` o `HEAD~1`.
- `codegraph_codegraph_explore` de los símbolos impactados para analizar dependencias.
- → 🔍 INVESTIGAR (alcance del cambio) / 🔧 ARREGLAR (efecto colateral).

### Fase 8 — Fronteras y seguridad (CBM + CodeGraph)
- Buscar puntos críticos de entrada/salida (validación de inputs, deserialización, llamadas al SO, bloques no seguros).
- `codegraph_codegraph_explore` de cada bloque crítico para medir blast-radius.
- → 🔧 ARREGLAR / 🔍 INVESTIGAR (seguridad).

### Fase 9 — Fragilidad y manejo de errores (CodeGraph + CBM)
- Buscar patrones de caída abrupta o excepciones no controladas según el lenguaje (`unwrap`, `panic`, `throw new Error` genérico sin tipar, `except: pass`).
- → 🔧 ARREGLAR / ✏️ MODIFICAR.

### Fase 10 — Gaps de cobertura de tests (CBM)
- `codebase-memory-mcp_query_graph`: símbolos de lógica de negocio no referenciados por suites de prueba (`test`, `tests`, `spec`).
- → ✏️ MODIFICAR (agregar test) / 🔍 INVESTIGAR.

### Fase 11 — Deriva de documentación (CBM + CodeGraph)
- `codebase-memory-mcp_search_graph` de símbolos API vs `docs/api/` o READMEs; `codegraph_codegraph_explore` para firma actual.
- Doc no coincide → ✏️ MODIFICAR (doc-driven dev).

### Fase 12 — Decisiones y registros de arquitectura (ADRs)
- `codebase-memory-mcp_manage_adr(mode:"get")` o lectura de `docs/architecture/adr/`
  → listar decisiones y verificar que cambios estructurales mayores estén documentados.
- Faltante → 🔍 INVESTIGAR (proponer ADR).

## Fase Final — Consolidar y reportar

1. **Agrupar hallazgos** en 5 buckets de acción:
   - 🔧 **ARREGLAR** (fix): bugs, contratos rotos, fallos de seguridad.
   - ✏️ **MODIFICAR** (modify): API, docs, config, tests faltantes.
   - ⚡ **OPTIMIZAR** (optimize): cuellos de botella, complejidad innecesaria.
   - ♻️ **REFACTORIZAR** (refactor): duplicación, código muerto, acoplamiento.
   - 🔍 **INVESTIGAR** (investigate): riesgos, semántica a confirmar, ADR pendiente.
2. **Severidad:** Critical / High / Medium / Low (por impacto + alcance).
3. **Escribir informe** `docs/agent-ops/reviews/codegraph-<YYYYMMDD>-<HHMMSS>.md`:
   - Resumen ejecutivo (conteo por bucket + severidad).
   - Por cada fase: hallazgos con `file:line`, evidencia (tool + query), severidad, acción sugerida.
   - Tabla consolidada: `| ID | Título | Acción | Severidad | Ubicación | Recomendación |`.
4. **Backlog (FIND-*)**: cada hallazgo ≥ Medium → fila en `docs/roadmap/Backlog.md`
   sección `## Hallazgos pendientes de reportes`, con el esquema canónico de 10
   columnas (`.agents/references/backlog-format.md`):
   `| FIND-<n> | <sev> | **<título>** | <archivo:línea> | <esf> | <prio> | 🆕 Pendiente | <desc + acción> | Origen: codegraph-<ts> | — |`
   (Origen obligatorio = este reporte; esquema único `.agents/task-system/prompts/findings.md`).
5. **INDEX**: fila en `docs/agent-ops/reports/INDEX.md` apuntando al reporte.
6. **Mensaje final**: resumen de conteos por bucket + ruta del reporte +
   "Ejecutá `/pipeline plan docs/roadmap/Backlog.md` para triage de FIND-*".

## Notas
- **Solo lectura:** este comando NO edita código (es auditoría). Los fixes se delegan vía `FIND-*` a `/pipeline task`.
- Complementa `/audit certify` — correr antes de release o merge mayor.
