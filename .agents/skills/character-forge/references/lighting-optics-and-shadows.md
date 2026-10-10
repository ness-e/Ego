# Lighting, Optics, Shadows & Studio Cinematography

Este documento formaliza la óptica física, el cálculo de sombras en tiempo real y las técnicas de iluminación cinematográfica para resaltar siluetas de marca en entornos 2D y 3D.

---

## 1. Óptica Física y Atenuación Lumínica

En un motor de renderizado físico, la intensidad de una fuente puntual o de foco decae según la **Ley del Inverso del Cuadrado de la Distancia**:

$$E(d) = \frac{\Phi}{4\pi d^2}$$

Para evitar que la intensidad tienda a infinito cuando $d \to 0$, se utiliza la formulación físicamente plausible con atenuación acotada:

$$E(d) = \frac{I_0}{\max(d, d_{\text{min}})^2} \cdot \left[1 - \left(\frac{d}{d_{\text{max}}}\right)^4\right]^+$$

```typescript
export function calculatePhysicalLightAttenuation(
  distance: number,
  intensity: number,
  cutoffRadius: number
): number {
  if (distance >= cutoffRadius) return 0;
  const dClamped = Math.max(distance, 0.05);
  const falloff = Math.pow(1 - Math.pow(distance / cutoffRadius, 4), 2);
  return (intensity / (dClamped * dClamped)) * Math.max(0, falloff);
}
```

---

## 2. Temperatura de Color y Ratios de Iluminación de Estudio

La iluminación de un personaje no debe configurarse con colores arbitrarios saturados. Se utiliza la escala de temperatura de Planck en grados Kelvin ($K$):

```
       1800K               3200K               5600K               7500K
     Vela / Fuego     Tungsteno Cálido     Luz de Día Neutra    Cielo Azul Frío
  (Naranja rojizo)       (Dorado suave)        (Blanco puro)       (Azul suave)
```

### 2.1. Ratios de Contraste Clásicos para Personajes:
- **Key-to-Fill Ratio (3:1 a 4:1)**:
  - *Key Light* (Luz principal): 100% intensidad, $45^\circ$ lateral, $35^\circ$ elevación. Tono neutro-cálido ($5000\text{ K}$).
  - *Fill Light* (Luz de relleno): 25-33% intensidad, ángulo opuesto a la Key. Tono frío difuso ($6500\text{ K}$) para desaturar sombras y evitar negros puros.
  - *Rim / Back Light* (Contraluz de silueta): 100-150% intensidad, ubicada detrás del personaje a $180^\circ$. **Alineada obligatoriamente con el color de acento de la marca** para recortar el contorno del personaje sobre el fondo de la página.

---

## 3. Teoría de Sombras y Mitigación de Artefactos

El cálculo de sombras mediante *Shadow Maps* proyecta la escena desde el punto de vista de la luz sobre un *Depth Buffer*.

### 3.1. Artefactos Canónicos y su Mitigación:
```
  [ Shadow Acne ]                         [ Peter Panning ]
(Patrón de muaré parásito              (La sombra flota separada
   por discretización)                     de los pies del modelo)
        ██▒▒██▒▒                                 ┌─────┐
     ───────────────                             │     │
                                                 └─────┘
                                                    ▲ (Espacio de aire)
                                                ░░░░░░░░ (Sombra)
Solución: Bias dependiente de la normal     Solución: Depth Bias fino + Contact Shadows
```

### 3.2. Slope-Scaled Depth Bias:
$$b = b_{\text{base}} + b_{\text{slope}} \cdot \tan\left(\arccos(\vec{N} \cdot \vec{L})\right)$$

Cuando la superficie es rasante a la luz ($\vec{N} \cdot \vec{L} \to 0$), el sesgo de profundidad aumenta automáticamente para erradicar el *Shadow Acne* sin provocar *Peter-panning*.

### 3.3. Percentage-Closer Soft Shadows (PCF) con Poisson Disk Sampling:
Para simular la penumbra suave producida por el tamaño finito del emisor de luz, se muestrea el mapa de profundidad con una distribución de Poisson:

```glsl
// GLSL PCF con 8 muestras de Poisson
const vec2 poissonDisk[8] = vec2[](
    vec2(-0.326, -0.406), vec2(-0.840, -0.074),
    vec2(-0.696,  0.457), vec2(-0.203,  0.621),
    vec2( 0.962, -0.195), vec2( 0.473, -0.480),
    vec2( 0.519,  0.767), vec2( 0.185, -0.893)
);

float sampleShadowPCF(sampler2D shadowMap, vec4 shadowCoord, float filterRadius) {
    vec3 projCoords = shadowCoord.xyz / shadowCoord.w;
    float currentDepth = projCoords.z;
    if (currentDepth > 1.0) return 1.0;

    float shadow = 0.0;
    for (int i = 0; i < 8; i++) {
        vec2 offset = poissonDisk[i] * filterRadius;
        float pcfDepth = texture2D(shadowMap, projCoords.xy + offset).r;
        shadow += (currentDepth - 0.002 > pcfDepth) ? 0.0 : 1.0;
    }
    return shadow / 8.0;
}
```

---

## 4. Sombras Falsas de Alto Rendimiento (Contact / Blob Shadows)

En interfaces web ligeras o dispositivos móviles, renderizar mapas de sombras en cada frame puede saturar el ancho de banda de la GPU. La alternativa superior es una **Sombra de Contacto Proyectada Analítica**:

```typescript
export function getContactShadowTransform(
  characterPositionY: number,
  characterScale: [number, number, number]
): { scale: number; opacity: number } {
  // Cuando el personaje salta en el aire (Y > 0), la sombra se expande y se desvanece
  const height = Math.max(0, characterPositionY);
  const falloff = 1.0 / (1.0 + height * 2.2);

  return {
    scale: characterScale[0] * (1.0 + height * 0.35),
    opacity: Math.max(0.08, 0.45 * falloff),
  };
}
```
Esto entrega fidelidad visual convincente a coste computacional cero en la GPU.
