# Hands, Fingers, Grasping Kinematics & Object Manipulation

Este documento establece la cinemática de las manos, flexión de dedos, taxonomía de tipos de agarre y algoritmos de alineación de puntos de sujeción (*Grip Sockets*) sin penetración geométrica.

---

## 1. Taxonomía de Agarres Canónicos (Grasp Taxonomy)

La manipulación de objetos no consiste en trasladar el objeto cerca de la muñeca. La mano o pinza debe adoptar una configuración geométrica congruente con la forma del objeto:

```
A. AGARRE DE POTENCIA (Power Grip)         B. AGARRE DE PRECISIÓN (Precision Grip)    C. PINZA ROBÓTICA / MAGNÉTICA
      [ Dedos envuelven cilindro ]              [ Pulgar e índice sostienen tarjeta ]        [ Campo emisor / Dos garras ]
           ┌──────────┐                                  ▲  ▲                                     \       /
         ( ( Objeto ) )                                 ┌┴──┴┐                                     ( Objeto )
           └──────────┘                                 │Card│                                    /       \
      Palma en contacto firme                  Puntas de dedos en oposición               Fuerza centrada en el eje
```

| Tipo de Agarre | Morfología de Contacto | Ejemplos de Objetos | Configuración Articular de la Mano |
|---|---|---|---|
| **Power Grip (Potencia)** | Cilindro cerrado; dedos 100% flexionados, pulgar traba. | Tazas, botellas, antorchas, bates, herramientas pesadas. | Falanges proximales: 75°, intermedias: 85°, pulgar opuesto: 60°. |
| **Precision Grip (Precisión)** | Yemas de los dedos en contacto opuesto. | Lápices, llaves, punteros, smartphones, tarjetas. | Falanges proximales: 30°, intermedias: 25°, pulgar en arco: 45°. |
| **Pinch Grip (Pinza fina)** | Contacto bimanual o pulgar-índice en punta. | Monedas, cables, fichas pequeñas, agujas. | Dedos 3, 4 y 5 cerrados; índice y pulgar en contacto directo en punta. |
| **Flat Palm (Sostén plano)** | Palma extendida hacia arriba ($+Y$ local). | Libros abiertos, bandejas, paquetes, regalos. | Todos los dedos extendidos planos (0° flexión), muñeca supinada 90°. |
| **Magnetic Docking (Robótico)** | Efector terminal sin dedos individuales; haz de luz. | Cubos de datos, esferas de energía, orbes flotantes. | Emisión de luz al 200%, anillo exterior rota, objeto flota a 2 cm. |

---

## 2. Puntos de Agarre y Transformación de Acople (*Grip Sockets*)

Un objeto interactivo debe definir **puntos de anclaje de agarre (*Grip Sockets*)**, especificando la posición y orientación exacta donde la palma o pinza debe encajar:

```typescript
export interface GripSocket {
  socketId: string;
  preferredGraspType: 'power' | 'precision' | 'pinch' | 'flat_palm' | 'magnetic';
  relativePosition: [number, number, number]; // Offset desde el centro del objeto
  relativeRotation: [number, number, number]; // [Pitch, Yaw, Roll]
  clearanceRadius: number;                   // Radio de protección contra colisiones
}

export interface ManipulableObjectMetadata {
  id: string;
  name: string;
  boundingRadius: number;
  weightCategory: 'light' | 'medium' | 'heavy';
  gripSockets: GripSocket[];
}
```

---

## 3. Algoritmo de Sujeción y Prevención de Penetración

Al agarrar un objeto, el efector de la mano se traslada al `GripSocket` y luego el objeto se convierte en **hijo jerárquico del nodo de la muñeca (*Parent Constraint*)**:

```typescript
export class ObjectGraspController {
  private attachedObject: THREE.Object3D | null = null;
  private currentSocket: GripSocket | null = null;

  /**
   * Acopla el objeto a la mano alineando el socket con la palma
   */
  public attachObjectToHand(
    handNode: THREE.Object3D,
    objectNode: THREE.Object3D,
    socket: GripSocket
  ): void {
    this.attachedObject = objectNode;
    this.currentSocket = socket;

    // 1. Desvincular de la escena global manteniendo su matriz de mundo
    objectNode.parent?.remove(objectNode);

    // 2. Vincular como hijo del nodo de la mano
    handNode.add(objectNode);

    // 3. Aplicar offset inverso del GripSocket para que el punto de contacto coincida con la palma
    objectNode.position.set(
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
    objectNode.quaternion.setFromEuler(euler);
  }

  /**
   * Libera el objeto de la mano y lo devuelve a la escena mundial con velocidad de impulso
   */
  public releaseObjectToWorld(
    sceneRoot: THREE.Object3D,
    releaseImpulse: [number, number, number] = [0, 0, 0]
  ): THREE.Object3D | null {
    if (!this.attachedObject) return null;

    const obj = this.attachedObject;
    // Capturar posición mundial actual antes de desvincular
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    obj.getWorldPosition(worldPos);
    obj.getWorldQuaternion(worldQuat);

    // Mover de nuevo a la escena mundial
    obj.parent?.remove(obj);
    sceneRoot.add(obj);

    obj.position.copy(worldPos);
    obj.quaternion.copy(worldQuat);

    this.attachedObject = null;
    this.currentSocket = null;
    return obj;
  }
}
```

---

## 4. Transferencia Bimanual de Objetos (Hand-to-Hand Transfer)

Para pasar un objeto de la mano izquierda a la mano derecha:
1. **Fase de Aproximación**: Ambas manos convergen en el centro del pecho ($X = 0, Y = 0.2, Z = 0.4$).
2. **Fase de Contacto Doble**: La mano derecha cierra su pinza en el segundo `GripSocket` del objeto mientras la izquierda todavía sostiene.
3. **Fase de Liberación**: La mano izquierda abre los dedos; la mano derecha asume el parentesco jerárquico del objeto.
4. **Fase de Despeje**: La mano izquierda retrocede a postura de reposo mientras la derecha exhibe el objeto.
