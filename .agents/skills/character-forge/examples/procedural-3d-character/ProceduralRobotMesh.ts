import * as THREE from 'three';

export interface RobotTheme {
  primaryHex: string;
  accentHex: string;
  jointHex: string;
}

/**
 * ProceduralRobotMesh — Construye el árbol completo de objetos 3D de la mascota
 * Garantiza que cada extremidad tenga su nodo pivote centrado en la articulación biológica.
 */
export function buildProceduralRobot(theme: RobotTheme): {
  root: THREE.Group;
  headPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  antennaPivot: THREE.Group;
  materials: {
    bodyMat: THREE.MeshPhysicalMaterial;
    emissiveMat: THREE.MeshStandardMaterial;
    jointMat: THREE.MeshStandardMaterial;
  };
} {
  const root = new THREE.Group();

  // 1. Materiales PBR
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(theme.primaryHex),
    roughness: 0.18,
    metalness: 0.04,
    clearcoat: 0.85,
    clearcoatRoughness: 0.08,
  });

  const emissiveMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#001525'),
    emissive: new THREE.Color(theme.accentHex),
    emissiveIntensity: 2.0,
    roughness: 0.15,
  });

  const jointMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme.jointHex),
    roughness: 0.45,
    metalness: 0.35,
  });

  const darkVisorMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#090d16'),
    roughness: 0.15,
    metalness: 0.6,
  });

  // 2. Torso Cilíndrico Squircle
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.58, 0.84, 32), bodyMat);
  torso.position.y = -0.12;
  root.add(torso);

  // Emblema en el pecho
  const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 24), emissiveMat);
  emblem.rotation.x = Math.PI / 2;
  emblem.position.set(0, -0.06, 0.55);
  root.add(emblem);

  // 3. Cabeza (Pivote en Cuello: Y = 0.42)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.42, 0);
  root.add(headPivot);

  const headHousing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.86, 0.88), bodyMat);
  headHousing.position.y = 0.44;
  headPivot.add(headHousing);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.56, 0.08), darkVisorMat);
  visor.position.set(0, 0.44, 0.44);
  headPivot.add(visor);

  // Ojos esféricos dentro del visor
  const eyeGeo = new THREE.SphereGeometry(0.095, 16, 16);
  const eyeL = new THREE.Mesh(eyeGeo, emissiveMat);
  eyeL.position.set(-0.25, 0.44, 0.485);
  headPivot.add(eyeL);

  const eyeR = new THREE.Mesh(eyeGeo, emissiveMat);
  eyeR.position.set(0.25, 0.44, 0.485);
  headPivot.add(eyeR);

  // 4. Antena con Pivote Elástico
  const antennaPivot = new THREE.Group();
  antennaPivot.position.set(0, 0.95, 0);
  headPivot.add(antennaPivot);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8), jointMat);
  stem.position.y = 0.14;
  antennaPivot.add(stem);

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 16), emissiveMat);
  beacon.position.y = 0.32;
  antennaPivot.add(beacon);

  // 5. Hombros y Brazos
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.68, 0.16, 0);
  root.add(leftArmPivot);

  const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), jointMat);
  leftArmPivot.add(shoulderL);

  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.48, 16), bodyMat);
  armL.position.y = -0.26;
  leftArmPivot.add(armL);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.68, 0.16, 0);
  root.add(rightArmPivot);

  const shoulderR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), jointMat);
  rightArmPivot.add(shoulderR);

  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.48, 16), bodyMat);
  armR.position.y = -0.26;
  rightArmPivot.add(armR);

  return {
    root,
    headPivot,
    leftArmPivot,
    rightArmPivot,
    antennaPivot,
    materials: { bodyMat, emissiveMat, jointMat },
  };
}
