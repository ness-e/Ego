# Morphological Diversity, Non-Euclidean Silhouettes & Structural Topology

Este documento formaliza la construcción de morfologías no convencionales, explorando siluetas facetadas, estructuras huecas, cuerpos laminares y anatomías asimétricas para evitar la repetición de figuras esféricas.

---

## 1. Familias Morfológicas Estructurales

En lugar de ensamblar esferas y cilindros, se exploran 5 familias topológicas alternativas:

```
A. FACETADA / CRISTALINA           B. HUECA / ANULAR (TOROIDAL)        C. LAMINAR / CAPAS SUPERPUESTAS
         /\                                     ┌─────┐                           │ │ │
        /  \   (Poliedros de arista)            │ ( ) │  (Núcleo vacío)           │ │ │ (Planos de papel
       /____\                                   └─────┘                           │ │ │  o silueta 2.5D)
         ||                                      /   \                            /   \

D. MONOLÍTICA SIN CUELLO           E. MODULAR FLOTANTE / ENJAMBRE      F. ASIMÉTRICA FUNCIONAL
       ┌────────┐                               ┌─┐                               ┌────────┐
       │ (o  o) │ (Cabeza integrada             └─┘   (Bloques unidos             │ (o.o)  │====[Brazo Grúa]
       │  Torso │  en un solo bloque)       ┌─┐     ┌─┐ por campos de             │  Torso │
       └────────┘                           └─┘  ●  └─┘ fuerza magnética)         └───┬────┘---[Pinza fina]
```

| Familia Topológica | Características de Silueta | Técnica en Código | Contexto de Marca Ideal |
|---|---|---|---|
| **Facetada / Cristalina** | Aristas vivas, normales planas (*Flat Shading*), reflejos angulares. | `BufferGeometry` con caras indexadas no suavizadas o prismas de Voronoi. | Analítica, precisión de datos, criptografía, fintech sólida. |
| **Hueca / Anular** | Espacio negativo interior; el "corazón" o energía flota en el centro vacío. | `TorusGeometry` o extrusión de polígonos con perforación analítica. | IA generativa, computación cuántica, plataformas abiertas. |
| **Laminar / De Capas** | Planos paralelos superpuestos con espesor milimétrico (estilo papel/madera). | Planos extruidos finos con desplazamiento en Z y sombras inter-capa. | Diseño editorial, educación, productos sostenibles y culturales. |
| **Monolítica Continua** | Sin cuello; la cabeza y el torso forman un solo volumen escultórico. | Superelipses truncadas o cilindros trapezoidales biselados. | Seguridad, almacenamiento en la nube, robustez industrial. |
| **Modular / Enjambre** | 3 a 5 piezas geométricas independientes que orbitan un núcleo común. | Nodos hijos independientes con cinemática de flotación desacoplada. | Microservicios, arquitecturas distribuidas, cloud computing. |
| **Asimétrica Funcional** | Extremidad izquierda masiva (herramienta) y derecha de alta precisión. | Nodos con escalas y jerarquías anatómicas deliberadamente desiguales. | DevOps, ingeniería de software, automatización industrial. |

---

## 2. Parámetros de Diversidad Morfológica en TypeScript

```typescript
export interface MorphologicalProfile {
  topologyFamily: 'faceted' | 'toroidal_hollow' | 'layered_laminar' | 'monolithic' | 'modular_swarm' | 'asymmetric_tool';
  headToBodyMassRatio: number; // 0.15 (cabeza minúscula tipo coloso) a 0.85 (personaje todo cabeza)
  centerOfMassY: number;       // -0.5 (pesado en el suelo) a +0.5 (pesado arriba / triángulo invertido)
  asymmetryFactor: number;     // 0.0 (simétrico) a 0.75 (fuertemente asimétrico)
  voidVolumeRatio: number;     // 0.0 (sólido) a 0.45 (hueco interior prominente)
  contourComplexity: number;   // 4 (perfil cuadrangular simple) a 24 (silueta quebrada rica)
}
```

---

## 3. Construcción de Geometría Facetada sin Suavizado

Para crear un personaje cristalino o de origami con aristas que reflejen la luz limpiamente:

```typescript
import * as THREE from 'three';

export function buildFacetedCrystalHead(radius: number = 0.8): THREE.BufferGeometry {
  // Utiliza un icosaedro base pero recalcula normales para forzar Flat Shading
  const baseGeo = new THREE.IcosahedronGeometry(radius, 0);
  const nonIndexed = baseGeo.toNonIndexed(); // Duplica vértices por cara para aristas duras
  nonIndexed.computeVertexNormals();
  return nonIndexed;
}
```
Este simple cambio en la topología rompe de inmediato la estética de "pelota plástica" y otorga presencia geométrica distintiva.
