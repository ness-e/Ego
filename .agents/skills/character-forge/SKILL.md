---
name: character-forge
description: Sistema experto de nivel profesional en dirección de arte, modelado procedural 2D/3D, física, cinemática, materiales PBR, síntesis de audio Web Audio e interacción para personajes y mascotas de marca mediante código.
---

# Character Forge — Code-First Character Design & Animation Engineering

Character Forge es un sistema integral de ingeniería visual y desarrollo de software para concebir, formalizar, modelar, animar, sonorizar e implementar **personajes de marca, mascotas digitales y experiencias reactivas mediante código**.

Desacopla la intención estética del renderizado y trata a los personajes como **componentes de software de alto rendimiento**, garantizando que cada elemento cuente con una silueta distinguible, articulaciones anatómicamente coherentes, física estable, shaders PBR calibrados, sonido procedural y cero fugas de memoria en producción.

---

## 1. Activación y Criterios de Selección

Activa esta skill siempre que el usuario solicite:
1. **Diseño e Identidad de Personajes de Marca**: Creación de mascotas corporativas, avatares o sistemas de personajes consistentes con el ADN de un producto.
2. **Modelado y Geometría por Código**: Construcción de personajes en SVG declarativo, mallas tridimensionales `BufferGeometry` procedurales, Canvas 2D o Three.js / React Three Fiber (R3F).
3. **Animación y Simulación Física**: Resortes armónicos amortiguados, cinemática inversa (IK), deformación *Squash & Stretch* con conservación de volumen, inercia de antenas o parpadeo aperiódico.
4. **Materiales, Shaders e Iluminación**: Acabados PBR (*Vinyl Toy*, cerámica, aluminio), shaders Toon con *Fresnel Rim*, iluminación de estudio de 3 puntos o sombras de contacto suaves.
5. **Sonido y Reactividad Acústica**: Efectos de sonido procedurales mediante Web Audio API, análisis FFT de audio o sincronización labial (*lip-sync*) por energía RMS.
6. **Microinteracciones y Máquinas de Estados**: FSM tipadas (`idle`, `tracking`, `thinking`, `success`, `error`), seguimiento de puntero amortiguado con límites angulares o accesibilidad estricta con `prefers-reduced-motion`.

---

## 2. Los 13 Modos de Trabajo (Delivery Modes)

Cada solicitud debe clasificarse en uno de los modos de entrega del sistema:

| Modo de Trabajo | Entregable Principal | Stack Técnico Primario |
|---|---|---|
| **01. Conceptualización & Dirección de Arte** | Ficha de identidad, ratios anatómicos, matriz de atributos y especificaciones de turnaround | Markdown, diagramas ortográficos |
| **02. Diseño Vectorial SVG** | Componente SVG estructurado con grupos articulares y filtros nativos | SVG, React, CSS Custom Properties |
| **03. Personaje 2D Construido por Código** | Rigging 2D procedural con Two-Bone IK y transformaciones de grupos | TypeScript, Canvas 2D / SVG DOM |
| **04. Modelo 3D Procedural** | Mallas `BufferGeometry` generadas directamente en memoria de GPU | Three.js / R3F, TypedArrays |
| **05. Personaje 3D con PBR e Iluminación** | Escena de estudio completa con Cook-Torrance PBR, Fresnel y 3 puntos de luz | Three.js, MeshPhysicalMaterial |
| **06. Animación y Rigging** | Cadenas cinemáticas (FK/IK), easing analítico y loops orgánicos asimétricos | TypeScript, Slerp, Ley del Coseno |
| **07. Microinteracciones de Interfaz** | Patrones de hover, press, feedback de formularios y señalización de CTA | React, Web Animations API, Motion |
| **08. Simulación Física** | Osciladores armónicos simplécticos, Verlet chains y acumulador de tiempo fijo | TypeScript, Integrador Simpléctico |
| **09. Texturas y Shaders** | Shaders GLSL personalizados, ruido Simplex/fBm, Voronoi y normal mapping | GLSL, Three.js ShaderMaterial |
| **10. Sonido y Audio Reactivo** | Síntesis procedural de SFX con envolventes ADSR y reactividad FFT | Web Audio API, AnalyserNode |
| **11. Experiencia Interactiva Completa** | Aplicación o widget 3D interactivo con FSM, puntero y HUD de control | React / Vanilla TS, Three.js |
| **12. Auditoría y Optimización** | Perfilado de draw calls, VRAM, tiempo de frame y corrección de fugas | DevTools, Spector.js, Dispose |
| **13. Integración en Producto** | Empaquetado como componente aislado con props tipadas y desacoplamiento | React 19, TypeScript strict |

---

## 3. Flujo de Ingeniería en 6 Fases (Engineering Pipeline)

```
[01. ANALIZAR] ──> [02. REPRESENTACIÓN] ──> [03. SISTEMA VISUAL]
                         │                         │
                         v                         v
[06. ENTREGA]  <── [05. INTERACCIÓN & FÍSICA] <── [04. CONSTRUCCIÓN CÓDIGO]
```

1. **Fase 01 — Análisis del Encargo y DNA de Marca**: Arquetipo de personalidad, plataforma de ejecución, presupuesto de framerate (60-120 FPS) y restricciones de peso ($<35\text{ KB}$).
2. **Fase 02 — Selección de Representación Técnica**: Selección justificada entre SVG (iconos y UI ligera), Canvas 2D (cientos de partículas) o Three.js/R3F (volumen y profundidad física).
3. **Fase 03 — Sistema Visual Paramétrico**: Proporciones de cabeza a cuerpo, contraste de silueta en 24x24 px, paleta 60-30-10 en espacio OKLCH y matriz de rasgos faciales.
4. **Fase 04 — Construcción Mediante Código**: Generación procedural de mallas o trazados vectoriales, pivotes articulares trasladados al origen biológico y formulación PBR.
5. **Fase 05 — Cinemática, Física y FSM**: Resortes armónicos con integración simpléctica, conservación de volumen en *Squash & Stretch*, inercia secundaria en antenas y máquina de estados finita con prioridades.
6. **Fase 06 — Validación, Accesibilidad y Entrega**: Profiling de draw calls ($\le 10$), cero asignaciones de memoria en rAF, soporte para `prefers-reduced-motion`, semántica ARIA y limpieza obligatoria con `dispose()`.

---

## 4. Índice de Módulos Técnicos Especializados (`references/`)

Consulta la documentación técnica correspondiente según el requerimiento de la tarea:

| Módulo | Archivo Canónico | Contenido Clave |
|---|---|---|
| **Dirección de Arte** | [`art-direction-and-character-design.md`](references/art-direction-and-character-design.md) | Silueta, espacio negativo, lenguaje de formas, proporciones, model sheets y turnaround. |
| **Color y Marca** | [`visual-identity-and-color.md`](references/visual-identity-and-color.md) | Espacio OKLCH, regla 60-30-10, contraste WCAG 2.2 y adaptación a daltonismo. |
| **Matemáticas** | [`mathematics-and-linear-algebra.md`](references/mathematics-and-linear-algebra.md) | Espacios de coordenadas, matrices 4x4, Slerp con cuaterniones, cinemática y PRNGs. |
| **Geometría** | [`computational-geometry.md`](references/computational-geometry.md) | De Casteljau, Catmull-Rom, longitud de arco constante, barrido y raycasting analítico. |
| **Física** | [`physics-and-numerical-simulation.md`](references/physics-and-numerical-simulation.md) | Osciladores armónicos simplécticos, desacoplamiento con acumulador fijo y Verlet chains. |
| **Animación** | [`animation-principles-and-rigging.md`](references/animation-principles-and-rigging.md) | 12 principios clásicos por código, easing analítico, Two-Bone IK y respiración orgánica. |
| **Iluminación** | [`lighting-optics-and-shadows.md`](references/lighting-optics-and-shadows.md) | Atenuación cuadrática, 3 puntos de estudio, bias de sombras, PCF y Blob shadows. |
| **Materiales PBR** | [`materials-and-pbr.md`](references/materials-and-pbr.md) | Cook-Torrance (GGX/Smith/Schlick), recetas Vinyl Toy, cerámica, aluminio y SSS estilizado. |
| **Shaders** | [`textures-and-procedural-shaders.md`](references/textures-and-procedural-shaders.md) | Ruido Simplex/fBm en GLSL, Voronoi, Triplanar mapping y normales por derivadas `dFdx`. |
| **Gráficos 2D** | [`svg-and-2d-graphics.md`](references/svg-and-2d-graphics.md) | Grupos SVG con pivotes, morphing de trazados cúbicos, filtros y Canvas 2D con Path2D. |
| **Modelado 3D** | [`procedural-3d-modeling.md`](references/procedural-3d-modeling.md) | `BufferGeometry` con TypedArrays, ADN de personajes paramétricos y exportación glTF/GLB. |
| **Sistemas FSM** | [`interactive-systems-and-state-machines.md`](references/interactive-systems-and-state-machines.md) | FSM tipada con prioridades y guardas, desacoplamiento de capas y binding a promesas. |
| **Microinteracciones** | [`microinteractions-and-motion-design.md`](references/microinteractions-and-motion-design.md) | Presupuestos temporales (100-400ms), señalamiento hacia CTA y feedback háptico. |
| **Audio Web** | [`sound-design-and-web-audio.md`](references/sound-design-and-web-audio.md) | Síntesis procedural con osciladores y envolventes ADSR, análisis FFT y lip-sync por RMS. |
| **Post-Procesado** | [`rendering-and-postprocessing.md`](references/rendering-and-postprocessing.md) | Tone mapping ACES Filmic, Bloom selectivo, Viñeteado GLSL y sistemas de partículas. |
| **Arquitectura** | [`architecture-and-code-quality.md`](references/architecture-and-code-quality.md) | Principios SOLID, cero allocs en el render loop (0 GC) y protocolo de cleanup WebGL. |
| **Rendimiento** | [`performance-and-accessibility.md`](references/performance-and-accessibility.md) | Presupuestos medidos, suspensión por IntersectionObserver y `prefers-reduced-motion`. |
| **Validación** | [`testing-and-visual-validation.md`](references/testing-and-visual-validation.md) | Ciclo Render-Critique-Fix, suite de pruebas unitarias y rúbrica cuantitativa de calidad. |
| **Bibliografía** | [`verified-resources.md`](references/verified-resources.md) | Fuentes oficiales primarias verificadas: W3C SVG/WCAG, MDN, Three.js, Khronos y libros. |

---

## 5. Colección Canónica de Ejemplos Ejecutables (`examples/`)

La carpeta `examples/` contiene implementaciones completas de referencia:

1. [`examples/svg-character/SvgGeometricMascot.tsx`](examples/svg-character/SvgGeometricMascot.tsx): Mascota vectorial paramétrica con expresiones analíticas y filtros de resplandor.
2. [`examples/procedural-2d-character/Procedural2DRig.ts`](examples/procedural-2d-character/Procedural2DRig.ts): Controlador de extremidades con Two-Bone IK analítico.
3. [`examples/procedural-3d-character/ProceduralRobotMesh.ts`](examples/procedural-3d-character/ProceduralRobotMesh.ts): Construcción procedural de árbol 3D con pivotes anatómicamente correctos.
4. [`examples/procedural-materials/ToonFresnelShader.ts`](examples/procedural-materials/ToonFresnelShader.ts): Shader Toon GLSL con escalonamiento difuso y Fresnel Rim de marca.
5. [`examples/character-animation/CharacterAnimationEngine.ts`](examples/character-animation/CharacterAnimationEngine.ts): Motor de animación con respiración de volumen constante, look-at y parpadeo aleatorio.
6. [`examples/interactive-mascot/InteractiveMascotController.tsx`](examples/interactive-mascot/InteractiveMascotController.tsx): Mascota 3D React integrada con cursor tracking, FSM y cleanup de GPU.
7. [`examples/audio-reactive-character/AudioReactiveMascot.ts`](examples/audio-reactive-character/AudioReactiveMascot.ts): Síntesis Web Audio de chirps y cálculo de visemas por energía RMS.

---

## 6. Reglas de Trabajo del Modelo (Guardrails Innegociables)

1. **Cero Asignaciones en el Render Loop**: Queda terminantemente prohibido hacer `new Vector3()`, instanciar objetos o crear funciones anónimas dentro de `useFrame`, `requestAnimationFrame` o hooks a 60 FPS. Todo vector debe pre-asignarse en el scope superior o en un `useMemo`.
2. **Pivotes Articulares Obligatorios**: Todo miembro que rote (cabeza, brazos, párpados, antenas) debe rotar desde su articulación biológica, jamás desde su centro geométrico.
3. **Respeto Absoluto a la Accesibilidad**: Si el usuario activa `prefers-reduced-motion`, el personaje debe suspender movimientos continuos, oscilaciones elásticas y rotaciones, pasando a una pose estática neutra. El audio nunca debe reproducirse automáticamente sin interacción previa.
4. **Desacoplamiento Estricto**: No mezclar la lógica de la FSM o cinemática con el renderizado visual. La física y la máquina de estados deben ser comprobables mediante pruebas unitarias sin requerir el DOM o WebGL.
5. **No Inventar APIs ni Resultados**: Verificar nombres de métodos, firmas y compatibilidad en Three.js, React y especificaciones web. Distinguir con rigor entre una revisión estática y una validación en entorno de ejecución real.
