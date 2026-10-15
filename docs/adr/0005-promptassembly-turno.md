# ADR 0005: System prompt del turno ensamblado en 3 tiers (PromptAssembly) #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-16 |
| Estado | Aceptado |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |

## Contexto ##

`SubEgoSoul.assembleHermesPrompt()` y `PromptAssembly` (tiers
stable→context→volatile, overlay `EPHEMERAL_*`, marcador out-of-band,
`assertSystemPromptStable`) existían como API sin ejercer en producción:
`handleLlmStream` (`apps/desktop/src/main.ts`) construía el system ad-hoc
(`"Eres Ego..."+systemPrompt+contextText`). El diseño de caché e inyección
era decorativo y el riesgo de prompt-injection real (STAB-03).

## Decisión ##

El turno ensambla el system vía `assembleHermesPrompt({coreRules, ...})`:

- **Tier 1 / STABLE** (cacheable, nunca muta mid-turn): guardrails +
  SOUL + guía de tools + índice de skills + hints de SO/plataforma.
- **Tier 2 / CONTEXT**: `coreRules` (literal canónico preservado,
  `EGO_CORE_RULES_STAB03`) → `callerSystemMessage` → AGENTS.md.
- **Tier 3 / VOLATILE**: snapshot congelado a inicio de sesión
  (timestamp congelado por `sessionId` en `buildTurnPrompt`).
- **Recall fresco** (`contextText` pre-turn): overlay efímero
  API-call-time vía `applyEphemeralOverlay`, tras `EPHEMERAL_BOUNDARY`;
  nunca persiste ni contamina el prefijo cacheado.
- **Steers mid-turn**: cola `queueMainSteer/drainMainSteerQueue` → mensajes
  `user` standalone con `formatOutOfBandUserMessage` (única autoridad
  mid-turn; lookalikes en tool output no se obedecen).
- **Estabilidad**: `assertSystemPromptStable` por sesión; la única
  reconstrucción permitida es compresión explícita
  (`{isCompressionRebuild:true}`); cualquier otra mutación lanza
  `PromptStabilityViolationError` (fail-closed).
- `ToolExecutionLoop.run` NO se toca: recibe el system efectivo ya
  resuelto (sus campos `ephemeralSystemPrompt` /
  `cachedSystemPromptFingerprint` quedan para enforcement futuro, STAB-05).

## Consecuencias ##

- Positivas: prefijo cacheable (coste), anti-inyección estructural
  (`ANTI_INJECTION_POLICY` en Tier 1), tripwire contra mutaciones
  mid-turn, tiers testeados (`PromptAssembly.test.ts`, 22 tests).
- Negativas: los bytes del system prompt cambian respecto al ad-hoc
  previo (cambio estructural, NO semántico: mismas reglas, nuevo
  envoltorio); los cachés de proveedor anteriores se invalidan una vez.
- Riesgos: un `callerSystemMessage` que cambie entre turnos de la misma
  sesión lanza en vez de degradar silencioso (intencional, fail-closed);
  requiere nueva sesión o rebuild por compresión. `clearTurnSystemFingerprint`
  queda exportado para fronteras de sesión futuras.

## Referencias ##

- `packages/subegos/src/PromptAssembly.ts:25-77,235-356,413-425`.
- `packages/subegos/src/SubEgoSoul.ts:435-469` (`assembleHermesPrompt`).
- `apps/desktop/src/main.ts` (`buildTurnPrompt`, `handleLlmStream`).
- `AGENTS.md` §4 (10 principios: memoria local, cognitive runtime propio).
