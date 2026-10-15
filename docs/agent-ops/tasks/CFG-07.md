# CFG-07 — MCP approval por-tool + toolsets por perfil
- **Estado:** ✅ COMPLETED
- **Plan:** docs/agent-ops/plans/2026-10-16-plan-configs-revision-total.md
- **Fecha:** 2026-10-16
- **Archivos clave:** `apps/desktop/src/ipc/schema.ts` (sección MCP) · `packages/tools/src/toolsets.ts` · `packages/tools/src/index.ts` · `packages/tools/test/toolsets-cfg07.test.ts`

## Blast Radius
Callers: nuevos (`resolveMcpToolDecision/resolveApprovalWithMcpOverride/isToolEnabledByToolsets/filterToolsByToolsets/cloneRegistryForProfile/buildToolsResetDoc`, sin callers previos) · schemas nuevos (sin handlers aún). Callees: `ToolRegistry.list` + constructor (reuso), stdlib, zod. Sin impacto en ModelConfig/profiles/permissions (schemas intactos), ModelRouter, memoria, renderer, docs-sitio.

## Contrato
"Tool bloqueada pide aprobación en test + typecheck desktop y tools."

## Steps de ejecución
- [x] Step 1: schemas CFG-07 en `schema.ts` sección MCP (`McpToolsetNameSchema` 8 toolsets, `McpToolDecisionSchema` allow/ask/deny, `McpToolApprovalRuleSchema` match exacto server+tool, `McpToolApprovalsSchema`, `ProfileToolsetsSchema`, `McpToolsResetDocSchema` con `preservePromptCaching` default true)
- [x] Step 2: módulo puro `packages/tools/src/toolsets.ts` (matchers declarativos, deny-gana, `enabled: []` = sin allowlist, `cloneRegistryForProfile`, `buildToolsResetDoc` fail-closed) + export en `index.ts`
- [x] Step 3: test `toolsets-cfg07.test.ts` (8 tests: deny bloquea safe, allow exime, deny-gana, toolsets enable/disable, clon aislado, reset doc con prompt caching, paridad schemas IPC)
- [x] Step 4: verificación mecánica + sincronización plan/task

## Registro de Cumplimiento / Veredicto
- **Estado:** ✅ COMPLETED
- **Evidencia:** `npx vitest run` en `packages/tools`: 10 files / 60 tests passed (8 nuevos CFG-07) · `npx tsc -p tsconfig.json --noEmit` en `packages/tools`: 0 errores · `npx tsc -p tsconfig.json --noEmit` en `apps/desktop`: 0 errores
- **Deuda:** handlers `ipc.mcp.*` para `McpToolApprovals/ProfileToolsets` en main (validación Zod + enforcement + persistencia VantaDB `gov/settings/mcp_tools`) = trabajo futuro fuera de alcance; wiring `shouldRequireApproval` (CFG-06) con `resolveMcpToolDecision` pendiente de ese handler. Sin `pnpm install` (no requerido).
- **last-synced:** 2026-10-16
