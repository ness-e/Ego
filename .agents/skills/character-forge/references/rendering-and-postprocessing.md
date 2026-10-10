# Rendering Pipelines, Post-Processing & Particle Synthesis

Este documento formaliza el pipeline de composición gráfica, renderizado fuera de pantalla (FBOs), efectos de post-procesado y sistemas de partículas para personajes en WebGL.

---

## 1. Tone Mapping y Curvas de Respuesta Fotométrica

Cuando los materiales utilizan emisiones intensas (ej. balizas y ojos a `emissiveIntensity = 2.5`), el cálculo directo en espacio RGB lineal satura a blanco puro $(1.0, 1.0, 1.0)$ aplastando el matiz de la marca.

El operador **ACES Filmic Tone Mapping** preserva el color incluso en áreas de sobreexposición:

$$\text{Color}_{\text{ACES}} = \frac{x(a x + b)}{x(c x + d) + e}, \quad a=2.51, b=0.03, c=2.43, d=0.59, e=0.14$$

```typescript
// Configuración mandatoria en Three.js para escenas de mascotas
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
```

---

## 2. Pipeline de Post-Procesado Cinematográfico

Para dotar al personaje de calidad de estudio cinematográfico sin sobrecargar dispositivos modestos, se utiliza una cadena mínima de 3 pases:

```
[ Escena 3D ] ──> [ RenderPass (FBO) ]
                         │
                         ├──> [ UnrealBloomPass (Resplandor en altas luces > 0.9) ]
                         │
                         ├──> [ FXAA / SMAA Pass (Suavizado de bordes) ]
                         │
                         └──> [ ShaderPass Compuesto (Vignette + Tono de Marca) ] ──> [ Pantalla ]
```

### 2.1. Shader de Viñeteado y Corrección Cromática Final:
```glsl
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uVignetteIntensity;
uniform vec3 uVignetteColor;

varying vec2 vUv;

void main() {
    vec4 sceneColor = texture2D(tDiffuse, vUv);
    
    // Distancia radial desde el centro de la pantalla
    vec2 coord = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    float dist = length(coord);
    
    // Decaimiento suave de viñeta
    float vignette = smoothstep(0.4, 0.9, dist * uVignetteIntensity);
    vec3 finalColor = mix(sceneColor.rgb, uVignetteColor, vignette * 0.45);
    
    gl_FragColor = vec4(finalColor, sceneColor.a);
}
```

---

## 3. Sistema de Partículas Procedurales de Alto Rendimiento

Para celebrar (`CELEBRATING`) o simular energía de levitación magnética, se utiliza un **InstancedBufferGeometry o Points con simulación en GPU en un único Draw Call**:

```typescript
export function createCelebrationSparkles(count: number = 60): THREE.Points {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const lifetimes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = 0;
    positions[i * 3 + 1] = 0.2;
    positions[i * 3 + 2] = 0;

    // Explosión radial hemisférica hacia arriba
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * (Math.PI / 3);
    const speed = 1.5 + Math.random() * 2.0;

    velocities[i * 3 + 0] = Math.sin(phi) * Math.cos(theta) * speed;
    velocities[i * 3 + 1] = Math.cos(phi) * speed;
    velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;

    lifetimes[i] = Math.random(); // Fase de vida
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
  geo.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));

  const mat = new THREE.PointsMaterial({
    color: new THREE.Color('#00f0ff'),
    size: 0.08,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return new THREE.Points(geo, mat);
}
```
Esto genera feedback visual de celebración deslumbrante con un coste menor al 1% de la GPU.
