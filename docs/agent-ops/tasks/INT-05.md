# Task: INT-05 — Tarjetas de Aprobación HITL Interactivas en el Chat

> **Fase:** 03.1 — MVP Convergence & System Integration  
> **Estado:** ✅ completed  
> **Fecha:** 2026-10-09  
> **Responsable:** coder / Antigravity  
> **Plan:** `docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md`

---

## 1. Contexto & Propósito

El Principio Innegociable §6 (Gobernanza y Aprobaciones) estipula que las acciones sensibles (como escribir o modificar archivos del sistema, ejecutar comandos en la terminal o realizar operaciones con impacto externo) no pueden ejecutarse de manera autónoma sin consentimiento humano explícito si la política lo exige.
Actualmente, el backend de Electron cuenta con `ApprovalEngine` (`packages/execution`) y expone los canales IPC `ipc.approval.request` e `ipc.approval.resolve`.

`INT-05` implementa el componente `ActionApprovalCard.tsx` en `apps/desktop/renderer/components/ActionApprovalCard.tsx` (re-exportando y tipando la superficie canónica de `ApprovalCard.tsx`), lo integra en el flujo de conversación de `ego-chat.tsx`, y conecta la respuesta interactiva con el canal IPC `ego().resolveApproval(approvalId, decision)` para desbloquear o cancelar de inmediato la ejecución de la herramienta en vivo.

---

## 2. Criterios de Aceptación (DoD)

- [x] Componente `ActionApprovalCard.tsx` en `apps/desktop/renderer/components/`:
  - Renderiza el ID de la solicitud, la acción solicitada (`action`), los parámetros (ej. comando de terminal, ruta de archivo) y la justificación o nivel de riesgo.
  - Botones claros y accesibles: "Aprobar acción" (color de acento) y "Denegar" (neutral/destructivo).
  - Estado visual de procesamiento y feedback tras la resolución (Aprobada / Rechazada / Expirada).
- [x] Integración en `apps/desktop/renderer/components/ego-chat.tsx`:
  - Escucha de eventos `onApprovalRequest` desde Electron Main.
  - Renderizado inline dentro de la conversación como una tarjeta de gobernanza.
  - Llamada a `ego().resolveApproval({ approvalId, approved, reason, modifiedArguments })` al interactuar el usuario.
- [x] Soporte de expiración / timeout visual sincronizado con el backend.
- [x] Pruebas unitarias y de integración de gobernanza HITL pasando (`packages/runtime/test/tools-execution.test.ts`, `apps/desktop/test/ipc-tool-loop.test.ts`).
- [x] `pnpm typecheck` exit 0 y `pnpm test` exit 0.
