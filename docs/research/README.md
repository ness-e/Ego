# Research Hub — Ego Cognitive Operating System

| Campo | Valor |
| --- | --- |
| Estado | Activo — Repositorio de investigación técnica |
| Owner | ness-e |
| Fecha | 2026-10-20 |

---

## Propósito

El directorio `docs/research/` documenta las investigaciones técnicas profundas, análisis de estado del arte, benchmarking comparativo de modelos, experimentación de protocolos y análisis de viabilidad antes de comprometer decisiones de arquitectura en Ego.

> **Nada de este directorio es normativo.** `docs/research/` es *material de
> referencia*: sirve para saber qué se evaluó, con qué evidencia y con qué
> veredicto. Lo que **sí** gobierna el producto son
> [`docs/jerarquia-canonica.md`](../jerarquia-canonica.md) (12 niveles),
> [`docs/product/principios-innegociables.md`](../product/principios-innegociables.md)
> y los ADRs de [`docs/adr/`](../adr/README.md).

## Inventario del directorio

| Fichero | Qué es | Estado |
|---|---|---|
| [`arquitectura-master-matrix.md`](arquitectura-master-matrix.md) | **Matriz de contraste** de las 22 secciones del documento maestro externo frente al código de Ego: estado verificado, evidencia `archivo:línea`, conflicto con ADR-0011 y tarea de cierre. | Activo (verificado 2026-10-19 por A8) |
| [`Arquitectura y Diseño de Sistemas para Plataformas y Agentes de IA.md`](Arquitectura%20y%20Dise%C3%B1o%20de%20Sistemas%20para%20Plataformas%20y%20Agentes%20de%20IA.md) | **Research externo — NO normativo.** Describe una plataforma cloud omnicanal (Tauri v2, daemon 24/7, PostgreSQL/pgvector/Qdrant, MicroVMs Firecracker, WebRTC, SSR, mensajería omnicanal) **mayoritariamente descartada por [ADR-0011](../adr/0011-stab14-asimilados-descartes.md)** y por los 10 principios innegociables. | Externo / no normativo |
| [`hermes-agent-deep-dive.md`](hermes-agent-deep-dive.md) | Deep dive del gemelo de stack (Electron + React + assistant-ui). | Activo |
| [`openclaw-deep-dive.md`](openclaw-deep-dive.md) | Deep dive del runtime/gobierno por streaming de eventos. | Activo |
| [`coucou-deep-dive.md`](coucou-deep-dive.md) | Deep dive del motor de personaje y la isla de escritorio. | Activo |
| [`character-audit-and-coucou-inventory.md`](character-audit-and-coucou-inventory.md) | Inventario de puertos del motor de personaje (ficheros idénticos / bifurcados / nuevos) y su estado de atribución. | Activo (A6) |
| [`orquestacion-multiagente.md`](orquestacion-multiagente.md) | Estado del arte de orquestación multi-agente: frameworks (LangGraph, AutoGen, CrewAI, Agents SDK, Agent Framework, CAMEL, ChatDev), topologías de enjambre (supervisor, handoff, jerárquica, group chat, sociedad) y sistemas de "empresa de agentes" (MetaGPT, ChatDev, CAMEL, Generative Agents). | Activo (2026-10-20) |
| [`plantillas-agentes-y-enjambres.md`](plantillas-agentes-y-enjambres.md) | Sistemas de plantilla de agentes por aplicación (Claude Code, OpenCode, Gemini CLI, Qwen Code, Goose, Codex), estándar Agent Skills (`SKILL.md`), `AGENTS.md`, marketplaces, y diseño de referencia del `SubEgoTemplate` con importador de lo ya instalado. | Activo (2026-10-20) |
| [`backoffice-empresa-personal.md`](backoffice-empresa-personal.md) | Backoffice de una empresa de una sola persona: ERP, CRM, finanzas, inventario, facturación y comercio. Modelo de dominio mínimo (5 entidades + 5 reglas), decisiones nativo/integración/no-hacer y qué construir primero. | Activo (2026-10-20) |
| [`canales-comunicacion-y-social.md`](canales-comunicacion-y-social.md) | Canales que puede operar un SOC: mensajería (WhatsApp, Telegram, Discord, Slack, email, SMS/voz), CRM ligero, publicación en redes sociales, y el flujo de aprobación para escribir en nombre del usuario. | Activo (2026-10-20) |
| [`compatibilidad-integraciones-mcp-skills.md`](compatibilidad-integraciones-mcp-skills.md) | De dónde saca Ego el ecosistema de integraciones: formatos y rutas de configuración por app, importabilidad de MCP/plugins/skills, detección de apps instaladas, brechas del MCP de Ego y estrategia de importación con gate HITL. | Activo (2026-10-20) |
| [`automatizacion-y-agentes-ejecucion.md`](automatizacion-y-agentes-ejecucion.md) | Automatización con agentes: workflow engines, ejecución durable, computer-use/browser-use, asistentes locales, y los mecanismos de ejecución fiable (idempotencia, checkpoint, presupuesto triple, aprobación suspendida). | Activo (2026-10-20) |
| [`producto-y-desarrollo-como-empresa.md`](producto-y-desarrollo-como-empresa.md) | Gestión de producto y desarrollo como empresa de software de una persona: spec-driven, roadmap, CI/CD, calidad, changelog y releases, y pipeline de feature con agentes. | Activo (2026-10-20) |
| `HISTORIAL-DE-CONTEXTO-E-INVESTIGACION.txt` | Contexto de investigación previo (histórico). | Histórico |

> **Alcance del documento maestro.** NO es una especificación de Ego. La
> matriz de contraste es el que traduce sus 22 secciones al estado real del
> código, distinguiendo lo **descartado por decisión** (no es deuda de Ego) de
> lo **brecha real** (pendiente de la Ola 2).

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

> **Corrección 2026-10-20:** la línea de RRF describe **la capacidad del motor
> de VantaDB**, no lo que Ego ejecuta hoy. En el **Fast Path** Ego usa **BM25
> léxico puro** con re-rank mono-lista (sin RRF); la fusión RRF + HNSW denso
> pertenece al **Cognitive Path** (Ola 2 · E2). Ver
> `docs/architecture/memoria-vantadb.md` §3 y §10.

3. **Arquitectura Desktop y Runtimes**:
   - Aislamiento de procesos en Electron 34+ / Node.js 22.
   - Rendimiento de `@assistant-ui/react` con streaming de tokens de alta frecuencia.
   - PTY y multiplexación de terminales en Windows x64.

> **Corrección 2026-10-20:** la línea de PTY describe **a `openclaw`/`helmor`**, no
> a Ego. Ego **no tiene PTY** (`node-pty` no está en el workspace); su
> equivalente es el drenado de terminal **sobre pipes** a 16 KB/tick con
> ring-buffer de 2 MB (`packages/tools/src/native/terminal/TerminalCommandPolicy.ts`
> + `NativeTerminalTool.ts`). Ver `docs/roadmap/Backlog.md` §backlogs de
> referencia.

---

## Formato Estándar de Documentos de Research

Cada archivo de investigación debe incluir:
- **Resumen Ejecutivo (TL;DR)**
- **Estado del Arte / Tecnologías Evaluadas**
- **Metodología de Prueba o Benchmark**
- **Resultados Empíricos y Trade-offs**
- **Recomendación para Ego (Adopción / Adaptación / Rechazo)**
