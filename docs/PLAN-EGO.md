| Campo | Valor |
| --- | --- |
| Estado | Revisable — Fuente vigente de plan. Actualizado con decisiones fundacionales P1-P8, P11 (Explicabilidad contextual), P17 (Decision Intelligence Layer), P19 (Multi-proveedor, AI SDK como adaptador) y P22 (Estrategia UX iterativa con presupuesto) 2026-10-06. |
| Owner | ness-e |
| Fecha | 2026-10-06 |

# Master Plan: Ego

## Objetivo
Ego es un **Sistema Operativo Cognitivo (SOC)** diseñado inicialmente para creadores independientes, extensible a organizaciones. Ego convierte a una persona en una organización asistida por IA.
No es un chatbot, no es un CRM, no es una plataforma multiagente genérica, y los Sub-Egos no son "empleados digitales", sino **especialistas de IA persistentes**.
Consulta las referencias de producto: [docs/product/definicion-soc.md](product/definicion-soc.md) y [docs/product/concepto.md](product/concepto.md).
**Modelo económico**: Open Source (Apache 2.0) + SaaS por suscripción + consumo de IA separado. Ver [docs/product/modelo-economico.md](product/modelo-economico.md).

*Nota (Decisión P25): La documentación actual se someterá a una reescritura completa y reestructuración para reflejar las decisiones P24 ([Principios Innegociables](product/principios-innegociables.md)) y P25 ([Jerarquía Canónica](../jerarquia-canonica.md)). Esta versión es un puente temporal.*

## Estructura P0
La estructura del sistema pasa de estar centrada en roles fijos a un entorno dinámico y un catálogo extensible de capacidades:
- **Ego**: El SOC completo.
- **Workspace Dinámico**: Entorno de interfaz que combina Chat y Canvas, adaptándose a las necesidades de la tarea y renderizando UI de manera declarativa.
- **Catálogo de Dominios Funcionales**: Áreas de responsabilidad (Ingeniería, Producto, Marketing, etc.) que pueden ser cubiertas por el sistema.
- **Sub-Egos**: Instancias de especialistas de IA con responsabilidades, capacidades y reglas, activados bajo demanda (lazy-activated).

## Arquitectura P0 Actualizada
El sistema se organiza en las siguientes capas:
1. **Presentación**: Dynamic Workspace (Chat + Canvas con Declarative UI Runtime usando `@assistant-ui/react`). Bandeja de Background Activity & Proactivity. Desarrollo iterativo de UX con presupuesto explícito por fase (ver [ux-ui.md](product/ux-ui.md) y [metricas-okr.md](roadmap/metricas-okr.md)).
2. **Main**: Gateway de entrada, pre-carga de IPC, Decision Intelligence Layer (clasificación, scoring, routing, extracción y validación estructurada), capa de coordinación central (Meta-Ego) y Orchestration Bus para comunicación inter-Sub-Ego.
3. **Memoria**: Substrate local-first VantaDB 0.8.0 (`NativeVantaDB` in-process + `vantadb-mcp` subprocess) + `EgoMemoryAdapter` + esquema `ego.namespaces.json`.
4. **Sub-Egos**: Catálogo de dominios funcionales + plantillas de especialistas + instancias dinámicas. Fábrica inteligente de Sub-Egos (conversacional, plantillas, modo avanzado) y `SubEgoManifest`. Activación bajo demanda (lazy activation).
5. **Integraciones**: MCP Client + MCP Server + filesystem + git + terminal + GitHub (MCP oficial) + HTTP/Webhooks en P0; Email, Calendar, Slack en P1.
6. **IA y Modelos**: Arquitectura multi-proveedor agnóstica desde P0 basada en Ego Model Interface y Model Router por capacidades y roles funcionales; Vercel AI SDK utilizado como adaptador de integración (no arquitectura propietaria; versión agnóstica / AI SDK 7), adaptadores directos y locales (Ollama/Llama con enfoque offline-first), BYOK y endpoints compatibles con OpenAI.

## Hitos de Implementación P0
La implementación sigue una estrategia de "Vertical Slice" dividida en **12 Fases**, estructurada en dos grandes hitos (Alpha y Beta) enfocados en probar caminos funcionales completos (Golden Paths).

Para ver el detalle completo de cada fase, criterios de aceptación y los pasos exactos de los Golden Paths, consulta: [roadmap/roadmap.md](./roadmap/roadmap.md) y el inventario exhaustivo de 115 tareas canónicas en [roadmap/Backlog.md](./roadmap/Backlog.md).

- **P0-Alpha (Fases 01 a 05)**: Enfocado en el núcleo fundacional. El sistema puede recibir una intención, recuperar contexto, razonar, utilizar Sub-Egos, ejecutar herramientas y presentar resultados. Validado a través del *Golden Path Alpha* (20 pasos).
- **P0-Beta (Fases 06 a 12)**: Enfocado en producto, estabilización y distribución. El sistema permite gestionar un proyecto real con dominios funcionales. Validado a través del *Golden Path Beta* (uso intensivo multi-día y multi-dominio).
