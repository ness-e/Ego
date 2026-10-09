---
id: ACT-08
title: "Manejo de errores y reintentos con contexto causal (ErrorHandler)"
status: completed
phase: "Fase 02: Acción & Tool Calling"
priority: P0
component: "@ego/runtime"
assignee: "Ego Runtime & Engineering"
dependencies: ["ACT-01", "ACT-02", "ACT-03"]
origin: "OpenClaw OCLW-03 + OpenClaw OCLW-04"
tags: [runtime, error-handling, causal-context, tool-repair, auto-healing, anti-loop]
---

# TASK ACT-08: Manejo de errores y reintentos con contexto causal (ErrorHandler)

## 1. Contexto y Justificación
En un Sistema Operativo Cognitivo, cuando un modelo de lenguaje interactúa con el sistema operativo y el sistema de archivos a través de herramientas locales, los fallos son inevitables:
- Modelos locales (Ollama/Llama 3/Mistral) producen JSONs truncados, cadenas con comillas simples o strings numéricos (`"42"` en vez de `42`).
- Rutas no encontradas (`ENOENT`), permisos restringidos (`EACCES`), procesos interrumpidos o timeouts.
- Bucles ciegos donde el modelo reintenta la misma llamada errónea sucesivamente consumiendo tokens sin avanzar.

Conforme a las compuertas de extracción de **OpenClaw**:
- **`OCLW-03`:** Auto-reparación en vuelo de llamadas a tools malformadas (reparación sintáctica heurística de JSON antes de fallar).
- **`OCLW-04`:** Normalización y coerción estricta de argumentos previo a validación con Zod.

`ACT-08` introduce `ErrorHandler` en `@ego/runtime`, proporcionando:
1. **Auto-Reparación Sintáctica en Vuelo (`ToolCallRepairer`):** Coerción de tipos primitivos (string a number, boolean, parseo de JSON anidado, saneamiento de comillas y trailing commas).
2. **Clasificación Causal de Errores (`CausalErrorCategory`):** Taxonomía formal (`TOOL_NOT_FOUND`, `VALIDATION_FAILED`, `FILE_NOT_FOUND`, `PERMISSION_DENIED`, `EXECUTION_TIMEOUT`, `PROCESS_FAILED`, `LOOP_DETECTED`, `UNKNOWN_ERROR`).
3. **Enriquecimiento de Contexto con Pistas de Autocorrección (`remedyHint`):** Formateo estructurado para inyectar al modelo mensajes de sistema o respuestas de tools que explican qué falló y sugieren cómo solucionarlo.
4. **Protección Anti-Bucle Ciego (`LoopGuard`):** Hash determinista de llamadas consecutivas para frenar reintentos idénticos estériles y forzar escalación o replanteamiento de estrategia.

---

## 2. Blast Radius e Impacto
- **Archivos a crear/modificar:**
  - `packages/runtime/src/ErrorHandler.ts` (Nuevo motor de manejo causal y auto-reparación)
  - `packages/runtime/src/types.ts` (Nuevos tipos de error causal y opciones de reparación)
  - `packages/runtime/src/ToolExecutionLoop.ts` (Integración de `ErrorHandler` en el loop multi-turno)
  - `packages/runtime/src/index.ts` (Exportación pública de tipos y clase)
  - `packages/runtime/test/ErrorHandler.test.ts` (Suite de pruebas unitarias exhaustiva)
  - `docs/roadmap/Backlog.md` (Actualización de estado a completada)
  - `docs/roadmap/roadmap.md` (Actualización de hito en Fase 02: 8/12)

---

## 3. Contrato Técnico Pinned

1. **Taxonomía Causal:**
   ```typescript
   export type CausalErrorCategory =
     | "TOOL_NOT_FOUND"
     | "VALIDATION_FAILED"
     | "REPAIRABLE_SYNTAX_ERROR"
     | "FILE_NOT_FOUND"
     | "PERMISSION_DENIED"
     | "EXECUTION_TIMEOUT"
     | "PROCESS_FAILED"
     | "LOOP_DETECTED"
     | "UNKNOWN_ERROR";
   ```

2. **Estructura de Error Causal Enriquecido:**
   ```typescript
   export interface EnrichedCausalError {
     status: "error";
     category: CausalErrorCategory;
     toolName: string;
     callId: string;
     message: string;
     remedyHint: string;
     validationDetails?: Array<{ path: string; message: string; expected?: string; received?: string }>;
     suggestedTools?: string[];
     isLoopRisk?: boolean;
     rawError?: string;
   }
   ```

---

## 4. Pasos de Ejecución
- [x] Paso 1: Crear tipos causales y contratos en `packages/runtime/src/types.ts`.
- [x] Paso 2: Implementar `packages/runtime/src/ErrorHandler.ts` con auto-reparación, clasificación causal y loop guard.
- [x] Paso 3: Integrar `ErrorHandler` en `packages/runtime/src/ToolExecutionLoop.ts`.
- [x] Paso 4: Exportar en `packages/runtime/src/index.ts`.
- [x] Paso 5: Crear suite completa de pruebas unitarias en `packages/runtime/test/ErrorHandler.test.ts`.
- [x] Paso 6: Verificar monorepo (`pnpm test`, `pnpm typecheck`, `pnpm build`).
- [x] Paso 7: Sincronizar Backlog y Roadmap.
- [x] Paso 8: Generar commit semántico en Git y Push.
