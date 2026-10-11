# Matriz de Capacidades y Compatibilidad Técnica por Renderizador (Render Capability Matrix)

Este módulo establece la correspondencia formal entre las técnicas visuales del personaje y las tecnologías de renderizado disponibles, garantizando que el sistema elija la herramienta más económica y eficiente sin prometer capacidades incompatibles.

---

## 1. Matriz de Capacidades Verificadas

| Capacidad Técnica | Canvas 2D Nativo | SVG Declarativo | WebGL / Three.js | Tauri 2 / Nativo |
|---|---|---|---|---|
| **Geometría Superelipsoidal** | ✅ Aproximación analítica | ⚠️ Muestreo denso de `<path>` | ✅ Nativo (`BufferGeometry`) | ✅ Canvas / Metal / DirectX |
| **Normales de Superficie** | ⚠️ Derivadas analíticas en CPU | ❌ Incompatible | ✅ Nativo por vértice/píxel | ✅ Shaders nativos |
| **Materiales PBR (Cook-Torrance)**| ❌ Incompatible (Aproximado) | ❌ Incompatible | ✅ Nativo (`MeshPhysicalMaterial`) | ✅ HLSL / MSL shaders |
| **Máscaras y Oclusión por Capas** | ✅ `ctx.clip()` / Compositing | ✅ `<mask>` / `<clipPath>` | ✅ Z-Buffer / Stencil buffer | ✅ Nativo por hardware |
| **Reutilización `Path2D`** | ✅ Nativo (Alto rendimiento) | ✅ Elementos DOM cacheados | ❌ N/A (Usa VBOs) | ✅ Nativo |
| **Filtros de Turbulencia / Ruido** | ⚠️ Procedural en CPU / ImageData| ✅ `<feTurbulence>` nativo | ✅ Fragment Shaders GLSL | ✅ Shaders en GPU |
| **Click-Through Passthrough** | ❌ Requiere API del SO | ❌ Requiere API del SO | ❌ Requiere API del SO | ✅ Nativo (`set_ignore_cursor_events`) |
| **Ventana Transparente Flotante** | ❌ Requiere host desktop | ❌ Requiere host desktop | ❌ Requiere host desktop | ✅ Nativo (`transparent: true`) |
| **Audio Procedural** | ✅ Web Audio API | ❌ N/A (Audio en JS) | ❌ N/A (Audio en JS) | ✅ Web Audio / Rodio / Cpal |
| **Coste de GPU / Batería** | **Casi Nulo (< 1%)** | **Muy Bajo (1–3%)** | **Medio-Alto (4–15%)** | **Nulo-Medio según backend** |

---

## 2. Criterios de Selección Tecnológica

```
¿El personaje requiere deformación continua 3D completa, rigging esquelético multimiembro o iluminación PBR estricta?
  ├── SÍ ──> Utilizar Three.js / WebGL con BufferGeometry procedural.
  └── NO ──> ¿Es una mascota flotante de escritorio ligera o compañero desktop?
               ├── SÍ ──> Utilizar Canvas 2D + Geometría Analítica 2.5D + Tauri 2.
               └── NO ──> ¿Es iconografía interactiva web o componente UI integrado?
                            ├── SÍ ──> Utilizar SVG Declarativo en React.
                            └── NO ──> Utilizar Canvas 2D estándar.
```
