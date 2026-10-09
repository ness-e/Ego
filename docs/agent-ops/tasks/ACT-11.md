---
id: ACT-11
title: "Gestor y Marketplace Local de MCP Servers y Skills a Elección"
status: completed
phase: "Fase 02: Acción & Tool Calling"
priority: P0
component: "@ego/desktop, @ego/integrations"
assignee: "Ego Engineering & Desktop"
dependencies: ["ACT-01", "ACT-09"]
origin: "Hermes HERM-19 + Coucou COUC-10"
tags: [mcp, marketplace, skills, ast-linter, safe-config, desktop-ui, ipc]
---

# TASK ACT-11: Gestor y Marketplace Local de MCP Servers y Skills a Elección

## 1. Contexto y Justificación
Conforme a `docs/engineering/integraciones.md`, Ego opera como un orquestador cognitivo universal (Nivel B MCP). Para empoderar al usuario sovereign en P0-Alpha, Ego debe proporcionar una interfaz y runtime local para:
1. **Configuración de Servidores MCP:** Alta, baja, edición y conmutación en caliente (toggle on/off con `SafeConfigMutation` / `COUC-10`) de servidores MCP locales basados en `stdio` (y extensibles a SSE).
2. **Marketplace & Catálogo de Herramientas:** Exploración granular de herramientas descubiertas por servidores MCP conectados y conectores nativos Nivel A, con visibilidad de esquema JSON, prefijos de Sub-Ego y clasificación de riesgo (`safe`, `sensitive`, `destructive`).
3. **Gestor de Skills Locales con Linter AST (`HERM-19`):** Detección de carpetas de Skills personalizadas (`.ego/skills/`, `~/.ego/skills/`), con inspección sintáctica y análisis de seguridad estático para evitar inyecciones de código y accesos no autorizados antes de su registro.
4. **IPC Seguro en Electron:** Exposición desacoplada y validada mediante esquemas Zod en `apps/desktop/src/ipc/schema.ts`, manteniendo el principio de `contextIsolation` y seguridad de Electron.

---

## 2. Blast Radius e Impacto
- **Módulos y archivos involucrados:**
  - `packages/integrations/src/skills/SkillLinter.ts` (Linter sintáctico y de seguridad AST según HERM-19)
  - `packages/integrations/src/skills/SkillScanner.ts` (Escáner de skills en disco local)
  - `packages/integrations/src/mcp/McpManager.ts` (Gestor multicliente MCP con SafeConfigMutation COUC-10 y registro dinámico)
  - `packages/integrations/src/index.ts` (Exportaciones canónicas de @ego/integrations)
  - `packages/integrations/test/SkillLinter.test.ts` (Pruebas unitarias de linter AST de skills)
  - `packages/integrations/test/McpManager.test.ts` (Pruebas unitarias de orquestación de servidores MCP)
  - `apps/desktop/src/ipc/schema.ts` (Esquemas Zod para MCP y Skills)
  - `apps/desktop/src/preload.ts` (Puente seguro window.ego.mcp y window.ego.skills)
  - `apps/desktop/src/main.ts` (Handlers IPC en Electron main conectando McpManager y VantaDB)
  - `apps/desktop/renderer/components/mcp/McpManagerModal.tsx` (Componente visual unificado del gestor y catálogo)
  - `apps/desktop/renderer/components/sidebar.tsx` (Integración de acceso en la barra de navegación)
  - `apps/desktop/test/mcp-ipc.test.ts` (Pruebas de esquemas y contratos IPC de MCP)
  - `docs/roadmap/Backlog.md` y `docs/roadmap/roadmap.md` (Sincronización de progreso al completar)

---

## 3. Contratos Técnicos Pinned

### 3.1. Auditoría AST y Linter de Skills (`HERM-19`)
```typescript
export interface SkillLintResult {
  valid: boolean;
  securityLevel: "safe" | "warning" | "dangerous";
  errors: string[];
  warnings: string[];
  metadata: {
    name: string;
    description: string;
    version?: string;
    author?: string;
    declaredTools?: string[];
    requiredPermissions?: string[];
  };
}
```

### 3.2. Estado del Servidor MCP (`COUC-10`)
```typescript
export interface McpServerRuntimeState {
  id: string;
  config: McpServerConfig;
  status: "disconnected" | "connecting" | "connected" | "error";
  enabled: boolean;
  toolsCount: number;
  lastError?: string;
}
```

---

## 4. Pasos de Ejecución
- [x] Paso 1: Implementar `SkillLinter.ts` y `SkillScanner.ts` en `packages/integrations/src/skills/` (Compuerta `HERM-19`).
- [x] Paso 2: Implementar `McpManager.ts` en `packages/integrations/src/mcp/` con `SafeConfigMutation` (Compuerta `COUC-10`).
- [x] Paso 3: Exportar nuevas APIs en `packages/integrations/src/index.ts` y crear tests unitarios en `packages/integrations/test/`.
- [x] Paso 4: Añadir esquemas Zod en `apps/desktop/src/ipc/schema.ts` y cablear canales en `apps/desktop/src/preload.ts`.
- [x] Paso 5: Implementar handlers IPC en `apps/desktop/src/main.ts` con persistencia en VantaDB.
- [x] Paso 6: Construir componentes de UI en `apps/desktop/renderer/components/mcp/` e integrar en `sidebar.tsx`.
- [x] Paso 7: Crear suite de tests de IPC en `apps/desktop/test/mcp-ipc.test.ts`.
- [x] Paso 8: Ejecutar verificación monorepo (`pnpm test`, `pnpm typecheck`, `pnpm build`).
- [x] Paso 9: Sincronizar Backlog, Roadmap y marcar compuertas `HERM-19` y `COUC-10`.
- [x] Paso 10: Generar commit semántico en Git y Push.

## Registro de Cumplimiento (2026-10-09)
- **Estado:** ✅ COMPLETED
- **Timestamp:** 2026-10-09T16:57:37.879Z
- **Evidencia:** Verificación mecánica aprobada
- **Commit:** Transacción local
