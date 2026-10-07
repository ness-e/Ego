| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de autoridad |
| Owner | ness-e |
| Fecha | 2026-10-06 |
| Fuente histórica | Decisión P25 |

# Jerarquía Canónica y Resolución de Conflictos

## Propósito
Establecer un marco de autoridad claro para las decisiones de producto, arquitectura y diseño dentro de Ego. Esto evita debates circulares y clarifica qué componentes pueden ser alterados para resolver problemas técnicos, funcionales o de usabilidad.

## Regla fundamental
> "Una decisión de nivel inferior no puede contradecir una de nivel superior sin modificar explícitamente la decisión superior."

## Separación Capacidad / Arquitectura / Diseño / Implementación
La jerarquía se basa en la separación fundamental de conceptos:
- **Capacidad (QUÉ)**: El contrato, lo que el sistema debe poder lograr (Ej. Memoria persistente).
- **Arquitectura (CÓMO funciona)**: Los mecanismos técnicos para cumplir el contrato (Ej. VantaDB).
- **Diseño (CÓMO se experimenta)**: La interfaz y la experiencia del usuario (Ej. Chat y Canvas).
- **Implementación (CON QUÉ)**: Las tecnologías exactas empleadas (Ej. Rust, React).

## Jerarquía (12 niveles)
Desde la máxima autoridad a la mínima:

| Nivel | Categoría | Qué define | Estabilidad |
| --- | --- | --- | --- |
| 0 | Product Identity | Qué es Ego (Sistema Operativo Cognitivo). | Muy alta. Prácticamente inmutable. |
| 1 | Non-Negotiable Principles | Propiedades centrales (Memoria, Runtime, Tools). | Muy alta. |
| 2 | Product Model | Organización conceptual (Workspace, Dominios). | Alta. |
| 3 | Capability Model | Contratos funcionales (DI, Memory, Routing). | Alta. |
| 4 | System Architecture | Mecanismos técnicos (Orquestación, VantaDB). | Moderada/Alta. |
| 5 | Experience / Product Design | UX/UI, navegación (Chat+Workspace). | Moderada. |
| 6 | Domain Model | Áreas funcionales específicas (HR, Engineering). | Moderada. |
| 7 | Integration Model | Mecanismos de extensión externa (MCP). | Moderada. |
| 8 | Business / Distribution | Modelo económico y monetización. | Flexible según mercado. |
| 9 | Roadmap | Priorización y fases. | Flexible, ajustable por ciclos. |
| 10 | Implementation | Herramientas y dependencias (Vite, React, etc.). | Baja. Cambia según necesidad. |
| 11 | History / Legacy | Decisiones previas descartadas. | Nula (solo valor de contexto). |

## Regla de cambios
- Si un bug es de implementación (10), se cambia el código libremente.
- Si una librería (10) impide una experiencia (5), se cambia la librería.
- Si un diseño (5) entra en conflicto con una capacidad (3), el diseño debe adaptarse para satisfacer la capacidad, o escalar una propuesta formal para alterar la capacidad si se considera defectuosa.

## Resolución de contradicciones
Cuando surja un conflicto en el diseño técnico o de producto, el equipo deberá seguir este proceso de 4 pasos:
1. Identificar el nivel de cada restricción en la Jerarquía Canónica.
2. La directriz del nivel superior prevalece de forma automática.
3. Si la restricción inferior debe prevalecer por motivos de peso (ej. limitación técnica dura de un SDK), se debe documentar y promover una modificación explícita (RFC/ADR) de la decisión de nivel superior.
4. Actualizar todos los documentos afectados según la nueva alineación.
