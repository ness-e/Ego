---
name: character-forge
description: Sistema experto de nivel profesional en dirección de arte, creatividad divergente, actuación digital, diseño conductual, emociones faciales, anatomía funcional, manipulación de accesorios, rigging, física, compañeros desktop 2.5D (estilo Coucou) y señalética de agentes mediante código.
---

# Character Forge — Code-First Character Design, Behavioral Acting, Desktop Companions & Animation Engineering

Character Forge es un sistema integral de ingeniería de personajes digitales, compañeros virtuales de escritorio y dirección de arte que combina **exploración creativa divergente, geometría analítica 2.5D, presencia espacial en el sistema operativo, señalética de agentes de IA (HITL), diseño conductual, actuación dramática, cinemática física y renderizado de alto rendimiento**.

Erradica tanto la **convergencia creativa** (evitando la repetición de clichés genéricos) como la **superficialidad técnica** (sustituyendo descripciones vagas por contratos de datos tipados, ecuaciones explícitas, pruebas automatizadas y código ejecutable verificado).

---

## 1. La Arquitectura Desacoplada de 4 Niveles

Para garantizar escalabilidad, bajo consumo y separación de responsabilidades, el motor divide el ciclo de vida del personaje en cuatro niveles:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. CAPA DE DEFINICIÓN DEL PERSONAJE (Character Definition & Identity)       │
│    Morfología, semiejes (a,b,c), exponente p, sockets semánticos, vestuario │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       v
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. CAPA DE COMPORTAMIENTO & ÁRBITRO DE ESTADOS (State Arbiter)              │
│    - FSM Espacial (hidden, docked, onDesktop, sleeping, dragging)           │
│    - FSM Emocional (neutral, happy, curious, astonished, skeptical)         │
│    - FSM Operativa de Agente (thinking, tool_running, waitingApproval, err) │
│    Prevalencia estricta: HITL / Errores > Usuario > Emoción > Idle Espacial │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       v
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. CAPA CINEMÁTICA, RESORTES & FÍSICA (Animation Runtime & Springs)         │
│    Reloj temporal medido (dt real), osciladores armónicos mẍ + cẋ + kx = 0  │
│    Curvas de vuelo balístico Bézier, anticipación y absorción de impacto    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       v
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. CAPA DE REPRESENTACIÓN & PROYECCIÓN (2.5D Superellipsoid & Render)       │
│    Superelipsoide analítico r(y) = (1 - |y|^p)^(1/p), normales por derivadas │
│    Pipeline de 9 capas en Canvas 2D / Three.js 3D / Web Audio API           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Reglas de Selección de Técnicas (Matriz de Decisión)

El motor debe elegir la tecnología más simple y eficiente que resuelva el encargo sin imponer una herramienta fija:

| Necesidad del Encargo | Tecnología Recomendada | Referencias Clave |
|---|---|---|
| **Mascota desktop ligera flotante** | **Canvas 2D + Geometría Analítica 2.5D** (Coste de GPU casi nulo). | [`analytical-superellipsoids-and-pseudo3d.md`](references/analytical-superellipsoids-and-pseudo3d.md), [`character-render-pipeline-and-occlusion.md`](references/character-render-pipeline-and-occlusion.md) |
| **Compañero con presencia en SO y Notch** | **Tauri 2 / Rust + FSM Espacial con Proximidad**. | [`spatial-presence-and-desktop-companion-fsm.md`](references/spatial-presence-and-desktop-companion-fsm.md), [`tauri-desktop-integration.md`](references/tauri-desktop-integration.md) |
| **Señalización de tareas de IA / HITL** | **Puente de Eventos + Badges Flotantes**. | [`agentic-feedback-and-hitl-signaling.md`](references/agentic-feedback-and-hitl-signaling.md), [`agent-event-bridge.md`](references/agent-event-bridge.md) |
| **Escena 3D con PBR, shaders GLSL o IK** | **Three.js WebGL / BufferGeometry procedural**. | [`procedural-3d-modeling.md`](references/procedural-3d-modeling.md), [`materials-and-pbr.md`](references/materials-and-pbr.md), [`functional-anatomy-and-rigging.md`](references/functional-anatomy-and-rigging.md) |
| **Gráficos vectoriales e iconografía web** | **React + SVG Declarativo con filtros nativos**. | [`svg-and-2d-graphics.md`](references/svg-and-2d-graphics.md) |

---

## 3. Protocolo de Verificación Obligatoria y Taxonomía Epistémica

Toda implementación o propuesta de personaje debe acompañarse de su estado de verificación utilizando estrictamente la siguiente taxonomía:
* **[Verificado]**: Hecho constatado en el código fuente inspeccionado o en especificaciones oficiales de la plataforma.
* **[Inferido]**: Deducción arquitectónica razonable derivada de patrones de ingeniería probados.
* **[Propuesto]**: Nueva capacidad o refinamiento sugerido para implementación.

---

## 4. Índice Canónico de Módulos Técnicos (`references/`)

### A. Geometría 2.5D, Accesorios y Renderizado
- [`analytical-superellipsoids-and-pseudo3d.md`](references/analytical-superellipsoids-and-pseudo3d.md): Superficie analítica $r(y) = (1 - |y|^p)^{1/p}$, rotación $R_y R_x$, derivadas parciales para normales e iluminación.
- [`outfits-and-2d-accessories-system.md`](references/outfits-and-2d-accessories-system.md): Sockets semánticos, anillos de corte transversal $C(\lambda)$, partición de profundidad $Z$ e inercia secundaria.
- [`character-render-pipeline-and-occlusion.md`](references/character-render-pipeline-and-occlusion.md): Secuencia determinista de 9 capas en Canvas 2D, optimización con `Path2D` y escalabilidad visual.
- [`craft-and-experimental-surfaces.md`](references/craft-and-experimental-surfaces.md): Sombreadores analógicos (Kintsugi, fieltro peach-fuzz, xilografía).

### B. Presencia Desktop, Háptica del SO y Agentes
- [`spatial-presence-and-desktop-companion-fsm.md`](references/spatial-presence-and-desktop-companion-fsm.md): FSM espacial (`docked`, `flying`, `onDesktop`, `sleeping`), proximidad radial euclidiana e histéresis.
- [`agentic-feedback-and-hitl-signaling.md`](references/agentic-feedback-and-hitl-signaling.md): Señalética operativa (`dots`, `bang`, `question`), animación de puntos en fase y protocolo HITL de 6 pasos.
- [`os-haptics-and-file-ingestion-reactions.md`](references/os-haptics-and-file-ingestion-reactions.md): Drag-and-drop de archivos vs texto, anticipación visual, absorción y guardrails de seguridad.
- [`tauri-desktop-integration.md`](references/tauri-desktop-integration.md): Ventanas transparentes, click-through en Rust, escalado DPI y soporte Linux/Wayland.
- [`agent-event-bridge.md`](references/agent-event-bridge.md): Contrato tipado de eventos de agente, flujo desacoplado, deduplicación y watchdog de timeout.

### C. Animación Física, Audio y Accesibilidad
- [`animation-runtime-and-secondary-motion.md`](references/animation-runtime-and-secondary-motion.md): Reloj desacoplado de framerate, oscilador armónico amortiguado e interrupciones limpias.
- [`audio-feedback-system.md`](references/audio-feedback-system.md): Síntesis de sonido procedural Web Audio API, limitación de repetición y modo silenciado.
- [`accessibility-and-desktop-performance.md`](references/accessibility-and-desktop-performance.md): `prefers-reduced-motion`, perfiles de consumo energético y telemetría de CPU por fotograma.
- [`visual-regression-and-behavior-testing.md`](references/visual-regression-and-behavior-testing.md): Batería de 4 niveles de pruebas (matemáticas, de estado, de integración y banco visual).

### D. Actuación, Expresión y Creatividad Divergente
- [`acting-and-behavioral-design.md`](references/acting-and-behavioral-design.md): Las 5 fases de actuación dramática (Postura $\to$ Anticipación $\to$ Acción $\to$ Reacción $\to$ Recuperación).
- [`facial-expression-and-emotions.md`](references/facial-expression-and-emotions.md): Catálogo de 28 expresiones faciales con micro-sacadas pupilares de Poisson.
- [`creative-exploration-and-concept-divergence.md`](references/creative-exploration-and-concept-divergence.md): Protocolo de divergencia conceptual y formulación de 3 a 5 hipótesis.
- [`anti-generic-guard-and-cliche-breakers.md`](references/anti-generic-guard-and-cliche-breakers.md): Matriz de 8 Red Flags y reemplazo estructural mandatorio.

---
### E. Dirección Dramática, Recetas Visuales y Laboratorio de Calidad
- [`character-performance-and-direction.md`](references/character-performance-and-direction.md): Motor de actuación en 10 fases (estímulo $\to$ memoria contextual), gramática de verbos y Acting Graph.
- [`executable-visual-recipes.md`](references/executable-visual-recipes.md): Biblioteca tipada de recetas de materiales por renderizador con PRNG determinista (`splitmix32`).
- [`visual-motion-quality-lab.md`](references/visual-motion-quality-lab.md): Escenas de prueba reproducibles, métricas dinámicas cuantitativas (overshoot, settling time, jitter) y MAE.
- [`character-staging-and-composition.md`](references/character-staging-and-composition.md): Motor de puesta en escena, test de silueta a 32–48px, lenguaje de formas morfológico y anclaje en pantalla.
- [`behavioral-personality-system.md`](references/behavioral-personality-system.md): Vector de personalidad cuantitativo de 8 dimensiones y proyección a parámetros físicos del oscilador.
- [`design-experimentation-and-iteration.md`](references/design-experimentation-and-iteration.md): Pipeline de experimentación A/B con control de variables constantes y rúbrica multidimensional.
- [`render-capability-matrix.md`](references/render-capability-matrix.md): Matriz de compatibilidad y coste técnico verificado por tecnología (Canvas 2D vs SVG vs WebGL vs Three.js).
- [`visual-defect-taxonomy.md`](references/visual-defect-taxonomy.md): Catálogo estructurado de defectos visuales y de movimiento (DEF-GEO, DEF-MAT, DEF-ANI, DEF-INT) con procedimientos de diagnóstico.
- [`canonical-visual-cases.md`](references/canonical-visual-cases.md): 6 casos canónicos de resolución técnica (Kintsugi, deformación squash/stretch, pupilas, badges, gestos táctiles, interrupción limpia).
### F. Sistema Integral de Mascotas 3D Suaves, Pelaje e Iluminación PBR
- [`soft-3d-character-geometry.md`](references/soft-3d-character-geometry.md): Morfologías superelipsoidales 3D, deformación de mallas, transiciones sin costura y parámetros semánticos.
- [`soft-materials-and-fur.md`](references/soft-materials-and-fur.md): Niveles A a D de sombreado de peluche/fuzz (Sheen PBR, Rim Noise, Shell Fur y simulación de fibras).
- [`soft-character-lighting.md`](references/soft-character-lighting.md): Iluminación de estudio de 3 puntos + Rim Light, sombras de contacto suaves y 6 presets lumínicos.
- [`3d-facial-expression-system.md`](references/3d-facial-expression-system.md): Canales faciales continuos, micro-sacadas pupilares, parpadeo de Poisson y 20 recetas emocionales.
- [`soft-character-rigging.md`](references/soft-character-rigging.md): Rigging nodal, conservación elástica de volumen ($S_{xz} = 1/\sqrt{S_y}$) y física de resortes en orejas.
- [`soft-character-acting-engine.md`](references/soft-character-acting-engine.md): Motor de actuación en 10 fases dramáticas y repertorio de 22 movimientos corporales.
- [`soft-character-personality.md`](references/soft-character-personality.md): Tríada conductual (Personalidad 8D, Estado Emocional e Intención) y 10 perfiles canónicos.
- [`soft-character-animation-recipes.md`](references/soft-character-animation-recipes.md): Biblioteca de recetas de animación por familias (Reposo, Atención, Positivas, Negativas, Sorpresa, Interacción, Transición).
- [`soft-character-animation-runtime.md`](references/soft-character-animation-runtime.md): Motor de ejecución temporal con capas de animación aditivas y mezclas suaves (cross-fading).
- [`soft-character-interaction.md`](references/soft-character-interaction.md): Seguimiento biológico de cursor 3D con cono de atención, reacciones táctiles a clics y arrastre.
- [`soft-character-conversation-performance.md`](references/soft-character-conversation-performance.md): Sincronización labial por amplitud de audio (RMS), escucha activa y modulación de turno.
- [`soft-character-customization.md`](references/soft-character-customization.md): Sistema de personalización profunda (morfología, materiales, colores, accesorios) sin reconstrucción de escena.
- [`soft-character-recipe-system.md`](references/soft-character-recipe-system.md): Formato canónico de recetas de geometría, materiales y actuación con perfiles de rendimiento.
- [`soft-character-asset-pipeline.md`](references/soft-character-asset-pipeline.md): Pipeline profesional de 14 etapas y consideraciones de exportación Blender-glTF.
- [`soft-character-quality-lab.md`](references/soft-character-quality-lab.md): Banco de pruebas automatizable de calidad visual, calidad de animación y calidad conductual.
- [`soft-character-performance-budgets.md`](references/soft-character-performance-budgets.md): Presupuestos cuantitativos por niveles (Económico, Intermedio, Alto) y degradación en segundo plano.
- [`soft-character-originality.md`](references/soft-character-originality.md): Matriz de divergencia obligatoria, invariantes de identidad y salvaguardas de originalidad.

---

## 5. Colección Canónica de Ejemplos en Código (`examples/`)

### A. Suite de Mascotas 3D Suaves y Peluches ("Lumi") (`examples/soft-3d-companion/` y Root)
1. [`examples/soft-3d-companion/types.ts`](examples/soft-3d-companion/types.ts): Contratos tipados de 8 expresiones, 10 actuaciones, 5 materiales PBR y personalización.
2. [`examples/soft-3d-companion/Soft3DCompanionEngine.ts`](examples/soft-3d-companion/Soft3DCompanionEngine.ts): Motor cinemático 3D con conservación elástica de volumen, física de orejas y sombra de contacto acoplada.
3. [`examples/soft-3d-companion/tests/run-tests.ts`](examples/soft-3d-companion/tests/run-tests.ts): Suite automatizada de 13 pruebas unitarias y reparación del defecto `DEF-ANI-BLOB`.
4. [`soft-3d-companion-viewer.html`](../../../soft-3d-companion-viewer.html): Visor 3D interactivo en Three.js con órbita 360°, selector de materiales y telemetría GPU/FPS.

### B. Suite de Producción y Laboratorio de Calidad (`examples/production-suite/`)
5. [`examples/production-suite/recipes/VisualRecipeRegistry.ts`](examples/production-suite/recipes/VisualRecipeRegistry.ts): Catálogo de recetas visuales tipadas (Cerámica, Fieltro, Vinilo, Gel, Tinta) con compilador Canvas 2D y PRNG determinista.
6. [`examples/production-suite/acting/ActingDirector.ts`](examples/production-suite/acting/ActingDirector.ts): Motor de actuación en 10 fases cinemáticas con soporte de precondiciones, prioridades y deformación elástica.
7. [`examples/production-suite/personality/PersonalityManager.ts`](examples/production-suite/personality/PersonalityManager.ts): Modulador de personalidad conductual en 8 dimensiones que proyecta parámetros físicos ($\omega_0, \zeta$).
8. [`examples/production-suite/quality/QualityLabRunner.ts`](examples/production-suite/quality/QualityLabRunner.ts): Evaluador determinista de métricas (overshoot vivo 8–22%, settling time $< 0.50\text{ s}$, jitter RMS).
9. [`examples/production-suite/tests/quality-lab.test.ts`](examples/production-suite/tests/quality-lab.test.ts): Suite de 19 pruebas automatizadas con inyección, detección y reparación sin regresión de defectos.
10. [`examples/production-suite/run-suite.ts`](examples/production-suite/run-suite.ts): Ejecutor central de la suite de producción.

### C. Suite de Compañeros Desktop 2.5D (Estilo Coucou) (`examples/coucou-companion/`)
11. [`examples/coucou-companion/CoucouCompanionEngine.ts`](examples/coucou-companion/CoucouCompanionEngine.ts): Fachada orquestadora modular con Canvas 2D, FSMs desacopladas y puente de eventos.
12. [`examples/coucou-companion/geometry/superellipsoid.ts`](examples/coucou-companion/geometry/superellipsoid.ts): Geometría analítica $r(y)$, normales de superficie y rotación cartesiana.
13. [`examples/coucou-companion/behavior/stateArbiter.ts`](examples/coucou-companion/behavior/stateArbiter.ts): Árbitro de prioridades que impone alertas críticas sobre estados cosméticos.
14. [`examples/coucou-companion/tests/run-tests.ts`](examples/coucou-companion/tests/run-tests.ts): Suite ejecutable de 15 pruebas matemáticas y de transiciones de estado.

### D. Suite de Personajes con Diversidad Estética Radical (`examples/divergent-characters/`)
15. [`examples/divergent-characters/OrigamiFacetedConstruct.ts`](examples/divergent-characters/OrigamiFacetedConstruct.ts): Entidad poliédrica con normales planas y cinemática de pliegues washi.
16. [`examples/divergent-characters/ClayBioOrganism.ts`](examples/divergent-characters/ClayBioOrganism.ts): Organismo de arcilla con animación Stop-Motion a 12 FPS.
17. [`examples/divergent-characters/EtchingBotanicalCharacter.tsx`](examples/divergent-characters/EtchingBotanicalCharacter.tsx): Grabado al aguafuerte botánico con tramas cruzadas en React/SVG.

### E. Banco de Aceptación Definitiva del Personaje "Kuro" (`tests/acceptance/` y Root)
18. [`tests/acceptance/KuroCharacterDefinition.ts`](tests/acceptance/KuroCharacterDefinition.ts): Especificación de los 3 conceptos divergentes e invariantes anatómicos de Kuro.
19. [`tests/acceptance/KuroKinematicsAndAccessories.ts`](tests/acceptance/KuroKinematicsAndAccessories.ts): Cinemática de 5 expresiones, 5 actuaciones en 10 fases dramáticas y monóculo con oclusión Z.
20. [`tests/acceptance/AcceptanceSuiteRunner.ts`](tests/acceptance/AcceptanceSuiteRunner.ts): Ejecutor automatizado de los 9 criterios de la Prueba de Aceptación Definitiva (9/9 Aprobados).
21. [`character-forge-kuro-acceptance.html`](../../../character-forge-kuro-acceptance.html): Visor y laboratorio visual interactivo en tiempo real para inspección visual y auditoría de defectos.

---

## 6. Guardrails de Calidad Innegociables

1. **Prevalencia Absoluta de la Seguridad Humana (HITL)**: Ningún estado de sueño o animación cosmética puede enmascarar o posponer una alerta de confirmación del agente.
2. **Desacoplamiento Temporal Estricto**: Queda prohibido codificar incrementos por fotograma fijo; todo cálculo cinemático depende de $\Delta t$ medido.
3. **Ventana Viva de Dinámica Elástica**: Las oscilaciones físicas deben mantenerse rigurosamente con overshoot vivo entre $8\%$ y $22\%$ y tiempo de asentamiento $< 0.50\text{ s}$ para garantizar peso orgánico sin histeria visual.
4. **Determinismo Estricto de Semillas Visuales**: Todo ruido procedural, grano o microfibra textil debe originarse en un PRNG determinista (`splitmix32`) con semilla fija para evitar parpadeos estocásticos entre cuadros.
5. **Cero Ejecución Automática en Drag-and-Drop**: Soltar un archivo en la mascota alimenta la acción funcional con validación de rutas y tamaño, sin autoejecutar código.
6. **Respeto a Movimiento Reducido**: Congelar oscilaciones y sustituir saltos balísticos por fundidos de opacidad cuando `prefers-reduced-motion` esté activo.
