---
id: SUB-01
title: "Contrato y esquema formal SubEgoManifest tipado con Zod"
status: completed
phase: "Fase 03: Sub-Egos"
priority: P0
component: "@ego/subegos"
assignee: "Ego Engineering & Sub-Ego Core"
dependencies: ["CORE-01", "DSEK-03", "HERM-12"]
origin: "Coucou COUC-01 + DeepSeek DSEK-03"
tags: [subegos, manifest, schema, zod, contracts, phase-03]
---

# TASK SUB-01: Contrato y esquema formal `SubEgoManifest` tipado con Zod

## 1. Contexto y Justificación
Conforme a `docs/architecture/agentes.md` y los 10 Principios Innegociables de Ego (§4 Sub-Egos especializados y personalizables), la Fase 03 inaugura el paradigma multi-Sub-Ego:
1. **Contrato Estricto:** Cada especialista cognitivo es una entidad de primera clase visible para el usuario, gobernada por un manifiesto inmutable y declarativo (`SubEgoManifest`).
2. **Identificadores Opacos y Estables (DSEK-03):** Cada Sub-Ego posee un `id` canónico inmutable con prefijo canónico (`ego.<slug>` o `sub_<hash>`) para evitar colisiones de rutas y que el renombre de un especialista no rompa referencias de memoria histórica.
3. **Validación en Tiempo de Ejecución:** El manifiesto debe validarse exhaustivamente con esquemas Zod en todas las capas del sistema (persistencia VantaDB, IPC bridge, importación de plantillas y fábricas).
4. **Campos Canónicos de Gobernanza y Especialización:**
   - Identidad y rol: `id`, `name`, `role`, `description`, `systemPrompt`.
   - Capacidades y herramientas: `responsibilities`, `capabilities`, `tools`, `permissions`.
   - Alcance de memoria y seguridad: `memoryScope` (`namespaces.read`, `namespaces.write`).
   - Comportamiento y tono: `behavior` (tono, proactividad, verbosidad) y `autonomy` (supervised, semi-autonomous, autonomous).
   - Presupuesto: `budget` (tokens y costo máximo diario en USD con corte HITL).
   - Alma y valores: `soul` (referencia o configuración de identidad de SubEgoSoul).
   - Ciclo de vida: `state` (active, paused, archived), `creator` y timestamps.

---

## 2. Blast Radius e Impacto
- **Archivos a crear/modificar:**
  - `packages/subegos/package.json` (Creación del workspace `@ego/subegos`)
  - `packages/subegos/tsconfig.json` (Configuración TypeScript de `@ego/subegos`)
  - `packages/subegos/src/types.ts` (Definición tipada e interfaces de TypeScript)
  - `packages/subegos/src/SubEgoManifest.ts` (Esquemas Zod, funciones de validación y fábrica por defecto)
  - `packages/subegos/src/index.ts` (Exportación pública del paquete)
  - `packages/subegos/test/SubEgoManifest.test.ts` (Suite de pruebas unitarias exhaustivas con Vitest)
  - `docs/roadmap/Backlog.md` y `docs/agent-ops/state/pipeline-state.json` (Sincronización de avance canónico)

---

## 3. Contratos Técnicos Pinned

### 3.1. Campos Canónicos de `SubEgoManifest`
```typescript
export interface SubEgoManifest {
  id: string; // ej. "ego.code-reviewer"
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  responsibilities: string[];
  capabilities: string[];
  tools: string[];
  permissions: string[];
  memoryScope: {
    read: string[];
    write: string[];
  };
  behavior: {
    tone: "formal" | "neutral" | "casual" | "analytical";
    proactivity: "reactive" | "moderate" | "high";
    verbosity: "concise" | "balanced" | "exhaustive";
  };
  autonomy: "supervised" | "semi-autonomous" | "autonomous";
  budget: {
    maxTokensPerCall: number;
    maxDailyCostUsd: number;
    requiresApprovalAboveUsd: number;
  };
  soul?: {
    identitySummary: string;
    coreValues: string[];
  };
  state: "active" | "paused" | "archived";
  creator: "user" | "ego-nucleus" | "template";
  createdAtMs: number;
  updatedAtMs: number;
}
```

---

## 4. Pasos de Ejecución
- [x] Paso 1: Crear configuración del nuevo workspace `packages/subegos/package.json` y `tsconfig.json`.
- [x] Paso 2: Implementar tipos e interfaces en `packages/subegos/src/types.ts`.
- [x] Paso 3: Implementar esquemas Zod y utilidades de validación en `packages/subegos/src/SubEgoManifest.ts`.
- [x] Paso 4: Exportar API en `packages/subegos/src/index.ts`.
- [x] Paso 5: Ejecutar `pnpm install` para enlazar el workspace `@ego/subegos`.
- [x] Paso 6: Crear suite de pruebas unitarias en `packages/subegos/test/SubEgoManifest.test.ts`.
- [x] Paso 7: Ejecutar pruebas unitarias y typecheck (`pnpm --filter @ego/subegos test`).
- [x] Paso 8: Ejecutar verificación exhaustiva del monorepo (`pnpm test`, `pnpm typecheck`, `pnpm build`).
- [x] Paso 9: Actualizar Backlog y Task File a estado completado.
- [x] Paso 10: Generar commit semántico en Git y Push a master.

## Registro de Cumplimiento (2026-10-09)
- **Estado:** ✅ COMPLETED
- **Timestamp:** 2026-10-09T17:43:29.363Z
- **Evidencia:** Verificación mecánica aprobada
- **Commit:** Transacción local