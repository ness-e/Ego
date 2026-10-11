# Soft Materials, Fur, Shaders & Tactile Surfaces

Este módulo define las técnicas de sombreado PBR, microgeometría, pelusa (*fuzz*), pelaje (*fur*) y materiales táctiles para mascotas 3D en Three.js / WebGL.

---

## 1. Niveles de Complejidad de Sombreado

### Nivel A: Superficie Suave Estilizada (Cero Coste de Fibras)
* **Arquitectura:** `MeshPhysicalMaterial` con aproximación de tela / microvellosidades (*peach-fuzz*).
* **Parámetros Clave:**
  - `roughness: 0.85` – Dispersión difusa envolvente sin especular duro.
  - `metalness: 0.0` – Dieléctrico puro.
  - `sheen: 1.0` – Resplandor Fresnel en ángulos tangenciales simulando vellón.
  - `sheenRoughness: 0.5` – Amplitud angular del resplandor de fibra.
  - `sheenColor: #ffffff` (o tono más claro que el albedo).
  - `transmission: 0.05`, `thickness: 0.8` – Simulación económica de dispersión subsuperficial (SSS).
* **Rendimiento:** 1 draw call, compatible con cualquier GPU móvil o desktop integrada.

### Nivel B: Microtextura y Fuzz Shader (Pelusa Visual en Silueta)
* **Técnica:** Shader personalizado con rim-scattering y mapa de ruido de alta frecuencia triplanar.
* **Ecuación de Rim Scattering de Fibra:**
  $$I_{\text{fuzz}} = \left(1.0 - \max(0, N \cdot V)\right)^{\gamma} \cdot \text{noise3D}(P \cdot f) \cdot C_{\text{rim}}$$
* Inyección de micro-fuzz en el fragment shader: las fibras solo se hacen visibles en el contorno rasante de la silueta donde la luz atraviesa la pelusa exterior, sin emborronar el centro del volumen.

### Nivel C: Shell Fur (Capas Concéntricas de Pelaje)
* **Técnica:** Extrusión de $N$ mallas concéntricas ($N \in [8, 16]$) a lo largo de las normales de vértice:
  $$P_k = P_0 + N \cdot \left(\frac{k}{N}\right) \cdot L_{\text{hair}}$$
* Cada capa $k$ utiliza un mapa de opacidad con umbral alpha creciente para recortar los extremos de las fibras.
* **Ventajas:** Apariencia de peluche denso y suave en tiempo real sin requerir trazado de curvas en GPU.

### Nivel D: Simulación Cinemática de Fibras
* Desplazamiento dinámico de vértices en el vertex shader según la inercia del movimiento del cuerpo:
  $$P_{\text{shell}}' = P_{\text{shell}} - \frac{\vec{a}_{\text{body}}}{\omega^2} \cdot \left(\frac{k}{N}\right)^2$$
* Produce el efecto realista de que el pelaje se retrasa cuando la criatura salta o se sacude.

---

## 2. Biblioteca de Recetas de Materiales

| ID Receta | Nombre | Base PBR | Parámetros Específicos | Uso Recomendado |
|---|---|---|---|---|
| `mat_short_plush` | Peluche Corto de Algodón | `MeshPhysicalMaterial` | Sheen: 1.0, Roughness: 0.88, BumpNoise: 0.04 | Mascotas de compañía tiernas |
| `mat_velvet_fuzz` | Terciopelo Profundo | `MeshPhysicalMaterial` | Sheen: 1.0, SheenColor: contrast, Roughness: 0.95 | Criaturas elegantes, gatos |
| `mat_soft_rubber` | Vinilo Mate / Goma Art-Toy | `MeshStandardMaterial` | Roughness: 0.45, Clearcoat: 0.15, Transmission: 0.0 | Juguetes de vinilo coleccionables |
| `mat_translucent_gummy` | Gominola / Gel Translúcido | `MeshPhysicalMaterial` | Transmission: 0.92, Thickness: 1.4, IOR: 1.34 | Criaturas fantásticas, slimes |
| `mat_knitted_wool` | Tejido de Punto Artesanal | Custom Shell Shader | NormalMap: trama espiga, Roughness: 0.9 | Muñecos de lana hechos a mano |
| `mat_matte_ceramic` | Porcelana Biscuit | `MeshPhysicalMaterial` | Roughness: 0.35, Clearcoat: 0.05, SSS: 0.1 | Figuras de cerámica nórdica |
