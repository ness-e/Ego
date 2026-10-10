# Craft Surfaces, Artisanal Finishes & Experimental Shaders

Este documento formaliza la síntesis de superficies no convencionales inspiradas en la artesanía física y materiales experimentales, superando los materiales PBR genéricos mediante formulaciones analíticas en GLSL.

---

## 1. Cerámica Agrietada Kintsugi (Voronoi + Grieta de Oro)

El arte tradicional japonés del *Kintsugi* repara grietas de cerámica con barniz espolvoreado en oro. En GLSL, las fracturas se sintetizan analíticamente evaluando la frontera entre células de Voronoi:

```glsl
// Shader de Cerámica Kintsugi con vetas de oro
uniform vec3 uCeramicColor; // ej: Blanco marfil o arcilla oscura
uniform vec3 uGoldColor;    // ej: Dorado #d4af37
uniform float uCrackScale;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Distancia analítica al borde de la célula de Voronoi
float voronoiBorder(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;

    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = vec2(hash(n + g), hash(n + g + 13.0));
            vec2 r = g + o - f;
            float d = dot(r, r);
            if (d < d1) {
                d2 = d1;
                d1 = d;
            } else if (d < d2) {
                d2 = d;
            }
        }
    }
    // La frontera celular ocurre donde d2 - d1 se aproxima a cero
    return sqrt(d2) - sqrt(d1);
}

void main() {
    float borderDist = voronoiBorder(vUv * uCrackScale);
    float isCrack = 1.0 - smoothstep(0.01, 0.04, borderDist);

    // Cerámica mate (roughness alta) vs Veta de oro metálica brillante
    vec3 baseColor = mix(uCeramicColor, uGoldColor, isCrack);
    float metalness = isCrack * 0.95;
    float roughness = mix(0.75, 0.15, isCrack);

    gl_FragColor = vec4(baseColor, 1.0);
}
```

---

## 2. Fieltro Textil y Pelusa Rasante ("Peach Fuzz / Velvet Shader")

Para recrear figuras de fieltro cosidas o muñecos artesanales de lana, se utiliza un sombreado difuso modificado donde **los bordes rasantes acumulan una micro-pelusa brillante suave**:

```glsl
// Shader de Fieltro Artesanal (Velvet / Fuzz)
uniform vec3 uFeltColor;
uniform vec3 uFuzzColor;

varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Efecto Velvet invertido: la luz se dispersa fuertemente en ángulos rasantes
    float NdotV = clamp(dot(normal, viewDir), 0.0, 1.0);
    float fuzz = pow(1.0 - NdotV, 2.2);

    vec3 finalColor = mix(uFeltColor, uFuzzColor, fuzz * 0.7);
    gl_FragColor = vec4(finalColor, 1.0);
}
```

---

## 3. Grabado en Linóleo Procedural (Cross-Hatching Shader)

Para personajes con estética de estampa editorial o grabado clásico en madera, la iluminación no produce un gradiente continuo, sino **tramas de líneas paralelas cuya densidad y grosor responden a la luz**:

```glsl
// Shader de Grabado / Linograbado con líneas procedurales
uniform vec3 uInkColor;
uniform vec3 uPaperColor;
uniform vec3 uLightDir;

varying vec2 vUv;
varying vec3 vNormal;

void main() {
    vec3 normal = normalize(vNormal);
    float NdotL = clamp(dot(normal, normalize(uLightDir)), 0.0, 1.0);

    // Frecuencia de tramas de grabado
    float linePattern1 = sin((vUv.x + vUv.y) * 160.0);
    float linePattern2 = sin((vUv.x - vUv.y) * 160.0);

    float ink = 0.0;
    if (NdotL < 0.75 && linePattern1 > 0.0) ink = 1.0;
    if (NdotL < 0.45 && linePattern2 > 0.0) ink = 1.0;
    if (NdotL < 0.20) ink = 1.0; // Sombra densa completa

    vec3 finalColor = mix(uPaperColor, uInkColor, ink);
    gl_FragColor = vec4(finalColor, 1.0);
}
```

---

## 4. Iridiscencia de Película Delgada (Thin-Film Interference)

Para personajes biomecánicos, visores de escarabajo o titanio anodizado, el color especular varía según el ángulo de incidencia y el grosor de la película nanoscópica:

$$\lambda_{\text{constructiva}} = 2 \cdot d \cdot \sqrt{n^2 - \sin^2\theta}$$

Donde $d$ es el grosor de la película y $n$ el índice de refracción, produciendo un arcoíris metálico hipnótico sin usar texturas de imagen.
