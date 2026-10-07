| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de namespaces |
| Owner | ness-e |
| Fecha | 2026-10-06 |

# Namespaces y Memoria

## Principio
Los namespaces en VantaDB están organizados por **dominio funcional**, no por Sub-Ego individual, respondiendo al principio de **memoria compartida con aislamiento de estado privado, permisos y capacidades**. No existe un "aislamiento estricto" que desconecte a los Sub-Egos del conocimiento común del proyecto; todos los especialistas comparten la memoria del proyecto (objetivos, decisiones, hechos, tareas, documentos y eventos) y acceden a ella según sus permisos autorizados. El formato general es `dominio/subespacio`. La estructura completa está definida en `ego.namespaces.json`, el cual está versionado. Cualquier desviación de este esquema en tiempo de ejecución se considera un bug.

*Nota: La estructura de namespaces por dominio es extensible y no requiere un mapeo 1:1 con los antiguos 23 roles/agentes originales. Los namespaces se basan en dominios/capacidades, siendo un esquema conceptual independiente del número de agentes.*

## Mapa de namespaces por dominio

| Dominio | Prefijos | Propósito |
| --- | --- | --- |
| **CRM/Sales** | `crm/contacts`, `crm/deals`, `crm/timeline` | Gestión de relaciones y ciclo de ventas. |
| **Support** | `support/tickets`, `support/kb` | Incidencias y base de conocimientos de soporte. |
| **Knowledge** | `kb/facts`, `kb/quarantine`, `kb/docs` | Base de conocimiento estructurada y factual de Ego. |
| **Engineering** | `dev/repos`, `dev/issues`, `dev/qa`, `dev/files`, `dev/errors`, `dev/adrs` | Artefactos técnicos, incidencias, y decisiones de arquitectura. |
| **Journal** | `journal/entries`, `journal/convos`, `journal/goals`, `journal/signals` | Registro contextual y personal del usuario. |
| **Governance** | `gov/audit`, `gov/policies`, `gov/sub_egos` | Auditoría, control de accesos y manifiestos de Sub-Egos. |
| **Marketing** | `marketing/campaigns`, `marketing/content`, `marketing/calendario` | Campañas y producción de contenidos. |
| **E-commerce** | `ecom/products`, `ecom/orders`, `ecom/prefs` | Gestión de catálogo y pedidos. |
| **Research** | `research/papers`, `research/notes`, `research/docs`, `research/findings` | Hallazgos e investigación activa. |
| **Finance** | `finance/transactions`, `finance/projections` | Movimientos económicos y proyecciones (previamente `ops/finance`). |
| **Operations** | `ops/proposals`, `ops/processes` | Propuestas operativas y procesos estándar. |
| **Metrics** | `metrics/telemetry`, `metrics/all` | Datos de telemetría y coste de orquestación por turno. |
| **System** | `system/config`, `system/snapshots` | Configuración base del sistema (Solo accesible por la capa de coordinación Meta-Ego). |
| **Sub-Egos** | `egos/*` | Prefijo exclusivo de estado privado por cada instancia de Sub-Ego (ej: `egos/123-abc/state`). |
| **Events** | `events/raw` | Bus de eventos histórico (TTL 30d). |
| **Quarantine**| `quarantine/pending` | Datos no verificados o en conflicto (TTL 7-14d). |

## Namespaces dinámicos de Sub-Egos
Cada instancia activa de Sub-Ego obtiene su propio espacio bajo el prefijo `egos/<id>/*` para su estado privado local (configuración interna, scratchpad de razonamiento y variables de sesión). 

Este aislamiento de estado privado no restringe el acceso al conocimiento general del proyecto: los Sub-Egos **pueden y deben leer los namespaces compartidos del proyecto** (`kb/*`, `crm/*`, `dev/*`, etc.) conforme a los permisos asignados en su manifiesto. Además, todo Sub-Ego debe tener un manifiesto registrado en el namespace de gobernanza (`gov/sub_egos`).

## Reglas de acceso
- El modelo operativo es de **memoria compartida con aislamiento de estado privado, permisos y capacidades**: no existe un aislamiento estricto que impida la colaboración transversal informada.
- Un Sub-Ego puede acceder a los namespaces compartidos (`kb/*`, `crm/*`, `marketing/*`, etc.) que estén explícitamente autorizados en su plantilla o manifiesto.
- Los namespaces bajo `egos/<id>/*` representan el estado privado exclusivo de cada Sub-Ego y no son accesibles directamente por otros especialistas salvo mediación del Orchestration Bus.
- `gov/*`: Solo es accesible por la capacidad de gobernanza y por la capa de coordinación (Meta-Ego).
- `system/*`: Solo accesible por la capa de coordinación (Meta-Ego).
- La lectura transversal no prevista en el manifiesto requiere escalación formal a través de la **Decision Intelligence Layer** (vía Decision Router) o aprobación directa de un humano.

## Metadata obligatoria
Todo registro ingresado en cualquier namespace debe contener al menos:
- `org_id`
- `source`
- `ts` (timestamp)
- `agent_id`
- `confidence`
- `state`

## TTL (Time-To-Live) por namespace
Para mantener el rendimiento y la limpieza de los datos, ciertos namespaces tienen políticas de expiración:
- `quarantine/*`: 7-14 días.
- `journal/*`: 90 días o 30 días dependiendo del subespacio.
- `events/raw`: 30 días.
- `metrics/*`: 180 días.

## Grafo de relaciones
VantaDB permite establecer aristas (edges) semánticas. Las aristas principales predefinidas son:
- `HAS_CLIENT`
- `WORKS_AT`
- `ASSOCIATED_WITH`
- `OPENED_TICKET`
- `RESOLVED_BY`
- `SUPERSEDED_BY`
- `DECIDED_BY`
- `BOUGHT`
- `COVERED_BY`
- `CITES`
- `BILLING_FOR`
- `DECIDED_FOR`

## Extensibilidad
Nuevos dominios funcionales pueden introducir nuevos prefijos de namespace de manera orgánica, sin requerir modificaciones en el esquema central de la base de datos. Como se mencionó, el archivo `ego.namespaces.json` se versiona y asegura la consistencia de este modelo extensible.
