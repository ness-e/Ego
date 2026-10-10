# Accessories, Dynamic Wardrobe & Attachment Socket Architecture

Este documento formaliza el sistema modular para equipar, desequipar, transformar y animar accesorios sobre personajes de marca sin reconstruir el modelo base.

---

## 1. El Sistema de Anclajes Anatómicos (*Attachment Sockets*)

Cada personaje expone una colección estandarizada de **Sockets de Anclaje** con matrices de transformación local fijas:

```
                  [ socket: head_crown ] ──> Sombreros, antenas, coronas
                             │
     [ socket: eyes_bridge ] ──> Gafas, visores VR, máscaras
                             │
     [ socket: neck_collar ] ──> Bufandas, corbatas, auriculares al cuello
           /                 │                 \
[ socket: shoulder_left ]    │    [ socket: shoulder_right ] ──> Hombreras, insignias
           │         [ socket: back_pack ]     │               ──> Mochilas, alas, propulsores
           │                 │                 │
[ socket: hand_left ] [ socket: chest_badge ] [ socket: hand_right ] ──> Herramientas, teléfonos
                             │
                     [ socket: waist ] ──> Cinturones, bolsos laterales
```

---

## 2. Definición Tipada del Sistema de Accesorios

```typescript
export type AttachmentSocketId =
  | 'head_crown'
  | 'eyes_bridge'
  | 'neck_collar'
  | 'back_pack'
  | 'chest_badge'
  | 'shoulder_left'
  | 'shoulder_right'
  | 'hand_left'
  | 'hand_right'
  | 'waist'
  | 'floating_orbit';

export interface AccessoryDefinition {
  id: string;
  name: string;
  category: 'wardrobe' | 'handheld' | 'floating' | 'mechanical';
  targetSocket: AttachmentSocketId;
  localOffset: [number, number, number];
  localRotation: [number, number, number];
  localScale: [number, number, number];
  meshGenerator: () => THREE.Object3D;
  hasPhysics: boolean;
  physicsDamping?: number;
}
```

---

## 3. Gestor de Equipamiento e Intercambio en Runtime (`AccessoryWardrobeManager`)

```typescript
export class AccessoryWardrobeManager {
  private characterSockets: Map<AttachmentSocketId, THREE.Group> = new Map();
  private equippedAccessories: Map<string, THREE.Object3D> = new Map();

  /**
   * Registra un nodo pivote del personaje como socket disponible
   */
  public registerSocket(socketId: AttachmentSocketId, socketGroup: THREE.Group): void {
    this.characterSockets.set(socketId, socketGroup);
  }

  /**
   * Equipa un accesorio en el socket correspondiente con transición suave
   */
  public equipAccessory(def: AccessoryDefinition, animateEntrance: boolean = true): THREE.Object3D | null {
    const socket = this.characterSockets.get(def.targetSocket);
    if (!socket) {
      console.warn(`[Wardrobe] Socket no encontrado: ${def.targetSocket}`);
      return null;
    }

    // Retirar accesorio previo si ocupa el mismo id
    this.unequipAccessory(def.id);

    const accessoryMesh = def.meshGenerator();
    accessoryMesh.position.set(...def.localOffset);
    const euler = new THREE.Euler(...def.localRotation, 'YXZ');
    accessoryMesh.quaternion.setFromEuler(euler);
    accessoryMesh.scale.set(...def.localScale);

    if (animateEntrance) {
      // Entrada elástica tipo Pop-In
      const targetScale = [...def.localScale];
      accessoryMesh.scale.set(0.001, 0.001, 0.001);
      let progress = 0;
      const animatePop = () => {
        progress += 0.08;
        const s = Math.min(1.0, progress);
        const bounce = 1.0 + Math.sin(s * Math.PI) * 0.25;
        accessoryMesh.scale.set(targetScale[0] * s * bounce, targetScale[1] * s * bounce, targetScale[2] * s * bounce);
        if (progress < 1.0) requestAnimationFrame(animatePop);
      };
      animatePop();
    }

    socket.add(accessoryMesh);
    this.equippedAccessories.set(def.id, accessoryMesh);
    return accessoryMesh;
  }

  /**
   * Desequipa y destruye de forma segura los recursos del accesorio
   */
  public unequipAccessory(id: string): void {
    const mesh = this.equippedAccessories.get(id);
    if (!mesh) return;

    mesh.parent?.remove(mesh);
    // Liberar geometrías y materiales
    mesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose());
        else m.material?.dispose();
      }
    });

    this.equippedAccessories.delete(id);
  }
}
```

---

## 4. Accesorios Dinámicos con Inercia Secundaria (Capas y Bufandas)

Para accesorios de vestuario colgantes (colas, bufandas, correas de mochila), se utiliza un **resorte Verlet encadenado de 3 nodos** fijado al socket del cuello o la cintura:

$$\vec{x}_i^{(t+1)} = \vec{x}_i^{(t)} + 0.95 \left( \vec{x}_i^{(t)} - \vec{x}_i^{(t-1)} \right) + \vec{a}_{\text{aceleración\_cuerpo}} \Delta t^2$$

El accesorio responde con retardo natural a los giros y saltos del personaje, dotándolo de ligereza textil sin recurrir a motores de simulación de tela pesados.
