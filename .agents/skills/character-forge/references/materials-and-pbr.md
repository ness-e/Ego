# Physically Based Rendering (PBR), Microfacet Models & Material Crafting

Este documento formaliza la teoría del renderizado basado en física (PBR) y el modelo de microfacetas de Cook-Torrance para formular materiales convincentes de calidad táctil.

---

## 1. La Ecuación de Reflectancia y el Modelo de Cook-Torrance

La luz saliente $L_o$ en una dirección $\vec{v}$ sobre un punto de la superficie se modela mediante la integral de renderizado:

$$L_o(p, \vec{v}) = \int_{\Omega} \left( f_d + f_s \right) L_i(p, \vec{l}) \left( \vec{n} \cdot \vec{l} \right) d\vec{l}$$

Donde la componente especular microfaceta $f_s$ se define analíticamente mediante la ecuación de Cook-Torrance:

$$f_s = \frac{D(\vec{h}) \cdot F(\vec{v}, \vec{h}) \cdot G(\vec{l}, \vec{v}, \vec{h})}{4 \left( \vec{n} \cdot \vec{l} \right) \left( \vec{n} \cdot \vec{v} \right)}$$

Con $\vec{h} = \frac{\vec{l} + \vec{v}}{\|\vec{l} + \vec{v}\|}$ siendo el vector medio (*half-vector*).

```
   Normal de Superficie N
            ^             Half-Vector H
            |            /
            |           /     Luz L      Visión V
            |          /        \        /
            |         /          \      /
       ─────┴────────┴────────────\────/─────  (Microfacetas orientadas)
```

### 1.1. Las Tres Funciones Fundamentales del Modelo:
1. **Distribución Normal $D(\vec{h})$ (GGX / Trowbridge-Reitz)**:  
   Modela la concentración estadística de microfacetas alineadas con $\vec{h}$:
   $$D_{\text{GGX}}(\vec{h}) = \frac{\alpha^2}{\pi \left( (\vec{n} \cdot \vec{h})^2 (\alpha^2 - 1) + 1 \right)^2}, \quad \alpha = \text{Roughness}^2$$
2. **Geometría y Auto-Oclusión $G(\vec{l}, \vec{v})$ (Smith con Schlick-GGX)**:  
   Modela el ensombrecimiento mutuo de microfacetas:
   $$G(\vec{l}, \vec{v}) = G_1(\vec{l}) \cdot G_1(\vec{v}), \quad G_1(\vec{x}) = \frac{\vec{n} \cdot \vec{x}}{(\vec{n} \cdot \vec{x})(1 - k) + k}$$
3. **Reflectancia de Fresnel $F(\vec{v}, \vec{h})$ (Aproximación de Schlick)**:  
   Determina la fracción de luz reflejada frente a la refractada:
   $$F(\vec{v}, \vec{h}) = F_0 + (1 - F_0) \left( 1 - (\vec{v} \cdot \vec{h}) \right)^5$$

---

## 2. Dieléctricos vs Conductores (Metalness Workflow)

La diferenciación física entre materiales aísla errores comunes de textura:

```
Tipo de Material     Reflectancia Base F0             Comportamiento Difuso
───────────────────────────────────────────────────────────────────────────────────────────
Dieléctricos         Monocromático bajo:              La luz penetra, se dispersa y emerge
(Plástico, Madera,   F0 ≈ 0.04 (4% especular rasante) con el color de base (Albedo).
Cerámica, Goma)      Reflejos especulares blancos.

Conductores          Policromático alto:              Absorción cuántica instantánea.
(Oro, Cobre,         F0 = Color del Metal (70-95%)    Cero componente difuso:
Aluminio, Cromo)     Reflejos especulares tintados.   Albedo = Negro puro (0, 0, 0).
```

---

## 3. Catálogo de Recetas PBR de Producción para Mascotas

Configuraciones numéricas exactas para mallas de Three.js / R3F:

### 3.1. Vinilo Coleccionable de Arte ("Vinyl Designer Toy")
Acabado táctil sedoso con barniz superior de laca brillante:
```typescript
export const VinylToyMaterialConfig = {
  roughness: 0.18,
  metalness: 0.02,
  clearcoat: 0.9,          // Capa de laca de vinilo
  clearcoatRoughness: 0.06, // Pulido espejo en capa externa
  ior: 1.52,               // Índice de refracción típico de resina plástica
  reflectivity: 0.55,
};
```

### 3.2. Cerámica Mate Suave ("Apple-like Soft Touch")
Superficie difusa sin brillo especular discernible:
```typescript
export const MatteCeramicMaterialConfig = {
  roughness: 0.82,
  metalness: 0.0,
  clearcoat: 0.0,
  ior: 1.45,
};
```

### 3.3. Aluminio Cepillado Tecnológico (Articulaciones y Conectores)
Estructura mecánica con alta anisotropía aparente:
```typescript
export const BrushedMetalMaterialConfig = {
  roughness: 0.32,
  metalness: 0.92,
  color: '#64748b',
};
```

### 3.4. Visor Translúcido Ahumado (Pantallas Oculares)
Simulación de policarbonato con atenuación volumétrica:
```typescript
export const SmokedVisorMaterialConfig = {
  roughness: 0.12,
  metalness: 0.1,
  transmission: 0.85,      // Luz atraviesa el material
  thickness: 0.4,          // Grosor simulado para refracción
  ior: 1.58,               // Policarbonato
  attenuationColor: '#0a101f',
  attenuationDistance: 0.3,
};
```

---

## 4. Subsurface Scattering (SSS) Estilizado para Extremidades

Para dar sensación de vida a partes orgánicas (orejas, manos) sin el costo de trazado de rayos volumétrico, se aplica la aproximación de **Pre-Integrated Skin / SSS Rápido** en el fragment shader:

```glsl
// Aproximación rápida de SSS en GLSL
vec3 calculateStylizedSSS(vec3 lightDir, vec3 normal, vec3 viewDir, vec3 subColor, float distortion, float power) {
    vec3 sssLight = lightDir + normal * distortion;
    float sssDot = pow(clamp(dot(viewDir, -sssLight), 0.0, 1.0), power);
    return subColor * sssDot;
}
```
Esto genera un cálido resplandor interno traslúcido cuando una luz brillante incide a contraluz.
