| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de experiencia de usuario. Actualizado con decisión P22 (Estrategia de desarrollo iterativo de UX con presupuesto explícito) 2026-10-06 |
| Owner | ness-e |
| Fecha | 2026-10-06 |
| Fuente histórica | `../prd/13-12-experiencia-de-usuario-e-interfaz.md` (congelado) + Decisiones P4, P11 (Explicabilidad contextual), P22 (Estrategia UX con presupuesto) 2026-10-06 |

## Modelo de interacción: Chat + Canvas
La interfaz de Ego NO está estructurada como una colección de secciones o pantallas fijas. Utiliza un modelo de [Workspace Cognitivo Dinámico](../architecture/workspace-dinamico.md) compuesto por dos superficies coordinadas: Chat y Canvas.

- **Chat (Canal de intención):** Expresa lo que el usuario quiere hacer.
- **Canvas (Superficie de trabajo interactiva):** Representa el trabajo que Ego está realizando. No es solo visualización; incluye tablas editables, dashboards, gráficos, kanban, editores, formularios y código.

**Características del Canvas:**
- **Tipos de Canvas:** Temporal (para una tarea específica), Persistente (workspace guardado), Vista de datos (estructura persistente) y Workspace de Sub-Ego.
- **Contexto por selección:** El usuario puede seleccionar elementos en el Canvas y darle instrucciones a Ego sobre ellos. La selección se convierte en contexto explícito.
- **Transformación dinámica:** El Canvas cambia dinámicamente durante la conversación a medida que el trabajo evoluciona.
- **Modos de visualización:** Se soporta un modo de chat a pantalla completa con canvases embebidos (inline). Cabe destacar que no todas las tareas necesitan un Canvas (preguntas simples obtienen respuestas en texto).

**Principios:**
- *"El chat expresa lo que el usuario quiere hacer; el Canvas representa el trabajo que Ego está realizando."*
- *"La interfaz debe seguir el trabajo, no obligar al trabajo a seguir una interfaz predeterminada."*

## Estado de entrada: Estado Dinámico del Proyecto
El "Estado Dinámico del Proyecto" (Current Project State) es lo que el usuario ve al abrir Ego. No es un dashboard estático, ni un chat vacío, ni simplemente la última vista restaurada.

Responde a 5 preguntas clave:
1. ¿Qué ocurrió?
2. ¿Qué está ocurriendo?
3. ¿Qué quedó ejecutándose?
4. ¿Qué necesita atención?
5. ¿Qué debería hacer hoy?

**Características:**
- Generado dinámicamente por Ego usando Sub-Egos, basado en el estado real del proyecto (ej. sin panel de finanzas si no hay actividad financiera).
- Reporta el trabajo autónomo realizado (tareas completadas, fallidas, en ejecución, acciones de Sub-Egos).
- Diferencia tipos de información: Información, Recomendación, Decisión pendiente, Acción automática y Problema.
- Priorización inteligente basada en impacto, urgencia, riesgo, relevancia y fechas límite.
- Cada elemento es accionable (seleccionar y profundizar con contexto).
- El chat está integrado de manera que el usuario pasa de entender a actuar inmediatamente.
- La persistencia de sesión ("continuar donde estaba") es complementaria, no primaria.
- Utiliza el mismo sistema dinámico de Canvas y componentes.

**Principios:**
- *"Ego no espera a que preguntes qué está pasando. Te muestra qué pasó, qué importa y qué necesita atención."*
- *"Al abrir Ego, el usuario debe recibir una representación viva del estado de su proyecto."*

## Elementos permanentes de la interfaz
La interfaz se basa en Chat + Dynamic Workspace + superficies contextuales. La cantidad de paneles no forma parte de la identidad del producto (se descartan los modelos rígidos de 3 o 4 áreas fijas). Los elementos principales actuales son:

- **Chat (Conversation River):** El canal universal de comunicación basado en la librería `@assistant-ui/react` (Thread, Composer, Message, Tool-UI). El usuario habla sobre cualquier tema y Ego enruta las peticiones internamente. El texto se renderiza fluidamente usando markdown vía `@assistant-ui/react-streamdown`.
- **Canvas:** El área de trabajo principal y dinámica. Aquí, los Sub-Egos construyen interfaces en tiempo real según sea necesario. Puede mostrar: datos interactivos, acciones a realizar, aprobaciones pendientes, informes complejos, herramientas específicas o visualizaciones avanzadas.
- **Background Activity & Proactivity (anteriormente Dots):** La forma concreta (tray, notificaciones, activity center, daily state) es una decisión de diseño, no de arquitectura. Sirve para mostrar el trabajo persistente en segundo plano y la actividad proactiva de los Sub-Egos sin interrumpir el flujo principal.

## Explicabilidad contextual (Decisión P11)
La explicabilidad no es un panel fijo de 320px ni un componente estático de la interfaz (descartado Canvas Causal R0 permanente en P0). Es una **capacidad transversal del sistema** integrada de forma contextual dentro del workspace:

- **Principio rector:** *"Ego debe ser explicable, pero no intrusivamente explicativo."*
- **Modalidades de activación:**
  - **Bajo demanda:** Accesible mediante el control o consulta "¿Por qué?" en cualquier elemento, recomendación o decisión tomada por Ego o sus Sub-Egos.
  - **Proactiva:** Se despliega automáticamente antes de ejecutar acciones de alto impacto o irreversibles que requieran escrutinio.
- **3 niveles de profundidad:**
  - **Nivel 1 (Usuario):** Resumen comprensible, conciso y directo de la justificación.
  - **Nivel 2 (Avanzado):** Detalle de fuentes, registros y datos de VantaDB, Sub-Egos involucrados, herramientas invocadas y supuestos asumidos.
  - **Nivel 3 (Auditoría):** Traza técnica completa, logs de ejecución, métricas de razonamiento y registro inmutable en `gov/audit`.
- **Nomenclatura oficial:** Se sustituye "justificación matemática y semántica" por **"Evidencia y justificación de la decisión"**.
- **Explicabilidad vs. Aprobación:** La explicabilidad (comprender el fundamento y origen de una propuesta) y la aprobación (autorizar la ejecución de una acción con impacto) son conceptos vinculados pero independientes. La explicabilidad asiste el juicio humano; la aprobación ejecuta la gobernanza.
- **Evolución post-P0:** Canvas Causal evoluciona como herramienta avanzada de observabilidad, auditoría visual y análisis causal en fases posteriores (post-P0), sin ocupar un espacio fijo ni penalizar la agilidad en P0.

## Área de datos
Existe una sección dedicada a la exploración dinámica de datos generada a partir de los dominios, Sub-Egos y datos activos. Esta área muestra tablas, campos, registros y relaciones basándose exactamente en lo que el proyecto contiene, adaptándose estructuralmente a la información subyacente de VantaDB.

## Sistema de componentes
Todo el entorno visual es generado a través de un catálogo declarativo. Los Sub-Egos deciden qué mostrar y componen los esquemas, mientras que el UI Runtime se encarga de su renderizado de forma segura y uniforme. Ver detalles en el [Contrato de UI Runtime](../architecture/ui-runtime.md).

## Principios de diseño
1. **No reinventar:** Se utiliza `@assistant-ui/react` para la infraestructura de chat, `@phosphor-icons/react` para la iconografía y la tipografía Geist.
2. **Dark-first:** Diseño priorizado para modo oscuro; tema claro como opción secundaria.
3. **Alta densidad de información:** Aprovechar el espacio mostrando información técnica relevante sin abrumar visualmente al usuario.
4. **Accesibilidad:** Cumplimiento mínimo de los estándares WCAG 2.1 AA desde la fase P0.
5. **Electron-native:** Integración fluida con el sistema operativo (titleBarStyle hidden con superposición de controles nativos).
6. **Dinámico sobre estático:** La interfaz sigue al trabajo, construyendo sobre la marcha.
7. **Componentes declarativos:** Los Sub-Egos componen esquemas estructurados; el runtime los dibuja y aplica restricciones.
8. **La interfaz es una capacidad:** El entorno visual es una extensión de la inteligencia cognitiva del sistema, no una estructura de navegación predefinida.
9. **Explicable sin ser intrusivo:** "Ego debe ser explicable, pero no intrusivamente explicativo." La justificación acompaña al trabajo cuando el usuario la solicita o cuando el impacto lo exige, sin saturar la experiencia visual.

## Estrategia de desarrollo de UX (Decisión P22)
Ego adopta un enfoque de **desarrollo iterativo de UX con presupuesto explícito por fase** (Opción C). Este modelo evita tanto el riesgo de posponer la interfaz a una etapa final puramente cosmética (lo que provocaría costosas refactorizaciones arquitectónicas) como el de sobre-diseñar prematuramente cuando los modelos cognitivos y las capacidades del sistema todavía están evolucionando.

### 1. Distinción en 4 capas de madurez UX
El avance de la experiencia de usuario se estructura en cuatro capas acumulativas y secuenciales:
1. **UX estructural (Cimientos):** Desarrollada tempranamente desde el inicio. Define el layout general, navegación, tokens de diseño, tipografía, primitivas, estados de interacción universales, abstracción de temas y el registro de componentes declarativos.
2. **UX funcional (Por feature/capacidad):** Cada funcionalidad implementada debe ser usable, coherente con el catálogo visual, con accesibilidad básica cubierta y con la totalidad de sus estados de interacción resueltos.
3. **Refinamiento visual:** Alineación fina de densidad visual, ritmo tipográfico, consistencia de espaciado y balance cromático una vez que el flujo funcional está verificado.
4. **Polish final:** Fase dedicada transversal previa al lanzamiento enfocada en microinteracciones, transiciones cinéticas, sensaciones hápticas/auditivas si aplican, y pulido perceptual integral.

### 2. Fundaciones obligatorias desde el inicio
Para que el desarrollo iterativo sea sostenible y evite deuda técnica, los siguientes elementos de infraestructura de UX deben existir desde el inicio del proyecto:
- **Design tokens:** Variables centralizadas para paleta de colores, escalas de espaciado, radios de curvatura y sombras.
- **Primitivas y layout base:** Contenedores universales flexbox/grid, Conversation River, Canvas container y Background Activity (indicador contextual).
- **Tipografía y tokens de color:** Tipografía Geist integrada y esquema dark-first con abstracción desacoplada de temas (theme abstraction).
- **Espaciado y grillas:** Escala matemática predecible para márgenes, padding y alineaciones.
- **Estados de interacción universales:** Todo componente debe soportar contractualmente: `default`, `hover`, `active`, `focus`, `disabled`, `loading`, `error`, `empty` y `overflow`.
- **Component registry (Catálogo declarativo):** Registro seguro de componentes auditados que los Sub-Egos pueden componer.
- **Workspace schema:** Esquema declarativo normalizado para la coordinación entre Chat y Canvas sin acoplamiento a código React directo.

### 3. Criterios de aceptación de UI por feature
Ninguna feature o capacidad se considera terminada si solo opera a nivel de lógica o consola. Su interfaz debe cumplir:
- **Funcional:** El flujo opera extremo a extremo; el usuario puede iniciar, monitorear y culminar la acción sin errores visuales ni excepciones en consola.
- **Consistencia:** Utiliza estrictamente componentes del catálogo oficial y design tokens; queda prohibido introducir estilos ad-hoc o reglas CSS arbitrarias.
- **Accesibilidad básica:** Navegación esencial mediante teclado (secuencia de foco coherente, enter, escape), contraste WCAG 2.1 AA respetado y atributos ARIA mínimos en controles interactivos.
- **Calidad técnica:** Manejo íntegro de todos los estados (carga, vacío, error, saturación de datos), renderizado declarativo fluido y ausencia de saltos de maquetación (layout shifts).

> **Regla de finalización de feature:**  
> `Feature DONE = Implementado + Funcional + Usable + Consistente + Estados completos + Accesibilidad básica + Design System`

### 4. Presupuesto de UI por fase (% del esfuerzo total)
Cada fase del roadmap tiene asignado un presupuesto explícito de esfuerzo dedicado a UX/UI:

| Fase / Capacidad | Presupuesto UI (% del esfuerzo) | Enfoque UX asignado |
| --- | :---: | --- |
| **Core** | 10–15% | Estructura base, primitivas, design tokens, layout global (Conversation River + Canvas). |
| **Acción** | 10–15% | Tool-UI, aprobaciones contextuales, visualización de ejecución de herramientas. |
| **Sub-Egos** | 15–20% | Background Activity (indicador contextual), indicadores de actividad, panel de gestión contextual y lazy activation. |
| **Dynamic Workspace / Canvas** | 25–30% | Superficie interactiva, layout dinámico, renderizado declarativo reactivo y transformaciones de vistas. |
| **Decision Intelligence** | 10–15% | Explicabilidad contextual (3 niveles), visualización de evidencia y scoring de confianza. |
| **Knowledge / Data** | 15–20% | Área de datos, tablas dinámicas, explorador de entidades y esquemas de VantaDB. |
| **Tasks / Background** | 15–20% | Monitoreo visual de tareas asíncronas, telemetría y feedback no bloqueante. |
| **Daily State (Estado Dinámico)** | 20–25% | Dashboard vivo de bienvenida, priorización inteligente y elementos de interacción inmediata. |
| **Dominios** | 15–20% | Vistas especializadas y plantillas funcionales por dominio en Canvas. |
| **Recovery / Security / Distribution** | 5–10% | Flujos de onboarding, gestión de credenciales, asistentes de recuperación y auto-updater. |
| **Polish final transversal** | 15–20% *(del esfuerzo restante)* | Pulido estético global, microinteracciones, auditoría WCAG y coherencia integral pre-launch. |

- **Presupuesto global en P0:** 15–20% del esfuerzo total del proyecto.
- **Distribución del presupuesto UI:**
  - **60–70%**: Integrado directamente en las features a lo largo de cada fase (UX estructural y funcional).
  - **30–40%**: Reservado para pulido transversal, refinamiento visual y fase previa a distribución.

### 5. Niveles de calidad de UI/UX (Quality Levels)
El esfuerzo y acabado se adapta según la naturaleza del componente:
- **L1 Funcional (Infraestructura y servicios internos):** UI mínima, orientada a diagnósticos, inspección o configuración básica. Prioriza feedback operativo y robustez sin microanimaciones.
- **L2 Productivo (Features de cara al usuario / User-facing):** Interfaz estándar de alta usabilidad, flujos claros, manejo estricto de errores y uso riguroso del catálogo de componentes.
- **L3 Core UX (Superficies neurálgicas del sistema):** Chat (`@assistant-ui/react`), Dynamic Canvas, Daily State y Background Activity (indicador contextual). Requiere máxima ergonomía cognitiva, fluidez visual instantánea, cero parpadeos y refinamiento sensorial prioritario.

### 6. Progresión de calidad por etapa de madurez
- **Prototipo:** Rudimentario. Validación de arquitectura técnica, esquemas y viabilidad.
- **Alpha:** Usable + coherente. Validación del *Golden Path Alpha*; flujos completos operables sin bloqueos cognitivos ni inconsistencias graves.
- **Beta:** Pulido + consistente. Validación del *Golden Path Beta*; soporte multi-dominio, ergonomía consolidada y casos límite cubiertos.
- **Pre-launch:** Alta calidad y polish final. Microinteracciones, armonía visual absoluta, rendimiento optimizado y accesibilidad auditada.
- **Post-launch:** Iteración y optimización continua basada en métricas de uso real y telemetría.

### 7. Orden de prioridades estricto
Frente a disyuntivas de tiempo o recursos, el equipo aplica el siguiente orden inmutable:
$$\text{Correctitud} > \text{Seguridad} > \text{Funcionalidad} > \text{Usabilidad} > \text{Consistencia} > \text{Accesibilidad} > \text{Visual polish} > \text{Microinteracciones}$$

### 8. Reglas de oro de UX
1. *"Funcional primero. Usable siempre. Perfecto después."* — No se invierte esfuerzo en pulido cosmético sobre bases inestables o inusables.
2. *"Ship the capability, not the prototype."* — Cada incremento entregado debe constituir una capacidad real con UX operativa, no un boceto descartable.

## Presencia de Sub-Egos en la interfaz
Un principio rector del diseño es que **"la existencia de un Sub-Ego no implica la existencia de una pantalla"**. Los Sub-Egos son entidades cognitivas, no unidades de interfaz de usuario. Por tanto, no poseen secciones visuales fijas ni pantallas obligatorias en la navegación.

La visibilidad de los Sub-Egos se organiza en 4 niveles de presencia:

| Nivel de presencia | Definición | Comportamiento en la interfaz |
| --- | --- | --- |
| **Invisible / Interno** | Utilizado internamente por el orquestador de Ego para tareas de fondo, análisis o soporte. | No genera interfaz dedicada; su actividad se refleja de forma agregada en Background Activity (indicador contextual) o logs de auditoría. |
| **Contextual** | Se manifiesta dinámicamente cuando su dominio es relevante para la tarea en curso. | Aparece en el canvas o chat durante la interacción y se repliega automáticamente al finalizar la tarea. |
| **Persistente** | Posee datos continuos, herramientas activas o artefactos en monitoreo que justifican un espacio continuo. | Mantiene una vista dedicada en el canvas mientras existan procesos u objetos de trabajo activos que requieran atención. |
| **Acceso directo (Pinned)** | Fijado explícitamente por el usuario para acceso frecuente e inmediato. | Queda anclado como acceso directo en la interfaz. Ego puede sugerir fijar Sub-Egos basándose en patrones de uso frecuente. |

La administración de Sub-Egos está centralizada: no se gestionan mediante pestañas fijas en una barra lateral, sino a través de un panel de gestión centralizado que permite configurar visibilidad, permisos y accesos directos.

## Gestión de Sub-Egos
Los usuarios pueden administrar las instancias de los Sub-Egos, crear Sub-Egos personalizados y configurar sus capacidades. Este panel de administración no es una sección fija en una barra lateral; se accede a él de manera dinámica a través del workspace cuando se invoca la necesidad de gestionar o visualizar la estructura organizativa de los Sub-Egos.
