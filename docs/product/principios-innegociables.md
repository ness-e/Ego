| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de principios |
| Owner | ness-e |
| Fecha | 2026-10-06 |
| Fuente histórica | Decisión P24 |

# Principios Innegociables de Ego

## Definición
Las decisiones innegociables representan **propiedades del sistema**, no *features* de producto concretas. Son los cimientos sobre los que opera Ego; si una de estas propiedades se rompe, Ego deja de ser el sistema definido en su concepción original.

## Los 10 principios innegociables
1. **Memoria local persistente**: Toda la historia, conocimiento y decisiones se almacenan localmente (VantaDB).
2. **Contexto persistente y compartido del proyecto (Project Memory)**: La IA siempre tiene presente el estado global y los objetivos del proyecto.
3. **Cognitive Runtime central**: Un orquestador central coordina capacidades, contexto y herramientas, no son scripts aislados.
4. **Sub-Egos especializados y personalizables**: Capacidades particionadas en agentes especialistas (roles) definidos dinámicamente.
5. **Capacidad de ejecutar acciones mediante tools**: Ego tiene impacto real en el sistema del usuario (crear archivos, ejecutar comandos).
6. **Gobernanza, permisos y aprobación de acciones sensibles**: Controles estrictos para cualquier acción destructiva, irreversible o de alto impacto.
7. **Multi-modelo + Model Router**: Independencia de proveedores, eligiendo el modelo más adecuado según latencia, coste y capacidad necesaria.
8. **Chat + Dynamic Workspace**: Interfaz basada en intención comunicada (Chat) y trabajo materializado interactivamente (Canvas/Workspace).
9. **Local-first + propiedad/exportación de datos**: El usuario es dueño de su información y el sistema es primordialmente local.
10. **Operación persistente y extensible**: Tareas en segundo plano, eventos continuos y conectividad a recursos externos (MCP).

## Qué NO es innegociable
Varias decisiones históricas han sido reclasificadas como implementaciones o decisiones de diseño reemplazables:

| Concepto | ¿Innegociable? | Razón |
| --- | --- | --- |
| 23 roles fijos | NO | Eran un detalle de implementación inicial; los Sub-Egos son dinámicos y adaptables a dominios funcionales. |
| Interfaz Dots tray | NO | Es una implementación visual específica de Background Activity/Proactivity. |
| Canvas Causal R0 permanente | NO | Es un patrón de UX intrusivo; la explicabilidad es necesaria, pero su forma gráfica es flexible. |
| Offline absoluto | NO | Resulta demasiado restrictivo; se permite operación híbrida local-first con servicios en la nube para modelos pesados. |
| Cuarentena universal de hechos | NO | Introducir revisión manual para *todo* hecho añade fricción excesiva. |

## Regla de evaluación
> "Si una decisión puede cambiar sin alterar la capacidad de Ego de recordar, razonar, coordinar, actuar y mantener el contexto de un proyecto, esa decisión no es parte del núcleo innegociable de Ego."

## Matriz completa
| Concepto | ¿Innegociable? | Razón |
| --- | --- | --- |
| VantaDB local | SÍ | Pilar de la Memoria local persistente. |
| Memoria de Proyecto | SÍ | Pilar del Contexto persistente. |
| Orquestador Meta-Ego | SÍ | Pilar del Cognitive Runtime. |
| Tools/Acciones reales | SÍ | Pilar de Capacidad de ejecutar acciones. |
| Multi-modelo router | SÍ | Pilar de resiliencia y especialización. |
| 23 roles | NO | Detalle de partición, no propiedad del sistema. |
| Panel de 4 áreas/3-zonas | NO | Es sólo una disposición de UI. |
| Dots | NO | Es UI, el principio real es Background Activity. |
| Offline absoluto | NO | Condición técnica, no pilar de capacidad (basta con local-first y propiedad). |
| Canvas Causal fijo | NO | UX específica, el principio es la explicabilidad. |
