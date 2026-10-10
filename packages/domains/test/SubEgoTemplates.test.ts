import { describe, it, expect } from "vitest";
import { OFFICIAL_SUBEGO_TEMPLATES } from "../src/templates/officialSubEgoTemplates.js";

describe("SubEgoTemplates (DOM-06 / COUC-10)", () => {
  const canonicalIds = [
    "ego.dev",
    "ego.product",
    "ego.researcher",
    "ego.analyst",
    "ego.crm",
  ];

  it("debe contener exactamente los 5 Sub-Egos canónicos oficiales", () => {
    const keys = Object.keys(OFFICIAL_SUBEGO_TEMPLATES);
    expect(keys.length).toBe(5);

    for (const id of canonicalIds) {
      expect(OFFICIAL_SUBEGO_TEMPLATES[id]).toBeDefined();
      expect(OFFICIAL_SUBEGO_TEMPLATES[id].templateId).toBe(id);
    }
  });

  it("ego.dev debe tener herramientas y namespaces de ingeniería y worktrees", () => {
    const dev = OFFICIAL_SUBEGO_TEMPLATES["ego.dev"];
    expect(dev.recommendedTools).toContain("worktree_manage");
    expect(dev.recommendedTools).toContain("git_diff");
    expect(dev.recommendedCapabilities).toContain("git_worktrees");
    expect(dev.recommendedNamespaces.read).toContain("engineering/*");
    expect(dev.recommendedPermissions).toContain("git:operate");
  });

  it("ego.product debe tener herramientas de backlog y PRDs", () => {
    const product = OFFICIAL_SUBEGO_TEMPLATES["ego.product"];
    expect(product.recommendedTools).toContain("product_backlog_manage");
    expect(product.recommendedTools).toContain("product_prd_generate");
    expect(product.recommendedNamespaces.write).toContain("product/backlog");
    expect(product.recommendedNamespaces.write).toContain("product/epics");
  });

  it("ego.researcher debe tener capacidades de GraphRAG e investigación profunda", () => {
    const res = OFFICIAL_SUBEGO_TEMPLATES["ego.researcher"];
    expect(dev => dev).toBeDefined();
    expect(res.recommendedCapabilities).toContain("graph_rag_navigation");
    expect(res.recommendedCapabilities).toContain("deep_research");
    expect(res.recommendedNamespaces.write).toContain("kb/facts");
  });

  it("ego.analyst debe tener herramientas de agregación y datasets", () => {
    const analyst = OFFICIAL_SUBEGO_TEMPLATES["ego.analyst"];
    expect(analyst.recommendedTools).toContain("analytics_aggregate");
    expect(analyst.recommendedCapabilities).toContain("chart_dataset_formatting");
    expect(analyst.recommendedNamespaces.write).toContain("analytics/reports");
  });

  it("ego.crm debe tener pipeline de ventas y timeline de interacciones", () => {
    const crm = OFFICIAL_SUBEGO_TEMPLATES["ego.crm"];
    expect(crm.recommendedTools).toContain("crm_deal_manage");
    expect(crm.recommendedCapabilities).toContain("crm_pipeline_management");
    expect(crm.recommendedNamespaces.write).toContain("crm/deals");
    expect(crm.recommendedNamespaces.write).toContain("crm/interactions");
  });
});
