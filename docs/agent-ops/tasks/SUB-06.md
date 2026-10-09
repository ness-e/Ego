# Task: SUB-06 — Comunicación y delegación inter-Sub-Ego (DelegationRouter)

> **Fase:** 03 — Multi-Sub-Ego  
> **Estado:** ✅ completed  
> **Fecha:** 2026-10-09  
> **Responsable:** coder / Antigravity  
> **Plan:** `docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md`

---

## 1. Contexto & Propósito

En un Sistema Operativo Cognitivo, las tareas complejas requieren que un Sub-Ego generalista u orquestador delegue subtareas específicas a Sub-Egos especialistas (por ejemplo, el núcleo delega a `ego.code-reviewer` o `ego.researcher`). Sin un router de delegación estructurado:
1. Las llamadas entre agentes pueden incurrir en recursión infinita (ciclos A -> B -> A), provocando agotamiento de memoria y presupuesto.
2. Los payloads de contexto se transferirían ineficientemente en cadenas de texto en vez de usar referencias sobre `SharedMemory`.
3. Podrían producirse escaladas de privilegios no autorizadas si un hijo ejecuta herramientas fuera de su perímetro.

`SUB-06` implementa `DelegationRouter`, el protocolo canónico de delegación jerárquica con call stack, control estricto de profundidad, prevención de ciclos y enlaces causales de auditoría.

---

## 2. Contrato de Interfaz

```typescript
export interface DelegationRequest<TInput = unknown> {
  delegationId?: string;
  projectId: string;
  callerEgoId: string;
  targetEgoId: string;
  task: string;
  input: TInput;
  contextKey?: string;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface DelegationResult<TOutput = unknown> {
  delegationId: string;
  callerEgoId: string;
  targetEgoId: string;
  status: "completed" | "failed" | "timed_out";
  output?: TOutput;
  error?: string;
  sharedContextKey?: string;
  depth: number;
  durationMs: number;
  callChain: string[];
}
```

---

## 3. Criterios de Aceptación (DoD)

- [x] `DelegationRouter` gestiona la invocación jerárquica entre Sub-Egos.
- [x] Límite de profundidad configurable (`maxDepth = 3` por defecto) lanza `DelegationMaxDepthError` si se supera.
- [x] Detección estricta de ciclos (A -> B -> A o auto-delegación A -> A) lanzando `DelegationCycleError`.
- [x] Validación de permisos en `callerManifest.permissions` (admite `"delegate:*"` o `"delegate:<targetId>"`).
- [x] Integración con `SharedMemory` para intercambio eficiente de payloads por referencia bajo `projects/<proj>/shared/*`.
- [x] Trazabilidad de call stack y duración en `DelegationResult`.
- [x] Suite de pruebas unitarias `packages/subegos/test/DelegationRouter.test.ts` pasando al 100% (13 tests passing).
- [x] Cero errores de compilación con `pnpm typecheck`.
