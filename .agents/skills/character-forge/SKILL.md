---
name: character-forge
description: Sistema experto de nivel profesional en dirección de arte, creatividad divergente, actuación digital, diseño conductual, emociones faciales, anatomía funcional, manipulación de accesorios, rigging, física y síntesis de audio Web Audio para personajes mediante código.
---

# Character Forge — Code-First Character Design, Behavioral Acting, Creative Direction & Animation Engineering

Character Forge es un sistema integral de ingeniería de personajes digitales y dirección artística que combina **exploración creativa divergente, diseño conductual, actuación digital (*digital acting*), arquitectura emocional, cinemática de agarre de accesorios, simulación física y programación gráfica de vanguardia**.

Erradica la **convergencia creativa** (la tendencia algorítmica a recurrir siempre al mismo robot esférico cian de plástico vinilo) y supera la rigidez mecánica de primitivas ensambladas, tratando al personaje como una **entidad viva coherente** que posee identidad visual distintiva, decide intenciones, planifica acciones con anticipación y recuperación, modula expresiones faciales y manipula accesorios en entornos interactivos de producción.

---

## 1. La Arquitectura Desacoplada de 3 Capas Fundamentales

Para evitar marañas de condiciones `if/else` incompatibles al escalar comportamientos, estilos y emociones, el sistema separa estrictamente tres niveles de abstracción:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. CAPA CONDUCTUAL & INTENCIÓN (Behavior Layer)                             │
│    Personalidad (6 rasgos), emociones contextuales, intenciones y BTs       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Intención + Emoción objetivo
                                       v
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. CAPA DE PLANIFICACIÓN DE ACCIÓN (Action & Motion Planning Layer)         │
│    5 Fases: Postura Inicial ──> Anticipación ──> Acción ──> Reacción ──> Rec │
│    Sockets de agarre, acople de objetos, sincronización multimodal           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Poses articulares, morphs, sockets
                                       v
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. CAPA DE REPRESENTACIÓN & CINEMÁTICA (Rig & Presentation Layer)           │
│    Two-Bone IK, FABRIK, Slerp, PBR Shaders, SVG DOM, Web Audio API          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Protocolo Obligatorio de Exploración Creativa Previa

Antes de escribir una sola línea de geometría o shader en encargos que admitan libertad de diseño, es **estrictamente mandatorio** ejecutar el protocolo de divergencia para evitar la convergencia en soluciones cliché:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Análisis de Grados de Libertad: Determinar restricciones duras de marca. │
│ 2. Definición de Ejes Polares: Tensión entre pares opuestos de atributos.  │
│ 3. Generación Divergente (3-5 Hipótesis): Silueta, materialidad y cinemática│
│ 4. Verificación Anti-Cliché: Test de las 8 Red Flags de convergencia.       │
│ 5. Selección Fundamentada: Justificación técnica y estética de la opción.   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Matriz de Red Flags de Convergencia (Prohibiciones de Default)
Cualquier diseño que incurra en 2 o más de estos patrones debe someterse a la regla de **Cliché-Breakers** (2 cambios estructurales obligatorios):
1. **Silueta**: Cabeza esférica sobredimensionada con cuerpo cilíndrico tipo cápsula (*Pill/Funko*).
2. **Visor**: Ojo único o visor horizontal cian/azul neón resplandeciente.
3. **Flotación**: Ausencia de miembros con flotación senoidal ingrávida continua en el eje Y.
4. **Acabado**: Plástico blanco brillante tipo dispositivo de consumo o juguete de vinilo liso.
5. **Paleta**: Fondo oscuro monocromo con acento único cian eléctrico o púrpura saturado.
6. **Miembros**: Esferas flotantes desconectadas simulando manos.
7. **Emoción**: Parpadeo genérico con sonrisa simétrica constante.
8. **Articulación**: Falta de anticipación física (el personaje arranca o frena instantáneamente).

---

## 3. Prioridad de Implementación de Sistemas (P0 a P2)

| Prioridad | Sistema | Resultado Esperado | Módulos Técnicos Clave |
|---|---|---|---|
| **P0** | **Exploración Creativa y Dirección de Arte** | Erradicación de clichés mediante 3 a 5 hipótesis divergentes de silueta, materialidad táctil y estilo. | [`creative-exploration-and-concept-divergence.md`](references/creative-exploration-and-concept-divergence.md), [`anti-generic-guard-and-cliche-breakers.md`](references/anti-generic-guard-and-cliche-breakers.md) |
| **P0** | **Expresión Facial Parametrizada** | El mismo personaje expresa 28 emociones y matices distintos sin rediseñarse, con sacadas pupilares y parpadeo aperiódico. | [`facial-expression-and-emotions.md`](references/facial-expression-and-emotions.md) |
| **P0** | **Actuación y Planificación de Fases** | El personaje ejecuta intenciones dramáticas completas: postura inicial $\to$ anticipación $\to$ acción $\to$ reacción $\to$ recuperación. | [`acting-and-behavioral-design.md`](references/acting-and-behavioral-design.md) |
| **P1** | **Rigging, Articulación y Mirada** | Morfologías bípedas, cuadrúpedas o modulares con Two-Bone IK, FABRIK, límites de ROM anatómicos y coordinación ojo-cabeza. | [`functional-anatomy-and-rigging.md`](references/functional-anatomy-and-rigging.md), [`morphological-diversity-and-silhouette-systems.md`](references/morphological-diversity-and-silhouette-systems.md) |
| **P1** | **Accesorios y Manipulación de Objetos** | Sockets anatómicos configurables, puntos de agarre (*Grip Sockets*) y acople/liberación física sin penetraciones. | [`hands-and-object-manipulation.md`](references/hands-and-object-manipulation.md), [`accessories-and-attachment-system.md`](references/accessories-and-attachment-system.md) |
| **P2** | **Sonido y Sincronización Multimodal** | Línea temporal unificada donde gestos corporales, mirada, visemas de habla y audio procedural se disparan en sincronía. | [`multimodal-coordination-and-acting-timeline.md`](references/multimodal-coordination-and-acting-timeline.md), [`sound-design-and-web-audio.md`](references/sound-design-and-web-audio.md) |
| **P2** | **Personalidad y Reacciones Contextuales** | Rasgos cuantitativos (energía, formalidad, timidez, curiosidad) que modulan latencias, amplitudes y respuestas a eventos. | [`personality-and-contextual-reactions.md`](references/personality-and-contextual-reactions.md) |

---

## 4. Índice Canónico de Módulos Técnicos (`references/`)

### A. Creatividad, Dirección de Arte y Diversidad Estética
- [`creative-exploration-and-concept-divergence.md`](references/creative-exploration-and-concept-divergence.md): Protocolo de divergencia conceptual, polarización de rasgos y formulación de hipótesis estructuralmente distintas.
- [`aesthetic-taxonomy-and-visual-styles.md`](references/aesthetic-taxonomy-and-visual-styles.md): Taxonomía operativa de 15 estilos visuales 2D, 3D e híbridos (Linograbado, Risografía, Cerámica, Papel/Origami, Fieltro, Solarpunk, Brutalismo).
- [`anti-generic-guard-and-cliche-breakers.md`](references/anti-generic-guard-and-cliche-breakers.md): Detección de patrones clónicos, 8 Red Flags y reglas de reemplazo estructural mandatorias.
- [`morphological-diversity-and-silhouette-systems.md`](references/morphological-diversity-and-silhouette-systems.md): Siluetas facetadas, huecas/anulares, laminares, monolíticas, flotantes fragmentadas y asimétricas.
- [`craft-and-experimental-surfaces.md`](references/craft-and-experimental-surfaces.md): Sombreadores GLSL de superficies analógicas: Kintsugi, Fieltro peach-fuzz, Linograbado procedural e Irisiscencia de película delgada.
- [`creative-evaluation-and-originality-rubric.md`](references/creative-evaluation-and-originality-rubric.md): 15 preguntas de autocrítica visual y rúbrica cuantitativa de originalidad y coherencia de marca.

### B. Actuación, Conducta y Emociones
- [`acting-and-behavioral-design.md`](references/acting-and-behavioral-design.md): Catálogo de intenciones dramáticas, pantomima, lenguaje corporal y las 5 fases de actuación.
- [`facial-expression-and-emotions.md`](references/facial-expression-and-emotions.md): Espacio paramétrico facial, catálogo de 28 emociones, sacadas biológicas y mezcla ponderada Hermite.
- [`personality-and-contextual-reactions.md`](references/personality-and-contextual-reactions.md): Vector de personalidad de 6 parámetros y matriz de respuesta a eventos de UI/App.
- [`multimodal-coordination-and-acting-timeline.md`](references/multimodal-coordination-and-acting-timeline.md): Pistas de actuación multimodal sincronizadas con Web Audio y visemas.
- [`action-planning-and-behavior-trees.md`](references/action-planning-and-behavior-trees.md): Behavior Trees (BTs) para tareas compuestas y sistema de 5 capas de animación concurrentes.

### C. Anatomía, Articulación y Manipulación
- [`functional-anatomy-and-rigging.md`](references/functional-anatomy-and-rigging.md): Rigs para múltiples morfologías, límites de rotación anatómica (ROM), Two-Bone IK y FABRIK.
- [`hands-and-object-manipulation.md`](references/hands-and-object-manipulation.md): Taxonomía de agarres (potencia, precisión, pinza, magnético), Grip Sockets y transferencia bimanual.
- [`accessories-and-attachment-system.md`](references/accessories-and-attachment-system.md): Sistema de anclajes relativos (*Sockets*), vestuario intercambiable y física secundaria de telas.

### D. Geometría, Matemáticas y Gráficos Base
- [`art-direction-and-character-design.md`](references/art-direction-and-character-design.md): Silueta en blanco y negro, psicología de formas, proporciones estilizadas y turnarounds.
- [`visual-identity-and-color.md`](references/visual-identity-and-color.md): Espacio perceptual OKLCH, regla 60-30-10, contraste WCAG 2.2 y soporte de daltonismo.
- [`computational-geometry.md`](references/computational-geometry.md): De Casteljau, Catmull-Rom splines, parametrización de longitud de arco constante y raycasting.
- [`mathematics-and-linear-algebra.md`](references/mathematics-and-linear-algebra.md): Transformaciones homogéneas 4x4, Slerp con cuaterniones sin singularidades y cálculo de Jerk.
- [`procedural-3d-modeling.md`](references/procedural-3d-modeling.md): Generación directa de `BufferGeometry` con TypedArrays, ADN paramétrico y exportación glTF.
- [`svg-and-2d-graphics.md`](references/svg-and-2d-graphics.md): SVG declarativo en React, morphing cúbico de trazados, filtros y Canvas 2D con `Path2D`.

### E. Física, Óptica, Renderizado y Producción
- [`physics-and-numerical-simulation.md`](references/physics-and-numerical-simulation.md): Integración simpléctica (Euler semi-implícito), Verlet chains y acumulador de tiempo fijo.
- [`animation-principles-and-rigging.md`](references/animation-principles-and-rigging.md): Los 12 principios clásicos por código, easing analítico y respiración asimétrica.
- [`lighting-optics-and-shadows.md`](references/lighting-optics-and-shadows.md): Atenuación cuadrática acotada, estudio de 3 puntos, mitigación de shadow acne y blob shadows.
- [`materials-and-pbr.md`](references/materials-and-pbr.md): Cook-Torrance microfaceta (GGX/Smith/Schlick), acabados Vinyl Toy, cerámica y SSS estilizado.
- [`textures-and-procedural-shaders.md`](references/textures-and-procedural-shaders.md): Shaders GLSL con ruido Simplex/fBm, Voronoi para blindajes, Triplanar mapping y derivadas de pantalla.
- [`sound-design-and-web-audio.md`](references/sound-design-and-web-audio.md): Síntesis procedural Web Audio API (ADSR) y reactividad acústica con AnalyserNode.
- [`rendering-and-postprocessing.md`](references/rendering-and-postprocessing.md): Tone mapping ACES Filmic, bloom selectivo, viñeta GLSL y partículas GPU.
- [`architecture-and-code-quality.md`](references/architecture-and-code-quality.md): Principios SOLID, 0 allocations en el render loop (0 GC) y protocolo de cleanup.
- [`performance-and-accessibility.md`](references/performance-and-accessibility.md): Presupuestos medidos, suspensión por IntersectionObserver y `prefers-reduced-motion`.
- [`testing-and-visual-validation.md`](references/testing-and-visual-validation.md): Ciclo Render-Critique-Fix, suite de pruebas unitarias y rúbrica cuantitativa de calidad.
- [`verified-resources.md`](references/verified-resources.md): Bibliografía canónica y especificaciones oficiales (W3C, MDN, Three.js, Khronos).

---

## 5. Colección Canónica de Ejemplos en Código (`examples/`)

### Suite de Personajes con Diversidad Estética Radical
1. [`examples/divergent-characters/OrigamiFacetedConstruct.ts`](examples/divergent-characters/OrigamiFacetedConstruct.ts): Entidad poliédrica geométrica con cinemática de pliegues en papel, normales planas y materialidad traslúcida washi.
2. [`examples/divergent-characters/ClayBioOrganism.ts`](examples/divergent-characters/ClayBioOrganism.ts): Organismo de arcilla esculpido con imperfecciones de huellas dactilares procedurales y animación en escalón (stop-motion a 12 FPS).
3. [`examples/divergent-characters/EtchingBotanicalCharacter.tsx`](examples/divergent-characters/EtchingBotanicalCharacter.tsx): Mascota botánica en React/SVG mediante grabado al aguafuerte con tramas de cross-hatching procedurales y silueta asimétrica.

### Motores Conductuales, Faciales y de Manipulación
4. [`examples/facial-emotion-engine/FacialEmotionBlendEngine.ts`](examples/facial-emotion-engine/FacialEmotionBlendEngine.ts): Motor de 28 expresiones faciales parametrizadas con interpolación suave y micro-sacadas pupilares.
5. [`examples/behavioral-character/BehavioralActingController.ts`](examples/behavioral-character/BehavioralActingController.ts): Controlador de actuación con intenciones en 5 fases y modulación por rasgos de personalidad.
6. [`examples/object-manipulation/AccessoryManipulationSystem.ts`](examples/object-manipulation/AccessoryManipulationSystem.ts): Sistema de anclajes anatómicos, Grip Sockets y acople de accesorios sin penetración.

### Componentes Base y Controladores
7. [`examples/svg-character/SvgGeometricMascot.tsx`](examples/svg-character/SvgGeometricMascot.tsx): Mascota vectorial SVG paramétrica con expresiones faciales y filtros nativos.
8. [`examples/procedural-2d-character/Procedural2DRig.ts`](examples/procedural-2d-character/Procedural2DRig.ts): Rigging 2D con Two-Bone IK analítico.
9. [`examples/procedural-3d-character/ProceduralRobotMesh.ts`](examples/procedural-3d-character/ProceduralRobotMesh.ts): Construcción procedural de árbol 3D con pivotes anatómicos correctos.
10. [`examples/procedural-materials/ToonFresnelShader.ts`](examples/procedural-materials/ToonFresnelShader.ts): Shader Toon GLSL con escalonamiento difuso y Fresnel Rim de marca.
11. [`examples/character-animation/CharacterAnimationEngine.ts`](examples/character-animation/CharacterAnimationEngine.ts): Motor de cinemática con respiración de volumen constante y 0 GC.
12. [`examples/interactive-mascot/InteractiveMascotController.tsx`](examples/interactive-mascot/InteractiveMascotController.tsx): Mascota 3D React integrada con cursor tracking, FSM y cleanup de GPU.
13. [`examples/audio-reactive-character/AudioReactiveMascot.ts`](examples/audio-reactive-character/AudioReactiveMascot.ts): Síntesis Web Audio de SFX procedurales y lip-sync por energía RMS.

---

## 6. Reglas de Calidad y Guardrails Innegociables

1. **Protocolo Anti-Genericidad Obligatorio**: Queda prohibido entregar la primera solución que combine un cuerpo redondeado y ojos brillantes. Toda propuesta de personaje con libertad creativa debe incluir al menos 3 conceptos contrastantes de silueta y material antes del código final.
2. **Separación Estricta de 3 Capas**: Queda prohibido acoplar lógica de decisión o FSM dentro de los constructores de mallas o shaders. Las intenciones deciden, las acciones planifican y el rig dibuja.
3. **Anticipación y Recuperación Obligatorias**: Ninguna acción principal (señalar, saltar, recoger) puede ejecutarse sin su fase de anticipación física previa y su fase de recuperación amortiguada.
4. **Cero Penetraciones en Agarre de Objetos**: La mano o pinza debe alinearse de forma matemáticamente exacta con el `GripSocket` del accesorio.
5. **Cero Garbage Collection en Runtime**: Reutilizar siempre buffers matemáticos (`Vector3`, `Quaternion`, `Euler`) en el render loop.
6. **Accesibilidad Integral**: Respeto estricto a `prefers-reduced-motion` congelando oscilaciones a poses estáticas y ofreciendo controles de audio silenciado.
