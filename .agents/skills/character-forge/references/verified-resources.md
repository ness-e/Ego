# Verified Technical Resources & Canonical Bibliography

Este documento reúne las fuentes primarias, especificaciones de estándares oficiales y literatura técnica de referencia en gráficos por computadora, animación física y desarrollo web.

---

## 1. Especificaciones de Estándares Web y Documentación Oficial

### 1.1. W3C Scalable Vector Graphics (SVG) 2
- **URL**: `https://www.w3.org/TR/SVG2/`
- **Temas**: Geometría declarativa de trazados (`path data`), reglas de relleno `evenodd`/`nonzero`, filtros nativos, sistemas de coordenadas y matrices de transformación.
- **Cuándo consultar**: Al diseñar personajes vectoriales en SVG y optimizar filtros de resplandor o máscaras de recorte.
- **Dificultad**: Media.

### 1.2. MDN Web Docs — Web Audio API
- **URL**: `https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API`
- **Temas**: `AudioContext`, grafos de nodos, osciladores, envolventes paramétricas con `exponentialRampToValueAtTime`, `AnalyserNode` para FFT en tiempo real.
- **Cuándo consultar**: Al implementar audio procedural, SFX de clics, estados de error y reactividad acústica.
- **Dificultad**: Media-Avanzada.

### 1.3. Three.js Official Documentation
- **URL**: `https://threejs.org/docs/`
- **Temas**: `BufferGeometry`, `MeshPhysicalMaterial`, `ACESFilmicToneMapping`, iluminación PBR, `OrbitControls`, gestión de ciclos de vida (`dispose`).
- **Cuándo consultar**: Al construir mallas procedurales 3D, configurar escenas de estudio y evitar fugas de VRAM en WebGL.
- **Dificultad**: Media.

### 1.4. React Three Fiber (R3F) — Poimandres
- **URL**: `https://docs.pmnd.rs/react-three-fiber`
- **Temas**: Integración declarativa de Three.js en React, `useFrame`, renderizado condicional, punteros espaciales y desacoplamiento de estado.
- **Cuándo consultar**: Al empaquetar personajes 3D como componentes reactivos de React 19.
- **Dificultad**: Media.

### 1.5. Khronos Group — glTF 2.0 Specification
- **URL**: `https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html`
- **Temas**: Formato de transmisión 3D estándar, jerarquías de nodos, materiales PBR metálico-rugosidad, skins esqueléticos y exportación binaria (`.glb`).
- **Cuándo consultar**: Al exportar modelos procedurales para su uso en visores universales o motores de videojuegos.
- **Dificultad**: Avanzada.

---

## 2. Literatura Académica y Textos Fundacionales

### 2.1. "Real-Time Rendering, 4th Edition"
- **Autores**: Tomas Akenine-Möller, Eric Haines, Naty Hoffman, Angelo Pesce, Michał Iwanicki, Sébastien Hillaire.
- **Temas**: Microfacet PBR, GGX normal distribution, cálculo de sombras en tiempo real, transformaciones espaciales y álgebra lineal para gráficos.
- **Módulos relacionados**: `mathematics-and-linear-algebra.md`, `materials-and-pbr.md`, `lighting-optics-and-shadows.md`.

### 2.2. "The Illusion of Life: Disney Animation"
- **Autores**: Frank Thomas, Ollie Johnston.
- **Temas**: Los 12 principios fundamentales de la animación: Squash & Stretch, Anticipación, Inercia, Acción Secundaria, Puesta en Escena y Appeal.
- **Módulos relacionados**: `animation-principles-and-rigging.md`, `art-direction-and-character-design.md`.

### 2.3. "Fix Your Timestep!"
- **Autor**: Glenn Fiedler.
- **URL**: `https://gafferongames.com/post/fix_your_timestep/`
- **Temas**: Integración numérica con acumulador de paso fijo, prevención de explosiones en resortes y desacoplamiento de framerate variable del monitor.
- **Módulos relacionados**: `physics-and-numerical-simulation.md`.

### 2.4. Inigo Quilez — Procedural Shading & Signed Distance Functions
- **URL**: `https://iquilezles.org/articles/`
- **Temas**: SDFs analíticas 2D/3D, ruido de gradiente, smooth minimum (`smin`), derivadas de pantalla y síntesis visual en GPU.
- **Módulos relacionados**: `textures-and-procedural-shaders.md`, `computational-geometry.md`.

### 2.5. W3C Web Content Accessibility Guidelines (WCAG) 2.2
- **URL**: `https://www.w3.org/WAI/standards-guidelines/wcag/`
- **Temas**: Criterio 2.3.3 (`prefers-reduced-motion`), contraste mínimo de luminancia (Criterio 1.4.3 / 1.4.11), accesibilidad auditiva y cognitiva.
- **Módulos relacionados**: `performance-and-accessibility.md`, `visual-identity-and-color.md`.
