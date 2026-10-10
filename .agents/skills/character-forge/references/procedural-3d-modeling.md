# Procedural 3D Modeling, Mesh Generation & Parametric DNA

Este documento formaliza la construcción de mallas poligonales tridimensionales directamente por código, la parametrización de familias de personajes mediante ADN procedural y la exportación de geometrías.

---

## 1. Generación de Mallas a Bajo Nivel (`BufferGeometry`)

En lugar de cargar archivos estáticos pesados, se construyen geometrías óptimas asignando directamente *TypedArrays* en memoria de la GPU:

```typescript
import * as THREE from 'three';

/**
 * Genera una geometría cilíndrica biselada (Squircle 3D) con normales analíticas
 */
export function buildBeveledCylinder(
  radius: number,
  height: number,
  bevelRadius: number,
  segmentsRadial: number = 32
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const halfH = height / 2;

  // Generación de vértices por anillos cilíndricos
  for (let yStep = 0; yStep <= 2; yStep++) {
    const y = yStep === 0 ? -halfH : yStep === 1 ? 0 : halfH;
    const currentRadius = yStep === 1 ? radius : radius - bevelRadius;

    for (let i = 0; i <= segmentsRadial; i++) {
      const theta = (i / segmentsRadial) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      positions.push(currentRadius * cosT, y, currentRadius * sinT);
      normals.push(cosT, yStep === 0 ? -0.5 : yStep === 2 ? 0.5 : 0, sinT);
      uvs.push(i / segmentsRadial, yStep / 2);
    }
  }

  // Generación de índices triangulares
  const ringStride = segmentsRadial + 1;
  for (let yStep = 0; yStep < 2; yStep++) {
    for (let i = 0; i < segmentsRadial; i++) {
      const a = yStep * ringStride + i;
      const b = (yStep + 1) * ringStride + i;
      const c = (yStep + 1) * ringStride + (i + 1);
      const d = yStep * ringStride + (i + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}
```

---

## 2. Sistema de ADN Paramétrico (Parametric Character Families)

Un sistema de personajes no debe duplicar clases para cada variante. Se define un **Genotipo Paramétrico** que genera fenotipos geométricos coherentes:

```typescript
export interface CharacterDNA {
  // Parámetros de masa y proporciones
  headWidth: number;          // 0.8 a 1.4
  headHeight: number;         // 0.7 a 1.2
  headRoundness: number;      // 0.0 (cubo puro) a 1.0 (esfera pura)
  torsoSlenderness: number;   // 0.6 (robusto) a 1.3 (estilizado)
  
  // Rasgos faciales
  eyeSpacing: number;         // 0.3 a 0.6
  eyeSize: number;            // 0.06 a 0.14
  visorDepth: number;         // 0.02 a 0.08
  
  // Extremidades y accesorios
  armLength: number;          // 0.4 a 0.9
  hasAntenna: boolean;
  antennaStyle: 'single_beacon' | 'dual_sensor' | 'dish' | 'none';
  earStyle: 'capsule' | 'cone' | 'rings' | 'none';
}
```

### 2.1. Generador Determinista de ADN a partir de una Semilla:
```typescript
import { Mulberry32PRNG } from './mathematics-and-linear-algebra';

export function generateDNAFromSeed(seed: number): CharacterDNA {
  const rng = new Mulberry32PRNG(seed);
  return {
    headWidth: rng.range(0.9, 1.3),
    headHeight: rng.range(0.8, 1.1),
    headRoundness: rng.range(0.3, 0.8),
    torsoSlenderness: rng.range(0.7, 1.2),
    eyeSpacing: rng.range(0.35, 0.55),
    eyeSize: rng.range(0.08, 0.12),
    visorDepth: rng.range(0.04, 0.07),
    armLength: rng.range(0.45, 0.75),
    hasAntenna: rng.next() > 0.2,
    antennaStyle: rng.next() > 0.5 ? 'single_beacon' : 'dual_sensor',
    earStyle: rng.next() > 0.4 ? 'capsule' : 'none',
  };
}
```

---

## 3. Exportación a Formato Estándar glTF/GLB en Runtime

Cuando se requiera guardar el personaje modelado proceduralmente o enviarlo a un visor externo, se serializa a glTF binario (.glb) usando `GLTFExporter` de Three.js:

```typescript
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export function exportCharacterToGLB(characterRoot: THREE.Object3D): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      characterRoot,
      (gltf) => {
        if (gltf instanceof ArrayBuffer) {
          resolve(gltf);
        } else {
          reject(new Error('Se esperaba salida binaria GLB'));
        }
      },
      (error) => reject(error),
      { binary: true }
    );
  });
}
```
Esto garantiza total interoperabilidad entre generación por código y pipelines 3D tradicionales.
