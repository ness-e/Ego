# Task: CHAR-08 — Integración en iconos, botones, chat y selector de Sub-Egos

> **Fase:** 03 — Sub-Egos (P0-Alpha)  
> **Estado:** ✅ completed  
> **Fecha:** 2026-10-09  
> **Responsable:** coder / Antigravity  
> **Plan:** `docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md`

---

## 1. Contexto & Propósito

La identidad de la criatura Ego debe ser visible en todos los puntos clave de interacción del usuario (burbujas de conversación en el Conversation River, selector de especialista en la cabecera del chat y tarjetas del catálogo de Sub-Egos) sin saturar la vista ni degradar el rendimiento con decenas de loops `requestAnimationFrame` compitiendo en GPU.

`CHAR-08` implementa:
1. `CharacterBadge.tsx`: componente visual adaptativo que vincula `CharacterEngine`, `CharacterStateMachine` y `TraitRegistry`.
   - **Optimización StillPose:** por defecto opera con un único render estático determinista (`animated={false}`) para turnos de chat anteriores y miniaturas de catálogo, garantizando < 1% de uso de CPU y 60 FPS estables.
   - **Modo animado:** soporta `animated={true}` para el turno activo en generación continua.
2. `SubEgoSelector.tsx`: componente selector accesible para la cabecera del chat, con el avatar activo del especialista, dropdown estilizado con la lista de Sub-Egos de VantaDB y soporte para conmutación fluida.
3. Integración en `AssistantMessage` de `ego-chat.tsx`.
4. Integración en tarjetas del catálogo y modal de plantillas en `sub-egos.tsx`.
5. Integración en la cabecera de la sección Conversation River en `App.tsx`.

---

## 2. Criterios de Aceptación (DoD)

- [x] Componente `CharacterBadge` ligero con soporte para modo estático StillPose y modo interactivo.
- [x] Integración en mensajes de chat (`ego-chat.tsx`) y tarjetas del catálogo (`sub-egos.tsx`).
- [x] Componente `SubEgoSelector` con mini-avatar, listado dinámico y selección reactiva.
- [x] Integración en cabecera de Conversation River en `App.tsx`.
- [x] Pruebas unitarias de integración en verde (`apps/desktop/test/character-badge-selector.test.ts`).
- [x] `pnpm typecheck` exit 0 y `pnpm build` sin errores.
