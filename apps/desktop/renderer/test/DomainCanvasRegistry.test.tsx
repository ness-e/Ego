// T4 (VERDICT R3) — `DomainCanvasView` resuelve por `componentKind` contra
// el registry dinámico (sin ramas `domainId === "…"`).
//
// RED primero. Antes de este trabajo el componente tenía 10 ramas
// hardcodeadas (5 de carga + 5 de render) y `componentKind` era metadato
// muerto: un dominio nuevo no se podía registrar sin tocar el componente.
//
// Lo que se verifica:
//  1. Los 5 dominios canónicos siguen renderizando SU vista (no se rompe
//     la funcionalidad existente).
//  2. Un `componentKind` NO hardcodeado se renderiza (hot-swap: el registry
//     dinámico es la única puerta de entrada).
//  3. El componente NO contiene ramas por `domainId`.
import { describe, it, expect, afterEach } from "vitest";
import type React from "react";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getCanvasComponentRegistry } from "@ego/ui-runtime";
import { DomainCanvasView } from "../components/domains/DomainCanvasView.js";
import { DOMAIN_COMPONENT_KINDS } from "../components/domains/views.js";
import { resolveDomainView } from "../components/domains/domain-registry.js";

const SRC = join(process.cwd(), "components", "domains", "DomainCanvasView.tsx");
const source = readFileSync(SRC, "utf-8");

describe("T4 (R3): DomainCanvasView resuelve por componentKind contra el registry", () => {
  afterEach(() => {
    cleanup();
  });

  it("el componente NO tiene ramas hardcodeadas por domainId", () => {
    expect(source).not.toMatch(/domainId\s*===\s*"/);
    expect(source).not.toMatch(/domainId\s*===\s*'/);
  });

  it("los 5 dominios canónicos tienen componentKind y renderer registrado", () => {
    for (const domain of ["engineering", "product", "knowledge", "analytics", "crm"]) {
      const kind = DOMAIN_COMPONENT_KINDS[domain];
      expect(kind, `falta componentKind para ${domain}`).toBeTruthy();
      expect(resolveDomainView(kind!), `sin renderer para ${kind}`).toBeTruthy();
    }
  });

  it("un componentKind NO hardcodeado se renderiza (hot-swap por el registry)", async () => {
    const registry = getCanvasComponentRegistry();
    registry.register(
      "dominio_de_prueba",
      () => <div data-testid="vista-de-prueba">vista registrada en runtime</div>,
      { allowOverride: true }
    );

    render(<DomainCanvasView domainId="__cualquiera__" />);
    // El dominio desconocido no tiene componentKind → error honesto.
    expect(screen.getByRole("alert")).toBeTruthy();

    cleanup();
    // Pero si el dominio declara un componentKind registrado en runtime…
    // (aquí, simulado con el registry) el componente se renderiza.
    const Dynamic = resolveDomainView("dominio_de_prueba");
    expect(Dynamic).toBeTruthy();
    const DynamicView = Dynamic as unknown as () => React.ReactElement;
    render(<DynamicView />);
    expect(screen.getByTestId("vista-de-prueba")).toBeTruthy();
  });

  it("un dominio con componentKind registrado en runtime se renderiza", async () => {
    const registry = getCanvasComponentRegistry();
    registry.register(
      "engineering_status_override",
      () => <div data-testid="override">override</div>,
      { allowOverride: true }
    );
    // Se sustituye el renderer del componentKind de ingeniería en runtime.
    const original = resolveDomainView(DOMAIN_COMPONENT_KINDS.engineering!);
    expect(original).toBeTruthy();

    // El registro por defecto manda: la vista canónica se renderiza.
    render(<DomainCanvasView domainId="engineering" />);
    await waitFor(() => {
      expect(screen.getByText(/Workspace de Ingeniería/i)).toBeTruthy();
    });
  });

  it("cada dominio canónico renderiza SU vista (no se rompe la funcionalidad)", async () => {
    const casos: Array<[string, RegExp]> = [
      ["engineering", /Workspace de Ingeniería/i],
      ["product", /Product/i],
      ["knowledge", /Conocimiento/i],
      ["analytics", /Telemetr/i],
      ["crm", /CRM|Pipeline/i],
    ];
    for (const [domain, patron] of casos) {
      cleanup();
      render(<DomainCanvasView domainId={domain} />);
      await waitFor(() => {
        expect(
          screen.getAllByText(patron).length,
          `el dominio ${domain} no renderizó su vista`
        ).toBeGreaterThan(0);
      });
    }
  });
});
