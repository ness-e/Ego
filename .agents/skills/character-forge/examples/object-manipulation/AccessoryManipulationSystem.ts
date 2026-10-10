import * as THREE from 'three';
import { AttachmentSocketId, AccessoryDefinition } from '../../references/accessories-and-attachment-system';
import { GripSocket } from '../../references/hands-and-object-manipulation';

/**
 * AccessoryManipulationSystem — Maneja el equipamiento de accesorios y la sujeción de objetos
 * Garantiza transformaciones relativas estables sin penetraciones ni pérdidas de jerarquía.
 */
export class AccessoryManipulationSystem {
  private sockets: Map<AttachmentSocketId, THREE.Group> = new Map();
  private equippedMeshes: Map<string, THREE.Object3D> = new Map();
  private graspedObject: { object: THREE.Object3D; originalParent: THREE.Object3D } | null = null;

  public registerSocket(id: AttachmentSocketId, group: THREE.Group): void {
    this.sockets.set(id, group);
  }

  /**
   * Equipa un accesorio estático o dinámico en el socket anatómico
   */
  public equip(def: AccessoryDefinition): THREE.Object3D | null {
    const socketNode = this.sockets.get(def.targetSocket);
    if (!socketNode) return null;

    this.unequip(def.id);

    const mesh = def.meshGenerator();
    mesh.position.set(...def.localOffset);
    const euler = new THREE.Euler(...def.localRotation, 'YXZ');
    mesh.quaternion.setFromEuler(euler);
    mesh.scale.set(...def.localScale);

    socketNode.add(mesh);
    this.equippedMeshes.set(def.id, mesh);
    return mesh;
  }

  public unequip(id: string): void {
    const mesh = this.equippedMeshes.get(id);
    if (!mesh) return;

    mesh.parent?.remove(mesh);
    this.disposeHierarchy(mesh);
    this.equippedMeshes.delete(id);
  }

  /**
   * Agarra un objeto del entorno acoplándolo a la mano mediante un GripSocket
   */
  public graspObject(
    handSocket: THREE.Group,
    objectToGrasp: THREE.Object3D,
    socket: GripSocket
  ): void {
    const originalParent = objectToGrasp.parent || objectToGrasp;
    this.graspedObject = { object: objectToGrasp, originalParent };

    // Reparenting jerárquico hacia el nodo de la mano
    objectToGrasp.parent?.remove(objectToGrasp);
    handSocket.add(objectToGrasp);

    // Alinear con el socket de agarre
    objectToGrasp.position.set(
      -socket.relativePosition[0],
      -socket.relativePosition[1],
      -socket.relativePosition[2]
    );
    const euler = new THREE.Euler(
      -socket.relativeRotation[0],
      -socket.relativeRotation[1],
      -socket.relativeRotation[2],
      'YXZ'
    );
    objectToGrasp.quaternion.setFromEuler(euler);
  }

  /**
   * Libera el objeto agarrado devolviéndolo a la escena mundial
   */
  public releaseObject(sceneRoot: THREE.Object3D): THREE.Object3D | null {
    if (!this.graspedObject) return null;

    const { object } = this.graspedObject;
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    object.getWorldPosition(worldPos);
    object.getWorldQuaternion(worldQuat);

    object.parent?.remove(object);
    sceneRoot.add(object);
    object.position.copy(worldPos);
    object.quaternion.copy(worldQuat);

    this.graspedObject = null;
    return object;
  }

  private disposeHierarchy(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material?.dispose();
      }
    });
  }
}
