> **PLANTILLA — Mini-Spec (spec-driven guiado, fuente única — Ego)**
> Cuándo: toda tarea **feature-add, lógica nueva o evaluación de patrón** (Gate P/Gate D de
> `question-gates.md`) ANTES de aprobar DO y ANTES del task file.
> Las decisiones abiertas (⚠️) se resuelven con el usuario vía `question` tool —
> una ronda, opciones concretas + default recomendado. Sin spec completa → no hay ACT.

# Spec: <ID> — <título>

- **Tipo:** feature-add | lógica nueva | refactor-comportamental | evaluación-patrón
- **Origen:** backlog | usuario | discovery | repo-referencia
- **Fecha:** YYYY-MM-DD
- **Veredicto Preliminar:** 🟢 Factible para Ego | 🚫 Descarte Justificado

## 1. Problema
Qué problema real resuelve, en ≤5 líneas. Evidencia (issue, caso de uso, requerimiento arquitectónico).

## 2. Evaluación de Viabilidad vs Principios Innegociables (AGENTS.md)
- ¿Respeta la arquitectura Desktop (Electron + Vite + React 19)?: Sí / No
- ¿Acceso a memoria pasa por EgoMemoryAdapter y NativeVantaDB in-process?: Sí / No
- ¿Evita dependencias prohibidas (Next.js en desktop, SQLite, Mastra, LangGraph)?: Sí / No
*Si colisiona con algún principio innegociable, marcar inmediatamente:*
`Estado: 🚫 Descartada: <Fundamento técnico>` y registrar en Backlog sin avanzar a código.

## 3. Criterio de Aceptación (DoD Mecánico)
Comandos y comportamientos observables que certifican que está resuelto:
1. `pnpm typecheck` pasa con 0 errores en todos los paquetes.
2. `<comando específico de test o verificación>` pasa exitosamente.
3. Comportamiento observable verificado en runtime.

## 4. Alcance
- **Incluye:** ...
- **NO incluye:** ... (explícito — barrera anti-scope-creep)

## 5. Diseño Propuesto
≤10 líneas: paquetes o módulos afectados (`packages/*`, `apps/desktop/`), interfaces Zod, canales IPC y flujo de datos.

## 6. Decisiones Abiertas (⚠️ → question al usuario)

> **Profundidad mínima por fila:** ≥2 alternativas **REALES** (enfoques
> materialmente distintos, no variantes cosméticas) + costo/tradeoff de una
> línea por opción. Si solo existe un camino viable, registrarlo con su
> evidencia (`ref: archivo:línea` o doc oficial) y marcarlo ✅ decidido-por-evidencia.

| # | Decisión | Opciones (+tradeoff) | Default recomendado | Resuelto |
|---|----------|----------------------|---------------------|----------|
| 1 | ej: Canal IPC | Invoke síncrono / EventBus asíncrono | Invoke síncrono | — |

## 7. Riesgos y Blast Radius Esperado
Top 3 riesgos (seguridad, IPC, memoria) + lista de archivos afectados.

---
**Estado de la spec:** ⬜ borrador → 🔄 preguntas enviadas → ✅ confirmada por el usuario | 🚫 descartada

Al confirmarse: la spec se traslada a la sección `## Spec` del task file y el `Contrato` se copia de §3.
Al completarse o descartarse: se invoca `task_update_state` para sincronizar atómicamente el Backlog maestro (`Backlog.md`), Roadmap (`roadmap.md`), Task file y estado JSON.
