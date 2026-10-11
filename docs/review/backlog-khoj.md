---
title: Khoj Review & Extraction Backlog — Ego SOC
kind: review
status: active
description: "Backlog especializado para la revisión, extracción de patrones algorítmicos y adaptación técnica de Khoj hacia Ego."
tags: [ego, khoj, extraction, review, search, chunking, rag, memory]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# Khoj Review & Extraction Backlog — Ego SOC

> **Propósito:** Registro canónico y secuencial de auditoría, extracción de patrones y adaptación del código fuente de `repos-referencia/khoj` hacia el monorepo de Ego.
> **Regla de Operación:** *No copiar código directamente*. Khoj es Python FastAPI; Ego extrae únicamente la lógica algorítmica (chunking de 256 tokens con deduplicación, filtrado coseno por umbral y heurísticas de extracción de hechos) adaptándola a TypeScript estricto sobre VantaDB nativo (BM25 Fast Path y L0-L3 Cognitive Path).
> **Esquema:** Tabla canónica de 10 columnas:
> `| ID | Severidad | Hallazgo | Archivo Khoj | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |`

---

## 1. Resumen Ejecutivo de Tareas de Extracción

| Grupo de Trabajo | Rango IDs | Tareas | Fases de Ego Impactadas | Prioridad | Beneficio Principal |
|---|---|:---:|---|:---:|---|
| **A. Chunking & Ingesta** | `KHOJ-01..02` | 2 | Fase 06 (`KB`), Fase 01 (`CORE`) | 🟠 P1 | Chunking semántico de 256 tokens con deduplicación de hash y metadatos |
| **B. Búsqueda Híbrida & Umbrales** | `KHOJ-03` | 1 | Fase 06 (`KB`), Fase 01 (`CORE`) | 🟠 P1 | Filtrado de resultados semánticos por corte de umbral de similitud coseno |
| **C. Extracción Cognitiva de Hechos** | `KHOJ-04..05` | 2 | Fase 01 (`CORE`), Fase 06 (`KB`), Fase 03 (`SUB`) | 🟠 P1 | Heurísticas estructuradas para extraer hechos persistentes de conversaciones |
| **TOTAL** | `KHOJ-01..05` | **5** | **Fases 01, 03, 06** | — | **Ahorro estimado: 2-3 semanas de desarrollo de RAG** |

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas)

| ID | Severidad | Hallazgo | Archivo Khoj | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `KHOJ-01` | 🟠 Alta | **Algoritmo de fragmentación de texto con solapamiento y deduplicación** | `src/khoj/processor/text_to_entries.py:45-120` | 🟢 1d | 🟠 P1 | ✅ Completada | Segmentación jerárquica en bloques de 256 tokens con solapamiento de 32-64 tokens, digest SHA-256 para deduplicación y preservación de bloques de código. Implementado en `packages/knowledge/src/ingest/AdaptiveChunker.ts`. Verificado en `packages/knowledge/test/AdaptiveChunker.test.ts`. | Ego: `KB-01`, `KB-02` | — |
| `KHOJ-02` | 🟡 Media | **Procesadores específicos por formato (Markdown, Org, PDF, DOCX)** | `src/khoj/processor/markdown_to_entries.py`, `pdf_to_entries.py` | 🟡 1-2d | 🟠 P1 | ✅ Completada | Extractores de texto limpios con preservación de encabezados jerárquicos como metadatos de contexto (`heading_path`) antes de indexar. Implementado en `packages/knowledge/src/ingest/DocumentParser.ts` y `MarkdownExtractor.ts`. Verificado en `packages/knowledge/test/DocumentParser.test.ts`. | Ego: `KB-01` | `KHOJ-01` |
| `KHOJ-03` | 🟠 Alta | **Filtrado por umbral de similitud y descarte de ruido semántico** | `src/khoj/search_type/text_search.py:80-140` | 🟢 1d | 🟠 P1 | ✅ Completada | Corte dinámico por umbral de similitud coseno (`score_threshold`, por defecto 0.70) para descartar coincidencias de baja confianza previo a la fusión RRF y contextualización del LLM. Implementado en `packages/knowledge/src/filters/CosineThresholdFilter.ts` y `HybridSearch.ts`. Verificado en `packages/knowledge/test/HybridSearch.test.ts`. | Ego: `CORE-09`, `KB-03` | — |
| `KHOJ-04` | 🟠 Alta | **Heurística de extracción de hechos atómicos (`extract_facts`)** | `src/khoj/routers/helpers.py:150-210`, `prompts.py` | 🟢 1d | 🟠 P1 | ✅ Completada | Extractor estructurado que convierte enunciados de conversación en triples tipados (`subject`, `predicate`, `object`) y genera identificadores deterministas. Implementado en `packages/knowledge/src/extractors/FactExtractor.ts`. | Ego: `CORE-12`, `KB-04` | — |
| `KHOJ-05` | 🟡 Media | **Actualización y consolidación autónoma de memorias (`ai_update_memories`)** | `src/khoj/routers/helpers.py:220-290` | 🟡 1d | 🟠 P1 | ✅ Completada | Flujo de consolidación cognitiva que procesa creación de hechos, sustitución causal (`supersedeFact`) y retiro inmutable (`retire`) sin borrado destructivo. Implementado en `packages/knowledge/src/FactLifecycle.ts` (`consolidateMemories`). Verificado en `packages/knowledge/test/QuarantineAndLifecycle.test.ts`. | Ego: `CORE-12`, `SUB-12` | `KHOJ-04` |
| `KHOJ-06` | 🔵 Futura | **Conectores de Monetización y Comunicación de Dominio (Stripe, Twilio, SMTP)** | `src/khoj/routers/billing.py`, `email.py`, `twilio.py` | 🟣 3-4d | 🔵 P3 | ⏳ Futura (Ego Web / Dominios) | Módulos para administración de suscripciones/pagos con Stripe, alertas por SMS con Twilio y correos transaccionales SMTP tanto para Ego Web (cuentas y planes) como para productos de usuarios. | Ego: `DOM-05`, `DOM-06`, `Ego-Web` | — |

---

## 3. Integración en el Flujo de Construcción de Ego

```mermaid
flowchart TD
    subgraph KhojExtraction ["repos-referencia/khoj"]
        K_CHK["KHOJ-01..02 (Chunking 256 tokens & Parsers)"]
        K_THR["KHOJ-03 (Cosine Threshold Filtering)"]
        K_FACT["KHOJ-04..05 (Fact Extraction & Consolidation)"]
    end

    subgraph EgoBacklog ["Ego Backlog Maestro"]
        CORE["Fase 01: Core Cognitivo<br/>CORE-09, CORE-12"]
        KB["Fase 06: Knowledge & Data<br/>KB-01, KB-02, KB-03, KB-04"]
        SUB["Fase 03: Sub-Egos<br/>SUB-12 Self-Improvement"]
    end

    K_CHK --> KB
    K_THR --> CORE
    K_THR --> KB
    K_FACT --> CORE
    K_FACT --> SUB
```
