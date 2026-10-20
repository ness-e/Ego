import { describe, it, expect, beforeEach } from "vitest";
import { DomainRegistry, BUILTIN_DOMAINS } from "../src/DomainRegistry.js";
import type { DomainDefinition } from "../src/types.js";

describe("DomainRegistry (DOM-09 / COUC-10)", () => {
  let registry: DomainRegistry;

  beforeEach(() => {
    registry = new DomainRegistry();
  });

  it("debe inicializarse con los 5 dominios canónicos de Ego", () => {
    const domains = registry.listDomains();
    expect(domains.length).toBe(5);

    const ids = domains.map((d) => d.id);
    expect(ids).toContain("engineering");
    expect(ids).toContain("product");
    expect(ids).toContain("knowledge");
    expect(ids).toContain("analytics");
    expect(ids).toContain("crm");
  });

  it("debe retornar la vista por defecto de un dominio existente", () => {
    const defaultView = registry.getDefaultView("engineering");
    expect(defaultView).toBeDefined();
    expect(defaultView?.id).toBe("code_tree");
    expect(defaultView?.componentKind).toBe("table");
  });

  it("debe registrar un dominio de extensión válido", () => {
    const customDomain: DomainDefinition = {
      id: "legal",
      name: "Legal & Compliance",
      description: "Auditoría legal, licencias y contratos",
      icon: "shield",
      namespaces: ["legal/contracts", "gov/audit"],
      defaultSubEgoId: "ego.legal",
      subEgoTemplates: ["ego.legal"],
      views: [
        {
          id: "contracts_view",
          name: "Contratos Activos",
          componentKind: "table",
          default: true,
        },
      ],
      tools: ["legal_check"],
      isBuiltin: false,
    };

    const registered = registry.registerDomain(customDomain);
    expect(registered.id).toBe("legal");
    expect(registry.hasDomain("legal")).toBe(true);
    expect(registry.listDomains().length).toBe(6);

    const view = registry.getDefaultView("legal");
    expect(view?.id).toBe("contracts_view");
  });

  it("debe rechazar un dominio malformado mediante validación Zod", () => {
    const invalidDomain = {
      id: "", // Inválido: vacío
      name: "Invalido",
      // Faltan campos requeridos
    };

    expect(() => registry.registerDomain(invalidDomain)).toThrow();
  });

  it("debe impedir sobreescribir dominios canónicos integrados con extensiones no-builtin", () => {
    const fakeEng: DomainDefinition = {
      id: "engineering",
      name: "Fake Engineering",
      description: "Intento de mutación",
      icon: "fake",
      namespaces: ["fake/*"],
      defaultSubEgoId: "fake",
      subEgoTemplates: ["fake"],
      views: [{ id: "v1", name: "v1", componentKind: "table", default: true }],
      isBuiltin: false,
    };

    expect(() => registry.registerDomain(fakeEng)).toThrow(/No está permitido sobreescribir/);
  });

  it("debe impedir desregistrar dominios integrados protegidos (COUC-10)", () => {
    expect(() => registry.unregisterDomain("product")).toThrow(/No es posible desregistrar/);
    expect(registry.hasDomain("product")).toBe(true);
  });

  it("debe permitir desregistrar dominios personalizados", () => {
    const custom: DomainDefinition = {
      id: "marketing",
      name: "Marketing",
      description: "Campañas y contenidos",
      icon: "megaphone",
      namespaces: ["mkt/*"],
      defaultSubEgoId: "ego.mkt",
      subEgoTemplates: ["ego.mkt"],
      views: [{ id: "mkt1", name: "mkt1", componentKind: "table", default: true }],
      isBuiltin: false,
    };

    registry.registerDomain(custom);
    expect(registry.hasDomain("marketing")).toBe(true);

    const removed = registry.unregisterDomain("marketing");
    expect(removed).toBe(true);
    expect(registry.hasDomain("marketing")).toBe(false);
  });

  it("debe retornar los namespaces correctos asociados a un dominio", () => {
    const ns = registry.getNamespacesForDomain("engineering");
    expect(ns).toContain("engineering/*");
    expect(ns).toContain("gov/audit");
  });
});
