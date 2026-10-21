# ADR 0024: Identidad declarativa de Sub-Egos, presupuestos con circuit breaker y divulgación progresiva de tools

| Campo | Valor |
| --- | --- |
| Fecha | 2026-07-21 |
| Estado | Aceptado (implementado y verificado en `packages/**`; **el cableado en la app está pendiente**) |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |
| Decisor | Owner (Ola 4b, Fase 03) · implementación y texto técnico A3 · redacción A1 |
| Sustituye a | Nada — amplía `SubEgoSoul` (SUB-11) y `SubEgoBudget` (SUB-09) |
| Relacionado | [ADR-0020](0020-compactacion-motor-ts-vs-nativo.md) · [ADR-0019](0019-canal-dual-taint-tracking.md) |

## Contexto

La identidad de un Sub-Ego (nombre, rol, valores, reglas innegociables, narrativa)
vivía **en código**: `packages/subegos/src/SubEgoSoul.ts` con un esquema Zod de 56
campos y un renderizador de prompt. Eso obligaba a **modificar TypeScript para
crear un especialista nuevo** y hacía imposible **versionar la identidad** junto
al proyecto que la usa.

En paralelo, el presupuesto de un Sub-Ego sólo tenía dos cuotas
(`maxTokensPerCall`, `maxDailyCostUsd`):

- **No había límite de tiempo**: un turno podía colgarse eternamente.
- **No había degradación**: al agotar el presupuesto el Sub-Ego se detenía sin más.
- El **tope de coste por llamada** no estaba conectado al `ModelRouter`, que ya
  sabe degradar a un modelo más barato (`maxCostPerCallUsd`, `EGO-FIND-39`).

Y el **catálogo de tools era fijo** por rol o perfil: las **skills no eran
consultables** y no existía forma de descubrir que una tool hacía más de lo que
su nombre sugiere. Sin metatools, la única manera de ampliar la superficie de
un Sub-Ego era tocar el código del registro.

## Alternativas consideradas

| Alternativa | Veredicto | Motivo |
|---|---|---|
| **Sólo YAML** (`SOUL.yaml`) | ❌ Descartada | Ya existía `SubEgoSoul.fromYaml()`, pero un YAML no admite la **narrativa libre** con la que se describe una identidad; el Markdown sí, y además es legible en un PR |
| **Duplicar la degradación** dentro de `packages/subegos` | ❌ Descartada | Duplicaría la tabla de precios y la lógica de disponibilidad del router, que es la fuente canónica |
| **Añadir `@ego/models` como dependencia** de `@ego/subegos` | ❌ Descartada | Acopla el runtime de Sub-Egos al router y crea un ciclo potencial (`models` ↔ `subegos`) |
| **Un único `maxCostPerCallUsd` global** | ❌ Descartada | El tope por Sub-Ego es una necesidad de gobernanza: un Sub-Ego de alto coste no debe vaciar la cuota de los demás |
| **Identidad en artefacto declarativo + circuit breaker + metatools** | ✅ **Elegida** | Permite crear y versionar un Sub-Ego sin tocar TypeScript, hace el presupuesto **medible** en tres dimensiones y da una **escalera de divulgación** para descubrir la superficie real de las tools |

## Decisión

### 1. La identidad se externaliza a un artefacto declarativo

Un Sub-Ego declara su identidad en un artefacto Markdown con frontmatter YAML
(`SOUL.md`, o `AGENT.md` con un bloque `soul:` anidado):

```markdown
---
id: ego.auditor-tecnico
name: Auditor Técnico
tone: analytical
values: [...]
inviolableRules: [...]
---

<narrativa de identidad en Markdown>
```markdown

El **manifiesto** declara el artefacto con un campo aditivo `identity`
(`{ file, format, required }`) y el **runtime lo carga**
(`loadSubEgoIdentity(manifest, { reader, workspacePath })`).

**Reglas** (las cinco son invariantes, no preferencias):

1. **La API pública no cambia**: sin artefacto declarado, el loader en código
   (`SubEgoSoul.fromManifest`) sigue siendo el **fallback**. Ningún Sub-Ego
   existente deja de funcionar.
2. **Fail-closed**: `identity.required = true` + artefacto ausente o corrupto
   ⇒ error tipado (`SubEgoIdentityNotFoundError`). **No hay identidad a medias.**
3. **Confine**: la ruta se ancla al workspace; salir de él es
   `SubEgoIdentityUnsafePathError` (path traversal), salvo `allowOutsideWorkspace`
   explícito.
4. **Separación de poderes**: el artefacto declara *identidad*; el manifiesto
   sigue declarando *gobernanza* (tools, permisos, namespaces, presupuesto). **El
   artefacto no puede conceder permisos.**
5. El cuerpo Markdown es la **narrativa** (`identityBody`) y se inyecta en el
   prompt del alma como sección `[IDENTITY NARRATIVE]`, dentro del **Tier 3
   (Soul)**, que ya está subordinado al Tier 1 (guardrails de seguridad) y al
   Tier 2 (core rules). **La precedencia no cambia.**

### 2. Los presupuestos abren un circuito medible

Cada Sub-Ego declara un presupuesto con **tres dimensiones** —tokens, coste y
tiempo— y un circuit breaker (`SubEgoBudgetCircuitBreaker`) que decide, de
forma **medible** (contadores numéricos, no flags), una de tres acciones:
**permitir**, **degradar a un modelo más barato** o **detener con un error
tipado** (`SubEgoBudgetCircuitBreakerError`, con `limit`, `current`,
`maxAllowed`, `subEgoId`).

El tope de coste por llamada efectivo es el **mínimo** entre el declarado por el
Sub-Ego y el global del `ModelRouter`.

### 3. La política de modelos NO se duplica

El circuit breaker decide *cuándo* degradar; el `ModelRouter` decide *con qué
modelo*. La conexión es **estructural** (`BudgetAwareRouterLike`):
`@ego/subegos` no depende de `@ego/models`. El router expone
`getMaxCostPerCallUsd()` y `resolveCheaperModel()`; si no hay modelo más barato
disponible, el circuito **detiene** con error tipado (**fail-closed**: nunca se
degrada a un `mock` que devolvería una respuesta ficticia).

### 4. Los metatools dan la escalera de divulgación progresiva (E13)

El catálogo de tools deja de ser una lista fija y se convierte en algo
**consultable en tres peldaños**, gobernados por el registro confinado:

| Metatool | Pregunta que responde | Qué revela |
|---|---|---|
| `lookup_skills` | ¿Qué hay? | El catálogo de skills, **confinado al registro** |
| `search_tools` | ¿Qué tool encaja? | Las tools que resuelven una necesidad concreta |
| `expand_tools` | ¿Qué hace del todo esta tool? | La **superficie completa** de una tool (parámetros, efectos, permisos) |

**Gobernanza:** un metatool ve **sólo lo que su registro ve**. No es un oráculo
del catálogo: si una tool no está en el registro del Sub-Ego, ningún metatool la
menciona. La divulgación progresiva no puede usarse para **escalar privilegios**
—solo para **descubrir** lo que ya se tiene.

La escalera existe porque los metatools son, además, el **ejecutor por defecto
de la delegación**: sin ellos, ampliar la superficie de un Sub-Ego exigía tocar
el registro en código.

## Consecuencias

- Positivas:
  - Se puede **crear y versionar** un Sub-Ego (con su identidad) **sin tocar
    TypeScript** — la identidad es un fichero más en el repositorio del
    proyecto.
  - Los Sub-Egos existentes **siguen funcionando**: el fallback es el
    comportamiento por defecto.
  - Un Sub-Ego **puede colgarse en el tiempo**: el tope `maxTurnDurationMs` abre
    el circuito.
  - El presupuesto se vuelve **medible** en las tres dimensiones y la
    degradación es una decisión con contadores, no un flag.
  - La superficie de tools es **consultable** sin ampliar el registro en código.
- Negativas:
  - `@ego/models` expone **dos métodos públicos más** (`getMaxCostPerCallUsd()`,
    `resolveCheaperModel()`) — diff exacto en el handoff de A3 §5.1, en la zona
    de A2.
  - `identity` es un campo **aditivo** en el manifiesto ⇒ hace falta una
    migración de los manifiestos existentes si se quiere usar (no es obligatoria:
    el fallback cubre).
  - Los metatools son **superficie**: tres tools más que pueden invocar un
    modelo, y por tanto tres caminos más que auditar. El confine del registro
    es lo que los hace seguros.
- Deuda asumida:
  - **La capacidad está `SPECIFIED + IMPLEMENTED + VERIFIED` en `packages/**`, pero
    aún no es alcanzable desde la app**: A4 tiene **3 diffs de producción
    pendientes** (handoff `A4-ola4b.md` §5.3) y A2 debe exponer los dos métodos
    del router. Sin eso, la identidad declarativa y los metatools son
    capacidades que el producto no puede usar todavía. Registrado en el Backlog
    como `EGO-FIND-88`, `EGO-FIND-89` y `EGO-FIND-90` (estado **🟡 Parcial**, no
    cerrado: implementado ≠ integrado).

## Referencias

- `packages/subegos/src/SubEgoIdentity.ts` — artefacto, cargador, fail-closed y confine.
- `packages/subegos/src/soulDocument.ts` — el formato del artefacto (`SOUL.md`/`AGENT.md`).
- `packages/subegos/src/SubEgoBudgetBreaker.ts` — el circuit breaker de tres dimensiones.
- `packages/subegos/src/SubEgoBudget.ts` — la contabilidad (`SubEgoBudgetTracker`).
- `packages/subegos/src/SubEgoSoul.ts` — el loader en código que queda como **fallback**.
- `packages/tools/src/meta/metaTools.ts` — los 3 metatools y la escalera de divulgación.
- `packages/tools/test/meta-tools.test.ts` · `packages/subegos/test/SubEgoBudget.test.ts` — verificación.
- `docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A3-ola4b.md` §2.6 y §3 — texto técnico de origen (decisión, alternativas descartadas y verificaciones).
- `docs/roadmap/Backlog.md` — `EGO-FIND-88` · `EGO-FIND-89` · `EGO-FIND-90` · `EGO-FIND-39` (degradación del router).
