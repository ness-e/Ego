// tests/e2e/contract/floating-wiring.contract.test.ts
//
// T2 (EGO-FIND-19) — ESTE FICHERO ES UN **LINT-TEST / CONTRATO**, NO UN TEST
// DE COMPORTAMIENTO.
//
// Por qué existe en esta forma: `apps/desktop/src/main.ts` es el entry point
// de Electron (efectos de módulo: `app.on(...)`, `BrowserWindow`, tray). No
// es importable en vitest sin arrancar el proceso → el wiring de `main.ts`
// no puede verificarse ejecutándolo.
//
// Qué verifica: que los SÍMBOLOS DEL CONTRATO de wiring siguen presentes y
// con la forma esperada. Un fallo aquí significa "alguien renombró o borró un
// símbolo del contrato", NO "el producto está roto".
//
// Qué verifica la COBERTURA REAL (no tautológica) de este wiring:
//   · `tests/e2e/floating-minimize.test.ts` → comportamiento del
//     `FloatingWindowManager` real (estados, click-through, resize, broadcast).
//   · `tests/gui/electron/floating-minimize.electron.ts` → E2E Electron real
//     (minimize nativo → isla visible → restore → auto-ocultado).
//   · `tests/gui/specs/floating-island.spec.ts` → DOM real en navegador.
//
// REGLAS DE ESTE FICHERO:
//   1. Nada de `expect(src).toContain("cadena literal de una línea concreta")`:
//      se comprueban PATRONES con `toMatch` ( toleran reformatting y renombrados
//      locales de variables).
//   2. Cada assert documenta el INVARIANTE, no la implementación.
//   3. Si un invariante cambia, se actualiza aquí Y en el E2E Electron; el
//      lint-test no puede ser la única cobertura de nada.
//
// CONTEXTO DE PRODUCTO (commit `d50a050`): el gate de autoshow cambió.
// Antes: `shouldAutoShow(floatingSnapshot())` (trabajo activo o HITL
// pendiente). Ahora: la isla se muestra al minimizar siempre que no esté
// muted/disabled y `presenceMode !== "never"`, y se auto-oculta al restaurar
// si no hay trabajo pendiente (`onMainRestoreOrFocus`).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const mainSrc = readFileSync(join(repoRoot, "apps", "desktop", "src", "main.ts"), "utf-8");
const viewSrc = readFileSync(
  join(repoRoot, "apps", "desktop", "src", "windows", "FloatingWindow.ts"),
  "utf-8",
);

describe("CONTRATO (lint-test) — wiring de la isla flotante en main.ts", () => {
  it("INVARIANTE: minimize está registrado y muestra la isla sin robar el foco", () => {
    // La ventana principal escucha `minimize`…
    expect(mainSrc).toMatch(/win\.on\(\s*"minimize"/);
    // …y la isla se muestra con `show()` (que usa `showInactive`: sin robo de foco).
    expect(mainSrc).toMatch(/ensureFloatMgr\(\)\.show\(\)/);
  });

  it("INVARIANTE: el gate de autoshow consulta el estado real de la isla", () => {
    // El handler lee el estado del manager (muted/disabled/attentionState) antes
    // de decidir: es la fuente de verdad, no una constante.
    expect(mainSrc).toMatch(/ensureFloatMgr\(\)\.getState\(\)/);
    // Presencia persistente: `presenceMode` (auto/never) decide si se muestra.
    expect(mainSrc).toMatch(/presenceMode/);
  });

  it("INVARIANTE: minimize registra el movimiento de la isla para persistirla", () => {
    expect(mainSrc).toMatch(/trackFloatingWindow\(/);
  });

  it("INVARIANTE: cambio de display/DPI reposiciona la isla", () => {
    expect(mainSrc).toMatch(/display-metrics-changed/);
    expect(mainSrc).toMatch(/repositionToDisplay\(\)/);
  });

  it("INVARIANTE: restore/focus auto-oculta la isla cuando no hay trabajo pendiente", () => {
    // El auto-ocultado (commit d50a050) es lo que sustituyó al gate
    // `shouldAutoShow` en el handler de minimize.
    expect(mainSrc).toMatch(/onMainRestoreOrFocus/);
    expect(mainSrc).toMatch(/win\.on\(\s*"restore"/);
    expect(mainSrc).toMatch(/win\.on\(\s*"focus"/);
  });
});

describe("CONTRATO (lint-test) — superficie pública de FloatingWindow", () => {
  it("INVARIANTE: el módulo exporta la superficie que usa main.ts y los tests", () => {
    expect(viewSrc).toMatch(/export function shouldAutoShow\(/);
    expect(viewSrc).toMatch(/export function syncFromAttention\(/);
    expect(viewSrc).toMatch(/export class FloatingWindowManager/);
  });

  it("INVARIANTE: `shouldAutoShow` sigue aplicando la regla 'trabajo o HITL, y no muted/disabled'", () => {
    // La función ya no gobierna el handler de minimize (cambió en d50a050),
    // pero sigue siendo la regla de autoshow del resto del producto
    // (preload `ipc.floating.*`, tests de `apps/desktop/test/`). Si desaparece
    // o cambia de semántica, este contrato lo detecta.
    const fn = viewSrc.match(/export function shouldAutoShow\([^)]*\): boolean \{[\s\S]*?\n\}/);
    expect(fn).not.toBeNull();
    const body = fn?.[0] ?? "";
    expect(body).toMatch(/muted/);
    expect(body).toMatch(/disabled/);
    expect(body).toMatch(/active\s*>\s*0/);
    expect(body).toMatch(/hitl\s*>\s*0/);
  });
});
