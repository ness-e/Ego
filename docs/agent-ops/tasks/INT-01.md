# Task: INT-01 — Cableado del Fast-Path ToolExecutionLoop en main.ts

> **Fase:** 03.1 — MVP Convergence & System Integration  
> **Estado:** ✅ completed  
> **Fecha:** 2026-10-09  
> **Responsable:** coder / Antigravity  
> **Plan:** `docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md`

---

## 1. Contexto & Propósito

En `apps/desktop/src/main.ts`, el canal `ipc.llm.stream` puenteaba directamente a `modelRouter.streamText()`, omitiendo el `ToolExecutionLoop` de `@ego/runtime`. Como consecuencia, las herramientas nativas de Nivel A (`fs_read_file`, `fs_write_file`, `git_status`, `terminal_exec`) y las herramientas de servidores MCP nunca se ejecutaban cuando el modelo las solicitaba durante el chat de escritorio.

`INT-01` resuelve esta brecha crítica P0.2 conectando `ToolExecutionLoop`, `registerNativeTools`, `ExecutionManager`, `ApprovalEngine` y `EventBus` al canal de chat de Electron main, retransmitiendo deltas, llamadas a herramientas y resultados en tiempo real al renderer.

---

## 2. Criterios de Aceptación (DoD)

- [x] `main.ts` inicializa `registerNativeTools(toolRegistry)` en el arranque.
- [x] `main.ts` utiliza `ToolExecutionLoop` en el handler `ipc.llm.stream`.
- [x] Cuando el modelo emite texto, se retransmite a la UI vía `ipc.chat.delta`.
- [x] Cuando el modelo solicita una herramienta, `ToolExecutionLoop` la ejecuta con control de timeout, cuota y aprobación HITL.
- [x] Eventos de ejecución (`task.started`, `tool.started`, `tool.executed`, `task.completed`) se difunden por `eventBus` e IPC.
- [x] Suite de pruebas de integración `apps/desktop/test/ipc-tool-loop.test.ts` pasando al 100% (5 tests passing).
- [x] Compilación TypeScript limpia (`pnpm typecheck` exit 0).
