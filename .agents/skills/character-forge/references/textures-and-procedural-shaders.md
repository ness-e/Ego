# Textures, Procedural Shaders & Surface Synthesis

Este documento detalla la síntesis procedural de texturas y shaders personalizados en GLSL, permitiendo generar detalles de superficie de alta fidelidad sin descargar imágenes rasterizadas pesadas.

---

## 1. Ruido Procedural: Simplex y Fractal Brownian Motion (fBm)

El uso de texturas PNG/JPG tradicionales introduce latencia de red y consumo de memoria VRAM en la GPU. Mediante algoritmos matemáticos en GLSL, se generan texturas procedurales infinitamente escalables:

```glsl
// Hash rápido 2D sin tablas trigonométricas costosas
vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

// Ruido de Gradiente 2D Continuo (Gradient Noise)
float gradientNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f); // Interpolador hermítico C1

    return mix(mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                   dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
               mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                   dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}

// Fractal Brownian Motion (fBm) para micro-desgaste y textura táctil
float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 4; i++) {
        value += amplitude * gradientNoise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}
```

---

## 2. Diagramas Voronoi / Celulares para Placas y Paneles

Para generar divisiones geométricas de armadura tecnológica o costuras de traje:

```glsl
// Retorna distancia al centro celular más cercano F1 y segundo más cercano F2
vec2 voronoi(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);
    float md = 8.0;
    float md2 = 8.0;

    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash2(n + g) * 0.5 + 0.5;
            vec2 r = g + o - f;
            float d = dot(r, r);

            if (d < md) {
                md2 = md;
                md = d;
            } else if (d < md2) {
                md2 = d;
            }
        }
    }
    return vec2(sqrt(md), sqrt(md2));
}
```
El valor `md2 - md` produce bordes nítidos de juntas mecánicas (*panel borders*) automáticas sin necesidad de modelar ranuras en la geometría.

---

## 3. Triplanar Mapping (Texturizado sin Coordenadas UV)

Al generar geometrías compuestas por código (uniones booleanas, cilindros fusionados), realizar el desenrollado de UVs (*UV Unwrapping*) de forma analítica es complejo.

El **Triplanar Mapping** proyecta la textura desde los tres ejes ortogonales ($X, Y, Z$) y mezcla las muestras basándose en la normal del vértice:

```glsl
vec4 sampleTriplanar(sampler2D tex, vec3 worldPos, vec3 worldNormal, float scale) {
    // Pesos de mezcla basados en la normal absoluta elevada a una potencia
    vec3 blendWeights = pow(abs(worldNormal), vec3(4.0));
    blendWeights /= (blendWeights.x + blendWeights.y + blendWeights.z);

    // Proyecciones ortogonales
    vec4 colX = texture2D(tex, worldPos.yz * scale);
    vec4 colY = texture2D(tex, worldPos.xz * scale);
    vec4 colZ = texture2D(tex, worldPos.xy * scale);

    return colX * blendWeights.x + colY * blendWeights.y + colZ * blendWeights.z;
}
```

---

## 4. Normal Mapping Procedural vía Derivadas de Pantalla

Para generar relieve micro-táctil (rugosidad de vinilo granulado o cuero sintético) sin texturas de normales empaquetadas, se calcula la pertubación de la normal a partir de una función de altura $h(x, y)$ usando derivadas de hardware (`dFdx` / `dFdy`):

```glsl
vec3 perturbNormalArb(vec3 surf_pos, vec3 surf_norm, float height) {
    vec3 vSigmaX = dFdx(surf_pos);
    vec3 vSigmaY = dFdy(surf_pos);
    vec3 vN = surf_norm;

    vec3 R1 = cross(vSigmaY, vN);
    vec3 R2 = cross(vN, vSigmaX);

    float fDet = dot(vSigmaX, R1);
    float dHx = dFdx(height);
    float dHy = dFdy(height);

    vec3 vGrad = sign(fDet) * (dHx * R1 + dHy * R2);
    return normalize(abs(fDet) * surf_norm - vGrad);
}
```
Esto dota al personaje de micro-detalle de superficie con resolución infinita a cualquier distancia de cámara.
