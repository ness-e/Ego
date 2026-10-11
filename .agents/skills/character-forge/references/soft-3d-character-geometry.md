# Soft 3D Character Geometry & Procedural Topology

Este módulo define las directrices matemáticas, algorítmicas y topológicas para modelar y parametrizar mascotas y personajes tridimensionales con acabados suaves, acolchados y orgánicos utilizando Three.js, React Three Fiber y Blender.

---

## 1. Familias Geométricas Base

Para evitar la convergencia en la "esfera con ojos", el sistema soporta seis familias morfológicas primarias:

### A. Superelipsoides 3D Paramétricos
Definidos por la ecuación implícita continua en $\mathbb{R}^3$:
$$\left(\left|\frac{x}{a}\right|^{r} + \left|\frac{y}{b}\right|^{r}\right)^{\frac{t}{r}} + \left|\frac{z}{c}\right|^{t} = 1$$
* $r$ (exponente longitudinal) y $t$ (exponente latitudinal):
  - $r = 2, t = 2$: Elipsoide euclidiano estándar.
  - $r = 2.4, t = 2.7$: Morfología "Mochi / Puff" (base ensanchada, cúpula redondeada).
  - $r \ge 4, t \ge 4$: Prisma cuadrangular con esquinas de cojín ("Cushion Box").
  - $r = 1, t = 1$: Octaedro biconvexo ("Diamante orgánico").

### B. Esferas Deformadas por Ruido Simplex y Atractores
* Malla esferoidal de subdivisión icosaédrica (IcoSphere) donde cada vértice $v_i$ se perturba radialmente:
  $$v_i' = v_i \cdot \left(1 + \sum_{k=1}^3 \frac{A_k}{2^k} \cdot \text{noise3D}(2^k \cdot f \cdot v_i)\right)$$
* Produce organismos bulbosos, masas celulares amigables o criaturas esponjosas asimétricas.

### C. Cápsulas Segmentadas y Morfologías Pera/Gota
* Curvas Bezier 3D de revolución: el radio se modula según la altura normalizada $h \in [0, 1]$:
  $$R(h) = R_0 \cdot (1 - h) + R_1 \cdot h + 4 \cdot \Delta R \cdot h \cdot (1 - h)$$
* Permite cuerpos con centro de masa bajo (estilo art-toy) donde el 60-70% del volumen descansa cerca del suelo.

### D. Superficies de Fusión Suave (Metaballs / SDF Procedurales)
* Fusión de centros de potencial esféricos mediante Smooth Minimum polinómico:
  $$\text{smin}(d_1, d_2, k) = -\frac{1}{k} \ln\left(e^{-k d_1} + e^{-k d_2}\right)$$
* Garantiza transiciones sin costuras entre cabeza, orejas, mejillas y cuerpo sin aristas cortantes.

---

## 2. Parámetros Semánticos de Anatomía

Toda criatura se define a través de un contrato semántico tipado:

```typescript
export interface SoftCharacterGeometryParams {
  bodyFamily: "superellipsoid" | "simplex_blob" | "pear_capsule" | "cushion_cube" | "segmented_duo";
  proportions: {
    headToBodyRatio: number;      // [0.3, 0.8] Relación de tamaño de cabeza
    aspectRatioWidthHeight: number; // [0.7, 1.4] Silueta ancha vs esbelta
    depthRatio: number;           // [0.6, 1.0] Aplanamiento frontal
  };
  curvatureExponents: {
    latitudinalT: number;         // Exponente t
    longitudinalR: number;        // Exponente r
  };
  eyes: {
    spacing: number;              // Distancia interpupilar relativa [0.25, 0.55]
    verticalPitch: number;        // Altura facial [-0.3, 0.2]
    depthProtrusion: number;      // Profundidad de cuenca ocular [0.02, 0.15]
    socketSquircleP: number;      // Geometría del zócalo ocular
  };
  appendages: {
    earsType: "none" | "floppy_rabbit" | "bear_rounded" | "cat_triangular" | "antennae_droop";
    earsScale: number;
    limbsType: "stubby_paws" | "fluffy_nubs" | "invisible_hover";
    asymmetryRatio: number;       // [0.0, 0.15] Variación natural no clónica
  };
  surfaceDisplacement: {
    fuzzRoughnessAmplitude: number; // Altura de micro-irregularidades de felpa
    fuzzFrequency: number;
  };
}
```

---

## 3. Prevención de Defectos Topológicos y Shading

1. **Evitar Polos de Triángulos Pellizcados (Pinch Artifacts):**
   - Prohibido el uso de `SphereGeometry` UV estándar con polos de abanico triangular en la cúspide de la cabeza.
   - Usar mallas cúbicas infladas (**Normalized CubeSphere**) o **Subdivision Surface** cuádruple para garantizar densidad de caras uniforme en el zénith.
2. **Presupuesto Topológico:**
   - Mascota Desktop en tiempo real: $6\,000$ a $18\,000$ triángulos.
   - Nivel Móvil / WebGL ligero: $3\,500$ a $7\,000$ triángulos.
3. **Mapeo UV Libre de Distorsión:**
   - Proyección cilíndrica ecuatorial combinada con mapeo triplanar para texturas de microfibras procedurales.
