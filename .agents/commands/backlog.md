---
description: "Revisa el backlog completo: lista tareas activas con descripción explicativa y recomienda la de mayor prioridad para resolver ya"
---

Modo ponytail (full) activo vía plugin (ver `.agents/skills/ponytail/SKILL.md`). Read-only — no modifiques ningún archivo.

## 1. Revisar el backlog

1. Leé `docs/roadmap/Backlog.md` (o `docs/roadmap/roadmap.md`) completo (usa multiples Reads con `offset` — son ~1500 líneas).
2. Filtrá **solo tareas ACTIVAS** (esquema canónico: `.agents/references/backlog-format.md`):
   - La columna `Estado` es la fuente de verdad. Excluí de la recomendación: `🧊 Icebox`, `🔮 Futuro`, `❌ Descartada`
   - Incluí: `🆕 Pendiente`, `⏳ En curso`, `⏸️ Bloqueada` (las bloqueadas se listan con su motivo y no se recomiendan como #1)
   - No hay filas tachadas en el formato canónico (las completadas se ELIMINAN; sin `~~...~~`)
3. Revisá `docs/agent-ops/plans/` — si el plan más reciente tiene tareas en progreso, marcá cuáles del backlog ya están en ejecución (bajales prioridad en la recomendación).
4. Si no existe el backlog, informá el error y detenete.

## 2. Listar tareas activas con descripción

Agrupá por sección/fase del archivo (DELTA, P5, P6, P24, P28, P38, P49–P59, …). Para CADA tarea activa, una fila con:

| ID | Qué es (descripción explicativa de 1 línea) | Esfuerzo | Prio |

- **ID** — el identificador (ej: `AUDIT-01`).
- **Qué es** — resumí la esencia en lenguaje claro: qué problema resuelve, qué riesgo mitiga, o qué desbloquea. NO copies la descripción completa.
- **Esfuerzo** — 🟢/🟡/🟠/🔴.
- **Prio** — 🔴/🟠/🟡/🟢/🔵.

Si una sección tiene más de 10 activas, mostrá las primeras 10 completas y el resto en una línea de conteo: `+N más (<IDs>) — ver Backlog.md`.

Al final: `**Total: N tareas activas en M fases.**`

## 3. Analizar y recomendar la prioridad

Puntuá cada tarea activa con esta heurística (simple, no perfecta):

| Señal | Puntos |
|-------|--------|
| Prio 🔴 | +3 |
| Prio 🟠 | +2 |
| Prio 🟡 | +1 |
| Prio 🟢/🔵 | 0 |
| Texto contiene "Bloquea release" / "Bloqueante" / "bloquea" | +3 |
| Fase 1 (Security) o Fase 13 (AUDREP CRÍTICO) | +2 |
| Categoría Durabilidad / Panic / Seguridad / UAF en descripción | +2 |
| Es la que destraba otras pendientes (otras dicen "depende de <ID>") | +2 |
| Esfuerzo 🟢 (quick win de alto valor) | +1 |
| Esfuerzo 🔴/Muy alto | -1 |
| Ya en ejecución en el plan activo | -2 |

Mostrá el **Top 3** con puntaje y justificación de 1 línea cada uno.

**Recomendación final:** la #1, con el "por qué ahora" explícito (riesgo que mitiga, release que desbloquea, dependencia que destraba) y el comando exacto para arrancarla:

| Tipo de tarea | Comando |
|---------------|---------|
| Bug con repro | `/pipeline task <ID>` (bug: repro→fix en task file) |
| Rust core / bindings / docs | `/pipeline task <ID>` |
| Investigación/arquitectura | `/pipeline task <ID>` (rutea a ego-arch/ego-audit) |

### Graceful degradation
Si una fase no tiene tareas activas, omitila. Si `docs/agent-ops/plans/` está vacío, no lo menciones. No mostrar errores.

## Formato

Output markdown conciso (una página idealmente, máx. 2):
- Sección 2: tablas por fase con descripciones
- Sección 3: Top 3 con puntajes + recomendación final en negrita
