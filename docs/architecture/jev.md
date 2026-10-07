| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente corregida (Decisión P17 2026-10-06) |
| Owner | ness-e |
| Fecha | 2026-10-06 |
| Contexto arquitectónico | Subordinado a la **Decision Intelligence Layer** como proveedor externo opcional |
| Jev real verificado | TypeSafe AI System One: https://jevai.net/ , https://typesafe.ai/blog/introducing-system-one-models-and-jev , https://docs.typesafe.ai/introduction , https://en.wikipedia.org/wiki/Jev_(AI_model) , https://www.langchain.com/blog/building-a-harness-with-jev |
| VantaDB | El Cognitive Runtime consulta contexto en VantaDB vía `EgoMemoryAdapter` y persiste veredictos en `gov/audit` |
| Principio P17 | "Jev puede desaparecer y la arquitectura de Ego no debería cambiar." Ego depende de la Decision Intelligence Layer, no de un proveedor específico. |

# Jev — Proveedor Externo de la Decision Intelligence Layer

## Rol arquitectónico de Jev en Ego (Decisión P17)

Jev **NO** es un producto ni componente propietario de Ego, ni una dependencia arquitectónica obligatoria. Es un modelo externo desarrollado por TypeSafe AI (su *System One Model*). 

En la arquitectura de Ego:
- Ego se apoya en una abstracción transversal: la **Decision Intelligence Layer**.
- Detrás de esta capa, el **Decision Router** despacha evaluaciones hacia múltiples proveedores: reglas determinísticas, modelos de decisión especializados (como Jev), LLMs con structured output o modelos locales.
- **Jev es uno de los posibles proveedores externos integrados**, no la única opción ni el núcleo irremplazable.
- Si Jev deja de existir o no está disponible, la arquitectura de Ego permanece intacta y degrada automáticamente a reglas deterministas y LLMs estructurados.

> *"Ego no depende de un modelo específico. Depende de capacidades de inteligencia. Los proveedores y modelos son intercambiables."*

## Qué es Jev (TypeSafe AI System One)

Jev no es una máquina de estados en LangGraph.js ni un `Joint Evaluation & Verdict Engine` interno de Ego. Es el modelo System One comercial de TypeSafe AI (San Francisco, fundada 2024; early access 15-sep-2026; seed $40M DCVC; co-inventor ChatGPT): decisiones tipadas a velocidad máquina.

- **Entrada:** `state` + preguntas tipadas (`Choice`/`Score`/`Noul`, hasta 255 opciones, mezclables en 1 call, evaluadas en paralelo sin degradación por contexto).
- **Salida:** valores tipados + probabilidades + `confidence` calibrada (cero alucinaciones); el código bifurca, ordena y enruta. Método RLCD.
- **Rendimiento:** 70-500ms, hasta 200x más rápido y 400x más barato que LLMs en tareas de clasificación; input $0.042-0.084/M, output free (foto oct-2026, a revalidar en spike P0); endpoint `POST /v1/systemone`.
- **Uso dentro de Decision Intelligence:** Routing rápido, verificación de precondiciones, scoring de urgencia, consultas `choice/score/yes-no`.

## Cascada de decisión en la Decision Intelligence Layer

El Decision Router implementa la siguiente cascada gobernada:

1. **Reglas deterministas (Gratis):** Patrones de texto, entidades conocidas, canal de entrada; decenas de microsegundos a milisegundos; coste $0.
2. **Modelos de decisión especializados (Jev Hosted — Ultrabajo coste):** 70-500ms; confianza calibrada; decide umbral, aprobación requerida y tier de modelo.
3. **LLM con Structured Output / Modelos Locales:** Cuando se requiere comprensión semántica profunda o cuando Jev no está disponible (modo offline o fallos de red). Se utilizan modelos generales (Claude Sonnet, GPT-4o, Llama vía Ollama) con esquemas tipados.

**Salida de decisión en Ego:** Siempre JSON estricto (`agent_id`, `namespace_targets`, `requires_approval`, `llm_tier`, `tools_enabled`, `audit_metadata` + `confidence`, `decided_by`), nunca prosa libre.

**Seguridad y gobernanza:** Límites definidos en código TypeScript, no en prompts. Las tareas de investigación no emiten escrituras externas; las acciones sensibles exigen aprobación humana registrada en `gov/audit`. Sin conexión de red, la cascada degrada a reglas deterministas y LLM local (Ollama); Jev hosted es una optimización de rendimiento y coste, no un requisito indispensable para el arranque de Ego.

## Integración y bucle de mejora

El runtime cognitivo propio de Ego orquesta el ciclo de decisión: clasificación tipada → selección de especialistas por grafo de capacidades → validación de permisos vs ACL + `gov/rules` → matriz de aprobación → selección de tier mínimo → despacho con registro inmutable en `gov/audit`. Turno objetivo del ciclo: 800-1.500ms.

Extracto de reglas determinísticas (completa en `gov/rules`): cliente → CRM; bug → Dev + Soporte; propuesta → Ops + Ventas (aprueba envío); API → Dev + KB; queja → Soporte + Ventas; PR → Dev (aprueba merge); factura → Ops (aprueba envío); cansancio → Diario; resumen → `EgoMemoryAdapter` (`searchMulti`); publicar → Ops (aprueba).
