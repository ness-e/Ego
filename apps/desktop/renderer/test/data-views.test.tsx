import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RecordView } from "../components/canvas/data/RecordView";
import { QueryView } from "../components/canvas/data/QueryView";
import { RelationView } from "../components/canvas/data/RelationView";
import { getComponentRenderer, ComponentRegistry } from "../components/canvas/registry";
import type { RecordViewProps, QueryViewProps, RelationViewProps } from "@ego/ui-runtime";

describe("KB-05: Canvas Data Views (Record, Query y Relation View)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("Registra los componentes de datos en el ComponentRegistry de Canvas", () => {
    expect(ComponentRegistry.record_view).toBeDefined();
    expect(ComponentRegistry.query_view).toBeDefined();
    expect(ComponentRegistry.relation_view).toBeDefined();

    expect(getComponentRenderer("record_view")).toBe(ComponentRegistry.record_view);
    expect(getComponentRenderer("query_view")).toBe(ComponentRegistry.query_view);
    expect(getComponentRenderer("relation_view")).toBe(ComponentRegistry.relation_view);
  });

  it("RecordView: Renderiza documento/hecho con estado, fragmentos y metadatos", async () => {
    const recordProps: RecordViewProps = {
      id: "rec-test-1",
      title: "Documento de Arquitectura Ego",
      recordKey: "doc_arch_001",
      namespace: "kb/docs",
      payload: "Texto completo del documento de arquitectura sobre el SOC Ego.",
      confidence: 0.95,
      state: "active",
      metadata: {
        author: "ego.architect",
        format: "markdown",
      },
      chunks: [
        {
          id: "chunk-1",
          index: 0,
          content: "Capítulo 1: Runtime Cognitivo",
          headingPath: ["Manual", "Capítulo 1"],
          tokenCount: 120,
        },
        {
          id: "chunk-2",
          index: 1,
          content: "Capítulo 2: VantaDB LSM",
          headingPath: ["Manual", "Capítulo 2"],
          tokenCount: 150,
        },
      ],
      lineage: [
        {
          relation: "derived_from",
          targetKey: "spec_v1",
          timestamp: 1728518400000,
        },
      ],
    };

    await act(async () => {
      root.render(<RecordView props={recordProps} />);
    });

    expect(container.textContent).toContain("Documento de Arquitectura Ego");
    expect(container.textContent).toContain("Activo");
    expect(container.textContent).toContain("95% confianza");
    expect(container.textContent).toContain("doc_arch_001");
    expect(container.textContent).toContain("Texto completo del documento de arquitectura");
  });

  it("RecordView: Soporta hechos en cuarentena y sustituidos", async () => {
    const quarantinedProps: RecordViewProps = {
      id: "rec-quarantine",
      title: "Aserción No Verificada",
      recordKey: "fact_ext_99",
      namespace: "quarantine/pending",
      payload: "El usuario prefiere Rust sobre C++",
      confidence: 0.45,
      state: "quarantined",
      chunks: [],
      lineage: [],
    };

    await act(async () => {
      root.render(<RecordView props={quarantinedProps} />);
    });

    expect(container.textContent).toContain("En Cuarentena");
    expect(container.textContent).toContain("45% confianza");
  });

  it("QueryView: Renderiza resultados y aplica corte dinámico de similitud", async () => {
    const queryProps: QueryViewProps = {
      id: "query-test-1",
      title: "Búsqueda de Memoria Mnemónica",
      query: "arquitectura",
      namespace: "all",
      minScoreFilter: 0.7,
      results: [
        {
          key: "doc_1",
          namespace: "kb/docs",
          snippet: "El Cognitive Runtime coordina modelos y herramientas.",
          score: 0.92,
        },
        {
          key: "doc_2",
          namespace: "kb/docs",
          snippet: "Resultado marginal de baja similitud que debe filtrarse si el umbral sube.",
          score: 0.72,
        },
      ],
    };

    await act(async () => {
      root.render(<QueryView props={queryProps} />);
    });

    expect(container.textContent).toContain("Búsqueda de Memoria Mnemónica");
    expect(container.textContent).toContain("2 resultados");
    expect(container.textContent).toContain("Cognitive Runtime");
    expect(container.textContent).toContain("Score: 0.920");

    // Simulamos subir el umbral por encima de 0.72 para verificar descarte dinámico
    const slider = container.querySelector("input[type='range']") as HTMLInputElement;
    expect(slider).not.toBeNull();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeSetter?.call(slider, "0.85");
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Ahora sólo debe quedar doc_1 visible
    expect(container.textContent).toContain("1 resultados");
    expect(container.textContent).toContain("doc_1");
    expect(container.textContent).not.toContain("Resultado marginal");
  });

  it("RelationView: Renderiza nodos con ids en string y aristas de linaje", async () => {
    const relationProps: RelationViewProps = {
      id: "rel-test-1",
      title: "Grafo de Linaje GraphRAG",
      rootNodeId: "node_seed",
      nodes: [
        {
          id: "node_seed",
          label: "Semilla: Decisión 42",
          type: "decision",
          content: "Adopción de VantaDB como motor mnemónico",
          weight: 1.0,
        },
        {
          id: "node_fact_1",
          label: "Hecho: BM25 In-Process",
          type: "fact",
          content: "NativeVantaDB opera BM25 rápido sin sobrecarga",
          weight: 0.85,
        },
        {
          id: "node_doc_1",
          label: "Doc: Arquitectura de Memoria",
          type: "document",
          content: "Especificación formal de namespaces",
          weight: 0.8,
        },
      ],
      edges: [
        {
          from: "node_seed",
          to: "node_fact_1",
          relation: "derived_from",
          weight: 0.9,
        },
        {
          from: "node_seed",
          to: "node_doc_1",
          relation: "mentions",
          weight: 0.75,
        },
      ],
      layout: "dag",
    };

    await act(async () => {
      root.render(<RelationView props={relationProps} />);
    });

    expect(container.textContent).toContain("Grafo de Linaje GraphRAG");
    expect(container.textContent).toContain("3 nodos / 2 aristas");
    expect(container.textContent).toContain("Semilla: Decisión 42");
    expect(container.textContent).toContain("Hecho: BM25 In-Process");
    expect(container.textContent).toContain("--(derived_from)-->");
  });
});
