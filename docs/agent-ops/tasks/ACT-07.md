---
id: ACT-07
title: "Componente interactivo de Aprobación en Chat UI (ApprovalCard)"
status: completed
phase: "Fase 02: Acción & Tool Calling"
priority: P0
component: "@ego/renderer"
assignee: "Ego Frontend & Runtime"
dependencies: ["ACT-06"]
origin: "Hermes HERM-03 + Coucou COUC-04 + OpenClaw OCLW-08"
tags: [ui, chat, approval, hitl, diff-preview, assistant-ui]
---

# TASK ACT-07: Componente interactivo de Aprobación en Chat UI (ApprovalCard)

## 1. Contexto y Justificación
`ACT-06` implementó en el backend el motor de gobernanza `ApprovalEngine`, el cual retiene de manera asíncrona la ejecución de herramientas sensibles o destructivas hasta recibir confirmación humana (HITL).

Para que el usuario pueda ejercer esta supervisión de forma intuitiva, ergonómica y segura en la aplicación de escritorio, se requiere una superficie interactiva en el Chat UI:
1. **Tarjeta Interactiva Inline (`ApprovalCard`, compuerta `HERM-03`):** Componente visual en el chat que despliega la solicitud pendiente con badges de riesgo (`destructive`, `sensitive`), nombre de la tool y argumentos.
2. **Previsualización de Acciones y Diffs (`diff_preview`, compuerta `OCLW-08`):** Inspección de comandos de terminal antes de correrlos, y diffs de contenido para escrituras en disco.
3. **Control Total Humano (compuerta `COUC-04`):** Acciones explícitas de `Aprobar`, `Rechazar` y `Editar Parámetros` (modificación inline de JSON antes de autorizar).
4. **Canal IPC Bidireccional:** Puente en preload (`onApprovalRequest` / `resolveApproval`) conectando reactivamente el `ApprovalEngine` del Main Process con el Renderer.

---

## 2. Blast Radius e Impacto
- **Archivos a crear/modificar:**
  - `apps/desktop/renderer/components/tools/ApprovalCard.tsx` (Nuevo componente visual interactivo)
  - `apps/desktop/renderer/lib/ego.ts` (Tipos `PendingApprovalInfo` y métodos en `EgoBridge`)
  - `apps/desktop/renderer/components/ego-chat.tsx` (Suscripción y renderizado de tarjetas en Chat)
  - `apps/desktop/src/preload.ts` (Exposición segura en contextBridge)
  - `apps/desktop/src/ipc/schema.ts` (Esquemas de validación Zod)
  - `apps/desktop/src/main.ts` (Handlers `ipc.approval.resolve` e integración con `ApprovalEngine`)
  - `apps/desktop/test/ipc.test.ts` (Pruebas unitarias de IPC para resolución de aprobaciones)
  - `docs/roadmap/Backlog.md` (Actualización de estado a completada)
  - `docs/roadmap/roadmap.md` (Actualización de métricas de Fase 02: 7/12)

---

## 3. Contrato Técnico Pinned

1. **Interfaz `PendingApprovalInfo`:**
   ```typescript
   export interface PendingApprovalInfo {
     approvalId: string;
     action: {
       sessionId: string;
       subEgoId: string;
       toolName: string;
       callId: string;
       inputDigest: string;
       createdAt: number;
     };
     toolName: string;
     toolCategory: string;
     riskLevel: "safe" | "sensitive" | "destructive";
     arguments: Record<string, unknown>;
     status: "pending" | "approved" | "rejected" | "timed_out" | "aborted";
     createdAt: number;
     expiresAt: number;
   }
   ```

2. **Acciones del Usuario:**
   - `onApprove(approvalId)`: envía `{ approved: true }`.
   - `onReject(approvalId, reason)`: envía `{ approved: false, reason }`.
   - `onApproveModified(approvalId, modifiedArgs)`: envía `{ approved: true, modifiedArguments }`.

---

## 4. Pasos de Ejecución
- [x] Paso 1: Definir esquemas en `apps/desktop/src/ipc/schema.ts`.
- [x] Paso 2: Actualizar `apps/desktop/src/preload.ts` y `apps/desktop/renderer/lib/ego.ts`.
- [x] Paso 3: Implementar componente `ApprovalCard.tsx` con diff y edición de parámetros.
- [x] Paso 4: Integrar en `EgoChat.tsx` y conectar handlers en `apps/desktop/src/main.ts`.
- [x] Paso 5: Agregar pruebas unitarias en `apps/desktop/test/ipc.test.ts`.
- [x] Paso 6: Verificar monorepo (`pnpm test`, `pnpm typecheck`, `pnpm build`).
- [x] Paso 7: Sincronizar Backlog y Roadmap.
- [x] Paso 8: Generar commit semántico en Git.
