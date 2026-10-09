---
id: ACT-06
title: "Sistema de Aprobación de Acciones Sensibles (HITL / ApprovalEngine)"
status: completed
phase: "Fase 02: Acción & Tool Calling"
priority: P0
component: "@ego/execution"
assignee: "Ego Nucleus Engine"
dependencies: ["ACT-01", "ACT-02", "ACT-03", "ACT-04", "ACT-05"]
origin: "Coucou COUC-03 + COUC-04 + Career-Ops CARP-04 + Hermes HERM-03"
tags: [governance, hitl, approval, action-identity, security, execution]
---

# TASK ACT-06: Sistema de Aprobación de Acciones Sensibles (HITL / ApprovalEngine)

## 1. Contexto y Justificación
El Principio Innegociable 6 de Ego estipula: *"Gobernanza, permisos y aprobación de acciones sensibles: Interceptor obligatorio: escrituras fuera de sandbox, borrado de archivos, ejecución de comandos bash o peticiones externas quedan congeladas hasta confirmación humana"*.

Esta tarea implementa el **`ApprovalEngine`**, un motor de gobernanza e intercepción previa a la ejecución física de herramientas que implementa:
1. **Identidad Causal Exacta (`ActionIdentity`, compuerta `COUC-03`):** Hash criptográfico SHA-256 de parámetros canónicos ordenados, sesión, actor y llamada. Una aprobación emitida por el usuario sólo puede resolver exactamente la acción para la que fue autorizada.
2. **Human-in-the-Loop (HITL) Interactivo con ACK en el borde (compuerta `COUC-04`):** Retención asíncrona de la promesa de ejecución hasta recibir la decisión explícita del usuario (`approved`, `rejected`, `modifiedArguments`) o timeout de seguridad.
3. **Desinfección de Payloads Untrusted (compuerta `CARP-04`):** Validación estricta con Zod ante argumentos modificados en la aprobación.
4. **Políticas Configurables de Gobernanza:** Modos `strict`, `standard` y reglas por categoría de riesgo (`safe`, `sensitive`, `destructive`).
5. **Auditoría Inmutable en VantaDB:** Persistencia de solicitudes y resoluciones en `gov/audit`.

---

## 2. Blast Radius e Impacto
- **Archivos creados/modificados:**
  - `packages/execution/src/ApprovalEngine.ts` (Nuevo motor de gobernanza y retención HITL)
  - `packages/execution/src/types.ts` (Tipos e interfaces `ActionIdentity`, `ApprovalPolicy`, `PendingApproval`)
  - `packages/execution/src/index.ts` (Exportación pública)
  - `packages/execution/test/ApprovalEngine.test.ts` (Suite de 14 pruebas unitarias)
  - `packages/runtime/src/ToolExecutionLoop.ts` (Integración de `ApprovalEngine` como proveedor HITL)
  - `packages/runtime/test/ToolExecutionLoop.test.ts` (Prueba de integración end-to-end con congelación y reanudación)
  - `docs/roadmap/Backlog.md` (Actualización de estado a completada)
  - `docs/roadmap/roadmap.md` (Actualización de conteo de Fase 02: 6/12)
- **Componentes aguas abajo:**
  - `apps/desktop/renderer/components/tools/` (`ACT-07`: Componente interactivo de Aprobación en Chat UI)
  - `ToolExecutionLoop` (Reanudación o rechazo transparente post-aprobación)

---

## 3. Contrato Técnico Pinned

1. **`ActionIdentity`:**
   ```typescript
   export interface ActionIdentity {
     sessionId: string;
     subEgoId: string;
     toolName: string;
     callId: string;
     inputDigest: string; // SHA-256 de claves ordenadas
     createdAt: number;
   }
   ```

2. **`ApprovalEngine`:**
   - `evaluateRequirement(tool, args, context): { required: boolean; reason?: string }`
   - `requestApproval(request, options): Promise<ApprovalDecision>`
   - `resolveApproval(approvalId, decision, options): boolean`
   - `listPendingApprovals(): PendingApproval[]`
   - `cancelApproval(approvalId, reason): boolean`

3. **Invariantes:**
   - Una aprobación no puede ser resuelta dos veces.
   - Si expira el timeout (por defecto 120s), se cancela deterministamente con estado `timed_out`.
   - Si se especifica `expectedDigest`, una resolución con digest discordante es rechazada con error.

---

## 4. Pasos de Ejecución
- [x] Paso 1: Definir tipos y esquemas en `packages/execution/src/types.ts`.
- [x] Paso 2: Implementar `packages/execution/src/ApprovalEngine.ts` con hashing canónico y promesas retenidas.
- [x] Paso 3: Exportar en `packages/execution/src/index.ts`.
- [x] Paso 4: Implementar suite de pruebas en `packages/execution/test/ApprovalEngine.test.ts` (14/14 tests pasando).
- [x] Paso 5: Conectar e integrar con `ToolExecutionLoop` en `packages/runtime`.
- [x] Paso 6: Ejecutar verificación automatizada (`pnpm test` [92/92 tests pasando], `pnpm typecheck` [0 errores], `pnpm build` [éxito]).
- [x] Paso 7: Sincronizar Backlog y Roadmap.
- [x] Paso 8: Generar commit semántico en Git.
