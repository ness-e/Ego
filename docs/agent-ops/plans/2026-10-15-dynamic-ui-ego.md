# Dynamic UI Applicable to Ego Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aplicar solo lo necesario del informe AG-UI/A2UI/charts/iframe a Ego sin duplicar Fase 04 ya completada.

**Architecture:** Mantener Modelo A declarativo (CanvasBridge + Zod + registry React nativo). Añadir adapter fino A2UI→CanvasBridge en main/runtime, fix pie en ChartView, plantilla daily-report como LayoutTemplate, y SPEC de iframe como descarte documentado. Cero ejecución de código del LLM en renderer.

**Tech Stack:** TypeScript strict, Zod, React 19, Recharts 2.15.1 existente (lazy), IPC tipado preload, VantaDB solo vía EgoMemoryAdapter en main.

---

## Contexto verificado (no asumir)

- `packages/ui-runtime/src/schemas/components.ts:105-113` ChartPropsSchema permite `line|bar|pie|area`.
- `apps/desktop/renderer/components/canvas/ChartView.tsx:82-169` solo renderiza `bar` y `line|area`. `pie` cae a SVG vacío con ejes. Bug real.
- `apps/desktop/renderer/components/domains/DomainCharts.tsx:20-51` usa Recharts AreaChart lazy. `apps/desktop/renderer/package.json:29` ya depende de `recharts ^2.15.1`. No añadir Tremor/Nivo/ECharts/Vega en P0.
- `packages/ui-runtime/src/CanvasBridge.ts:63-273` es bus interno (inject/remove/applyChangeSet/dispatchAction). No hay compatibilidad wire AG-UI/A2UI ni streaming JSONL.
- `apps/desktop/src/ipc/schema.ts` no tiene canal canvas; transporte actual es `ipc.llm.*` + `ipc.approval.*`. No romper.
- Guardrails `apps/desktop/AGENTS.md`: renderer sin VantaDB, sin lógica negocio, solo IPC tipado, `contextIsolation/sandbox/nodeIntegration=false` no negociables.

### Decisión: qué se Asimila / Adapta / Descarta

- Asimila: Modelo A declarativo (ya es CANV-01/02), Recharts lazy existente, PayloadRef COUC-08 para datos pesados.
- Adapta: Adapter A2UI mínimo (pure function, sin Hashbrown), schema resuelto para planner, pie SVG mínimo, template daily-report.
- Descarta con justificación (P0): runtime iframe 3-capas + MCP Apps host (`allow-scripts allow-same-origin` viola least-privilege; nueva superficie prompt-injection/clickjacking/foco; SEC-01..09 ya DONE). Solo SPEC.

---

### Task 1: Fix Chart pie en ChartView custom SVG

**Files:**
- Modify: `apps/desktop/renderer/components/canvas/ChartView.tsx:22-174`
- Test: `apps/desktop/renderer/components/canvas/ChartView.test.tsx` (nuevo, vitest + testing-library si existe; si no, test de función pura `pieSlices` extraída)
- Test existente: `packages/ui-runtime/test/schemas.test.ts:126-145` (no tocar, solo referencia)

**Step 1: Write the failing test**

```tsx
// apps/desktop/renderer/components/canvas/ChartView.test.tsx
import { describe, it, expect } from "vitest";
import { computePieSlices } from "./ChartView.js";

describe("ChartView pie", () => {
  it("reparte 100 en dos slices 50/50", () => {
    const slices = computePieSlices(
      [{ k: "a", v: 50 }, { k: "b", v: 50 }],
      "k",
      ["v"]
    );
    expect(slices).toHaveLength(2);
    expect(slices[0].fraction).toBeCloseTo(0.5);
  });
  it("datos vacíos o ceros no crashean", () => {
    expect(computePieSlices([], "k", ["v"])).toEqual([]);
    expect(computePieSlices([{ k: "a", v: 0 }], "k", ["v"])).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ego/desktop test ChartView --run`
Expected: FAIL with "computePieSlices is not exported / not defined"

**Step 3: Write minimal implementation**

- Extraer `computePieSlices(data, xKey, yKeys)` pura en `ChartView.tsx` (suma primera yKey, fracciones, ángulos start/end, path arc SVG).
- Rama `chartType === "pie"`: SVG 200x200, `<circle>` slices vía `<path d={arc}>`, `<title>` por slice, leyenda existente reutilizada, `role="img"` + `aria-label={title}`, fallback texto "Sin datos" si suma<=0.
- Mantener PALETTE con `var(--color-*, fallback)` existente. Cero nuevas deps.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ego/desktop test ChartView --run`
Expected: PASS. Luego: `pnpm --filter @ego/desktop typecheck`

**Step 5: Commit**

```bash
git add apps/desktop/renderer/components/canvas/ChartView.tsx apps/desktop/renderer/components/canvas/ChartView.test.tsx
git commit -m "fix: add pie rendering to ChartView with empty-state guard"
```

---

### Task 2: Adapter fino A2UI → CanvasBridge (sin Hashbrown)

**Files:**
- Create: `packages/ui-runtime/src/A2UIAdapter.ts`
- Test: `packages/ui-runtime/test/a2ui-adapter.test.ts`
- Modify: `packages/ui-runtime/src/index.ts` (export)

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { translateSurfaceUpdate } from "../src/A2UIAdapter.js";

describe("A2UIAdapter", () => {
  it("surfaceUpdate chart válido → inject", () => {
    const ops = translateSurfaceUpdate({
      surfaceId: "daily-report",
      components: [{ id: "c1", type: "chart", props: { id: "c1", title: "T", chartType: "bar", data: [{ x: "a", y: 1 }], xKey: "x", yKeys: ["y"] } }],
    });
    expect(ops[0].kind).toBe("inject");
  });
  it("componente desconocido → fallback graceful, no throw", () => {
    const ops = translateSurfaceUpdate({ surfaceId: "s", components: [{ id: "x", type: "unknown-widget" as never, props: {} }] });
    expect(ops[0].kind).toBe("fallback");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ego/ui-runtime test a2ui-adapter --run`
Expected: FAIL "Cannot find module A2UIAdapter"

**Step 3: Write minimal implementation**

```ts
// Pure functions, cero Electron, cero VantaDB:
// translateSurfaceUpdate(msg) → Array<{kind:"inject"|"remove"|"fallback", manifest?}>
// translateDataModelUpdate(msg: {componentId, path, value}) → CanvasChangeSet {op:"update", origin:"subego"}
// translateBeginRendering(msg) → no-op validado (retorna surfaceId)
// Validar cada manifest con CanvasComponentManifestSchema; fallo → {kind:"fallback"} + warn, jamás throw en render path.
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ego/ui-runtime test --run`
Expected: PASS. Luego `pnpm --filter @ego/ui-runtime typecheck` o `tsc --noEmit`.

**Step 5: Commit**

```bash
git add packages/ui-runtime/src/A2UIAdapter.ts packages/ui-runtime/test/a2ui-adapter.test.ts packages/ui-runtime/src/index.ts
git commit -m "feat: add thin A2UI to CanvasBridge adapter with graceful fallback"
```

---

### Task 3: Schema resuelto + plantilla daily-report

**Files:**
- Create: `packages/ui-runtime/src/resolvedCatalog.ts` (exporta `ReportCatalogJsonSchema` derivado de `CanvasComponentManifestSchema` filtrado a table/card/chart/timeline→board + `generate_report_ui` input_schema)
- Create: `packages/ui-runtime/src/templates/daily-report.ts` (LayoutTemplate: header Card + MetricRow Cards + HourlyChart chart area + ActivityTable table, con PayloadRef para rows)
- Test: `packages/ui-runtime/test/daily-report-template.test.ts` (parse con LayoutTemplateSchema + ChartPropsSchema)

**Step 1-5:** Mismo ciclo TDD. Comandos: `pnpm --filter @ego/ui-runtime test daily-report --run`, typecheck, commit `feat: add daily-report template and resolved catalog schema`.

Reglas: componentes fijos, datos vía PayloadRef (COUC-08), límite data model 200 filas por chart, tabla pagina 10 (TablePropsSchema default). Instrucción planner: "tiempo→line/area, categorías→bar, proporción→pie, KPI→card, secuencia→board".

---

### Task 4: SPEC iframe 3-capas (descarte documentado, sin runtime)

**Files:**
- Create: `docs/architecture/ui-iframe-sandbox-spec.md` (SPEC + veredicto `🚫 Descartada (runtime)` para P0, Asimilada solo como SPEC)
- Modify: `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` (solo si se detecta fricción; si no, no tocar)

Contenido SPEC: `sandbox="allow-scripts"` SIN `allow-same-origin` (load-bearing), `<meta>` CSP `default-src 'none'`, MessageChannel scoped allow-list, pin `event.origin` nunca `"*"`, distinción visual UI-agente vs host, anti-clickjacking/foco, permisos granulares. Prohibición explícita `allow-scripts allow-same-origin` juntos. Referencia Hermes PR #75828 solo como referencia, no como dependencia.

Sin tests (doc). Commit `docs: add iframe sandbox spec as P0 descartada runtime`.

---

## Orden de ejecución

1 → 2 → 3 → 4. Cada task commits atómico, typecheck verde antes de commit, nunca `--force`.
