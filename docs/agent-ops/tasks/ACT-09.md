---
id: ACT-09
title: "Cliente MCP universal sobre stdio (Nivel B Integración) - McpClient"
status: completed
phase: "Fase 02: Acción & Tool Calling"
priority: P0
component: "@ego/integrations"
assignee: "Ego Engineering & Integrations"
dependencies: ["ACT-01", "ACT-02", "ACT-03"]
origin: "Coucou COUC-10 + Hermes HERM-18"
tags: [mcp, integrations, stdio, json-rpc, tool-discovery, safe-config, level-b]
---

# TASK ACT-09: Cliente MCP universal sobre stdio (Nivel B Integración) - McpClient

## 1. Contexto y Justificación
Conforme a `docs/engineering/integraciones.md`, Ego define un modelo de integraciones en 3 niveles:
- **Nivel A:** Conectores nativos first-party (Filesystem, Git, Terminal - completado en `ACT-04`).
- **Nivel B:** Conectores estándar basados en el protocolo MCP (Model Context Protocol).
- **Nivel C:** Import/Export y Webhooks genéricos HTTP.

El objetivo de `ACT-09` es dotar a Ego de un **Cliente MCP universal de grado de producción** sobre transporte `stdio`:
1. **Transporte JSON-RPC 2.0 sobre `stdio`:** Control de subprocesos locales (`child_process.spawn`) mediante framing delimitado por saltos de línea (`\n`), captura de `stderr` para auditoría y propagación de `AbortSignal`.
2. **Ciclo de Vida Estandarizado:** Handshake `initialize` (protocolVersion `2024-11-05`), `notifications/initialized`, y `shutdown`/`exit` cooperativo.
3. **Descubrimiento Dinámico de Herramientas (`tools/list`):** Lectura del catálogo de herramientas expuesto por el servidor MCP remoto con paginación (`cursor`).
4. **Mapeo al `ToolRegistry` de Ego (`importIntoRegistry`):** Mapeo automático de herramientas MCP a contratos `ToolDefinition` de `@ego/tools`, con clasificación de riesgo heurística (`safe`, `sensitive`, `destructive`) y namespace/prefijo configurable.
5. **Invocación Segura (`tools/call`):** Despacho directo sin turnos de modelo (compuerta `HERM-18`), timeouts por llamada y soporte de cancelación interactiva.
6. **Mutación y Recarga Segura (`SafeConfigMutation`, compuerta `COUC-10`):** Operaciones atómicas de conexión, recarga y reconexión con rollback transaccional ante fallos de inicio.

---

## 2. Blast Radius e Impacto
- **Archivos a crear/modificar:**
  - `packages/integrations/package.json` (Nuevo paquete modular en monorepo `@ego/integrations`)
  - `packages/integrations/tsconfig.json` (Configuración TypeScript de build)
  - `packages/integrations/src/mcp/types.ts` (Tipos formales MCP JSON-RPC 2.0)
  - `packages/integrations/src/mcp/McpClient.ts` (Implementación central de cliente stdio y gestor)
  - `packages/integrations/src/mcp/schema-bridge.ts` (Puente conversor de JSON Schema MCP a Zod)
  - `packages/integrations/src/index.ts` (Punto de entrada exportando McpClient y tipos)
  - `packages/integrations/test/McpClient.test.ts` (Suite de pruebas unitarias exhaustiva con mock stdio server)
  - `docs/roadmap/Backlog.md` (Actualización de estado a completada)
  - `docs/roadmap/roadmap.md` (Actualización de hito en Fase 02: 9/12)

---

## 3. Contrato Técnico Pinned

1. **Configuración de Servidor MCP:**
   ```typescript
   export interface McpServerConfig {
     id: string;
     name: string;
     transport: "stdio";
     command: string;
     args?: string[];
     env?: Record<string, string>;
     cwd?: string;
     toolPrefix?: string;
     timeoutMs?: number;
   }
   ```

2. **Interfaz de McpClient:**
   ```typescript
   export class McpClient {
     public async connect(): Promise<void>;
     public async disconnect(): Promise<void>;
     public async reload(): Promise<void>;
     public async listTools(): Promise<McpToolDefinition[]>;
     public async callTool(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<McpCallToolResult>;
     public importIntoRegistry(registry: ToolRegistry, options?: McpImportOptions): number;
     public getStatus(): "disconnected" | "connecting" | "connected" | "error";
   }
   ```

---

## 4. Pasos de Ejecución
- [x] Paso 1: Configurar el paquete `packages/integrations` (`package.json`, `tsconfig.json`).
- [x] Paso 2: Definir esquemas y tipos JSON-RPC MCP en `packages/integrations/src/mcp/types.ts`.
- [x] Paso 3: Implementar `packages/integrations/src/mcp/schema-bridge.ts` para conversión bidireccional Zod ↔ JSON Schema.
- [x] Paso 4: Implementar `packages/integrations/src/mcp/McpClient.ts` con stdio framing, handshake, listTools, callTool y SafeConfigMutation.
- [x] Paso 5: Exportar módulo público en `packages/integrations/src/index.ts`.
- [x] Paso 6: Crear suite de pruebas unitarias en `packages/integrations/test/McpClient.test.ts`.
- [x] Paso 7: Verificar monorepo (`pnpm test`, `pnpm typecheck`, `pnpm build`).
- [x] Paso 8: Sincronizar Backlog y Roadmap.
- [x] Paso 9: Generar commit semántico en Git y Push.
