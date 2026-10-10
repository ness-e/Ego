import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CharacterPresence } from "../components/canvas/CharacterPresence.js";
import { WhyButton } from "../components/explainability/WhyButton.js";

const SAMPLE_METADATA = {
  timestamp: 1728518400000,
  generatedBy: "ego.nucleus",
  why: {
    directCause: "Optimización de memoria VantaDB solicitada por usuario",
    vantaSources: ["projects/default/metrics/tokens", "memory/l1/short_term"],
    auditTrace: "audit:trace:88ff86cb:p11:verified",
  },
};

describe("CANV-07 & CANV-08: Explicabilidad Contextual y CharacterPresence", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("debe renderizar CharacterPresence con el nombre del Sub-Ego y el botón ¿Por qué?", async () => {
    await act(async () => {
      root.render(<CharacterPresence metadata={SAMPLE_METADATA} />);
    });

    expect(container.textContent).toContain("ego.nucleus");
    expect(container.textContent).toContain("¿Por qué?");
  });

  it("debe abrir el diálogo con los 3 niveles de explicabilidad al pulsar ¿Por qué?", async () => {
    await act(async () => {
      root.render(<WhyButton why={SAMPLE_METADATA.why} />);
    });

    const whyBtn = container.querySelector("button");
    expect(whyBtn).not.toBeNull();

    await act(async () => {
      whyBtn?.click();
    });

    // Validar los 3 niveles de la Decisión P11
    expect(container.textContent).toContain("Nivel 1: Causa Directa");
    expect(container.textContent).toContain("Optimización de memoria VantaDB solicitada por usuario");

    expect(container.textContent).toContain("Nivel 2: Fuentes y Memoria VantaDB");
    expect(container.textContent).toContain("projects/default/metrics/tokens");

    expect(container.textContent).toContain("Nivel 3: Auditoría & Telemetría");
    expect(container.textContent).toContain("audit:trace:88ff86cb:p11:verified");
  });
});
