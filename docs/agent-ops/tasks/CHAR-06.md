# Task: CHAR-06 — Estados, expresiones, interpolación y animaciones de interacción

> **Fase:** 03 — Sub-Egos (P0-Alpha)  
> **Estado:** ✅ completed  
> **Fecha:** 2026-10-09  
> **Responsable:** coder / Antigravity  
> **Plan:** `docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md`

---

## 1. Contexto & Propósito

El usuario y el Cognitive Runtime requieren explicabilidad inmediata y sutil del estado operativo de la entidad cognitiva Ego sin depender de parpadeos o animaciones agresivas que fatiguen la experiencia. Basado en `character-system.md` §3 y la adaptación de `COUC-06` (Attention FSM), se requiere una máquina de estados finitos (FSM) estrictamente tipada con 14 estados operativos canónicos y un interpolador cinético que module suavemente los canales de mirada, apertura ocular, pulso respiratorio, aura de concentración y acento cromático RGB.

`CHAR-06` implementa:
1. Enumeración y tipado de los 14 estados canónicos: `idle`, `listening`, `thinking`, `generating`, `searching`, `using_tool`, `waiting`, `approval_required`, `question`, `success`, `warning`, `error`, `sleeping`, `attention`.
2. Metas de configuración continua (`CANONICAL_STATE_TARGETS`) para los canales `gaze`, `open`, `pulse`, `aura`, `accent`, `tint`, `tilt`, `energy`, `squashX` y `squashY`.
3. Coalescencia ante ráfagas de streaming (`notifyStreamingActivity`).
4. Circuit Breaker / Safety timeout para retorno automático a `idle` tras estados transitorios (`success`, `warning`, `error`, `attention`).
5. Amortiguación cinemática continua con función `lerp` exponencial.

---

## 2. Criterios de Aceptación (DoD)

- [x] 14 estados canónicos tipados e implementados en `CharacterStateMachine.ts`.
- [x] Interpolación suave entre canales continuos sin saltos de un solo frame.
- [x] Coalescencia ante ráfagas rápidas de streaming de LLM.
- [x] Auto-recuperación a estado `idle` tras inactividad en estados transitorios.
- [x] Suite de pruebas unitarias en verde (`apps/desktop/test/character-state-machine.test.ts`).
- [x] `pnpm typecheck` exit 0 y `pnpm build` sin errores.
