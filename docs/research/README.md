# Research Hub — Ego Cognitive Operating System

| Campo | Valor |
| --- | --- |
| Estado | Activo — Repositorio de investigación técnica |
| Owner | ness-e |
| Fecha | 2026-10-07 |

---

## Propósito

El directorio `docs/research/` documenta las investigaciones técnicas profundas, análisis de estado del arte, benchmarking comparativo de modelos, experimentación de protocolos y análisis de viabilidad antes de comprometer decisiones de arquitectura en Ego.

---

## Áreas de Investigación Activas

1. **Protocolos de Agentes y Modelos**:
   - Model Context Protocol (MCP) spec 2024-11-05 (Client + Server en Electron Main).
   - Vercel AI SDK v7 como adaptador de transporte agnóstico (`packages/models/`).
   - JSON-RPC 2.0 y esquemas OpenRPC para comunicación declarativa.

2. **Memoria y Recuperación de Información**:
   - Algoritmos de fusión híbrida: Reciprocal Rank Fusion (RRF) combinando HNSW + BM25 en `NativeVantaDB`.
   - Recuperación estructural de grafos y GraphRAG local (ONNX embeddings + Fjall LSM).
   - Dream Consolidation y Micro-Memory-Documents inspirados en `vanta-memory`.

3. **Arquitectura Desktop y Runtimes**:
   - Aislamiento de procesos en Electron 34+ / Node.js 22.
   - Rendimiento de `@assistant-ui/react` con streaming de tokens de alta frecuencia.
   - PTY y multiplexación de terminales en Windows x64.

---

## Formato Estándar de Documentos de Research

Cada archivo de investigación debe incluir:
- **Resumen Ejecutivo (TL;DR)**
- **Estado del Arte / Tecnologías Evaluadas**
- **Metodología de Prueba o Benchmark**
- **Resultados Empíricos y Trade-offs**
- **Recomendación para Ego (Adopción / Adaptación / Rechazo)**
