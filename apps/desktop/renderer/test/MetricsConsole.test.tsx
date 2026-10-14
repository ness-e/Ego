import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MetricsConsole } from "../components/daily-state/MetricsConsole.js";

/**
 * T19 (T16-COSTS) — visor tokens/USD por turno (HERM-21). TDD RED primero.
 * Contrato: render con `usage` real por turno + vacío honesto sin datos
 * (nunca inventar filas).
 */
describe("T19: MetricsConsole — tabla de coste por turno", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  function mount(ui: React.ReactElement) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    return act(async () => {
      root?.render(ui);
    });
  }

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    container?.remove();
  });

  it("renderiza una fila por turno con tokens reales y coste USD", async () => {
    await mount(
      <MetricsConsole
        totalTokensToday={350}
        estimatedCostUsd={0.0021}
        p99LatencyMs={1200}
        completedTasksCount={3}
        pendingTasksCount={1}
        turns={[
          {
            turnId: "turn_1",
            promptTokens: 120,
            completionTokens: 80,
            totalTokens: 200,
            estimatedCostUsd: 0.0012,
          },
          {
            turnId: "turn_2",
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
            estimatedCostUsd: 0.0009,
          },
        ]}
      />
    );

    const table = container.querySelector('[data-testid="metrics-turns-table"]');
    expect(table).not.toBeNull();
    expect(table?.textContent).toContain("turn_1");
    expect(table?.textContent).toContain("120");
    expect(table?.textContent).toContain("80");
    expect(table?.textContent).toContain("$0.0012");
    expect(table?.textContent).toContain("turn_2");
    // Sin fila de vacío honesto cuando hay datos reales.
    expect(container.querySelector('[data-testid="metrics-turns-empty"]')).toBeNull();
  });

  it("vacío honesto sin turnos: sin filas inventadas", async () => {
    await mount(
      <MetricsConsole
        totalTokensToday={0}
        estimatedCostUsd={0}
        p99LatencyMs={0}
        completedTasksCount={0}
        pendingTasksCount={0}
      />
    );

    expect(
      container.querySelector('[data-testid="metrics-turns-table"]')
    ).toBeNull();
    const empty = container.querySelector('[data-testid="metrics-turns-empty"]');
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toMatch(/sin turnos/i);
  });
});
