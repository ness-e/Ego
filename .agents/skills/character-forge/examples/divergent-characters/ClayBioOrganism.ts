import * as THREE from 'three';

/**
 * ClayBioOrganism — Criatura de arcilla blanda con micro-irregularidades de modelado a mano
 * Emula la estética táctil de Stop-motion / Claymation con deformación de vértices por ruido.
 */
export function buildClayBioOrganism(): {
  root: THREE.Group;
  eyePivot: THREE.Group;
  materials: { clayBodyMat: THREE.MeshStandardMaterial; glassLensMat: THREE.MeshPhysicalMaterial };
} {
  const root = new THREE.Group();

  // 1. Material de Terracota / Arcilla artesanal con rugosidad alta y cero metalicidad
  const clayBodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d97736'), // Terracota cálida
    roughness: 0.92,
    metalness: 0.0,
  });

  const glassLensMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#0f172a'),
    roughness: 0.1,
    metalness: 0.1,
    transmission: 0.8,
    ior: 1.5,
  });

  // 2. Torso Monolítico Asimétrico con micro-deformación procedural de vértices (huellas de modelado)
  const bodyGeo = new THREE.DodecahedronGeometry(0.75, 2);
  const posAttr = bodyGeo.attributes.position;

  // Perturbación analítica de vértices para romper la simetría esférica perfecta
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    // Ondulación no uniforme que simula presión dactilar manual
    const thumbDent = Math.sin(x * 4) * Math.cos(z * 4) * 0.04;
    posAttr.setXYZ(i, x * (1 + thumbDent) * 0.95, y * (1 + thumbDent * 0.5) * 1.15, z * (1 + thumbDent));
  }
  bodyGeo.computeVertexNormals();

  const bodyMesh = new THREE.Mesh(bodyGeo, clayBodyMat);
  bodyMesh.position.y = 0;
  root.add(bodyMesh);

  // 3. Monóculo / Lente central de cristal (Un solo ojo dominante en lugar de dos círculos)
  const eyePivot = new THREE.Group();
  eyePivot.position.set(0, 0.28, 0.62);
  root.add(eyePivot);

  const lensRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.04, 16, 32),
    new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.8 })
  );
  eyePivot.add(lensRing);

  const glassLens = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), glassLensMat);
  glassLens.scale.z = 0.4;
  eyePivot.add(glassLens);

  const pupilDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 16, 16),
    new THREE.MeshBasicMaterial({ color: '#fef08a' }) // Núcleo amarillo ámbar cálido
  );
  pupilDot.position.z = 0.05;
  eyePivot.add(pupilDot);

  return { root, eyePivot, materials: { clayBodyMat, glassLensMat } };
}
