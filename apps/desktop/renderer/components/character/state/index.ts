/**
 * T4/R15 (VERDICT) — Índice del módulo de estado.
 *
 * Antes exportaba la clase `CharacterStateMachine` (FSM de 14 estados con
 * interpolador cinemático) que **nunca se instanciaba**: 0
 * `new CharacterStateMachine()` en el repo. Se retira (decisión R15,
 * justificada en `character-state.ts`); sobrevive el vocabulario
 * `CharacterState`, que es el contrato chat ↔ badge.
 */
export * from "./character-state.js";
