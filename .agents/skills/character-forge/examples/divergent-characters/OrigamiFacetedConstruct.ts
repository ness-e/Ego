import * as THREE from 'three';

/**
 * OrigamiFacetedConstruct — Demostración de personaje no convencional basado en Origami y Paper Craft
 * Sustituye las esferas y curvas suaves por poliedros facetados con normales planas (Flat Shading) y pliegues nítidos.
 */
export function buildOrigamiFacetedConstruct(): {
  root: THREE.Group;
  headPivot: THREE.Group;
  materials: { paperBodyMat: THREE.MeshStandardMaterial; paperDarkMat: THREE.MeshStandardMaterial };
} {
  const root = new THREE.Group();

  // 1. Material de papel mate no reflectante con textura de fibra
  const paperBodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f5efe6'), // Tono papel kraft claro / pergamino
    roughness: 0.96,
    metalness: 0.0,
    flatShading: true, // Forzar caras planas triangulares sin suavizado
  });

  const paperDarkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2c3e50'), // Azul tinta oscuro para pliegues de acento
    roughness: 0.92,
    metalness: 0.0,
    flatShading: true,
  });

  // 2. Torso: Prisma hexagonal facetado invertido (centro de masa alto)
  const torsoGeo = new THREE.CylinderGeometry(0.65, 0.35, 0.9, 6).toNonIndexed();
  torsoGeo.computeVertexNormals();
  const torso = new THREE.Mesh(torsoGeo, paperBodyMat);
  torso.position.y = -0.1;
  root.add(torso);

  // Pliegue pectoral en ángulo
  const foldGeo = new THREE.ConeGeometry(0.3, 0.4, 4).toNonIndexed();
  foldGeo.computeVertexNormals();
  const foldMesh = new THREE.Mesh(foldGeo, paperDarkMat);
  foldMesh.rotation.x = Math.PI / 2;
  foldMesh.position.set(0, 0.1, 0.42);
  root.add(foldMesh);

  // 3. Cabeza: Dodecaedro truncado facetado (sin visor ni esferas)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.45, 0);
  root.add(headPivot);

  const headGeo = new THREE.DodecahedronGeometry(0.55, 0).toNonIndexed();
  headGeo.computeVertexNormals();
  const headMesh = new THREE.Mesh(headGeo, paperBodyMat);
  headMesh.position.y = 0.35;
  headPivot.add(headMesh);

  // Ojos: Ranuras geométricas angulares de papel oscuro incrustadas en las caras planas
  const eyeFoldGeo = new THREE.BoxGeometry(0.18, 0.04, 0.06);
  const eyeL = new THREE.Mesh(eyeFoldGeo, paperDarkMat);
  eyeL.rotation.z = 0.25; // Inclinación asimétrica en arista
  eyeL.position.set(-0.24, 0.38, 0.46);
  headPivot.add(eyeL);

  const eyeR = new THREE.Mesh(eyeFoldGeo, paperDarkMat);
  eyeR.rotation.z = -0.25;
  eyeR.position.set(0.24, 0.38, 0.46);
  headPivot.add(eyeR);

  // 4. Orejas / Antenas en pliegue piramidal agudo
  const earGeo = new THREE.ConeGeometry(0.14, 0.55, 3).toNonIndexed();
  earGeo.computeVertexNormals();

  const earL = new THREE.Mesh(earGeo, paperDarkMat);
  earL.rotation.set(0, 0, 0.35);
  earL.position.set(-0.48, 0.75, 0);
  headPivot.add(earL);

  const earR = new THREE.Mesh(earGeo, paperDarkMat);
  earR.rotation.set(0, 0, -0.35);
  earR.position.set(0.48, 0.75, 0);
  headPivot.add(earR);

  return { root, headPivot, materials: { paperBodyMat, paperDarkMat } };
}
