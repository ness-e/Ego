# Action Planning, Behavior Trees & Layered Animation Architecture

Este documento formaliza la arquitectura de toma de decisiones mediante árboles de comportamiento (*Behavior Trees* - BTs) y el sistema de animación por capas concurrentes sin conflictos.

---

## 1. La Arquitectura de Animación en 5 Capas Concurrentes

Para evitar que una acción de brazo anule la respiración del torso o que un parpadeo interrumpa una rotación de cuello, el estado del personaje se evalúa en **5 capas independientes mezcladas por prioridad**:

```
[ CAPA 5: ACCESORIOS & FÍSICA SECUNDARIA ] ──> Inercia de antena, oscilación de bufanda
                    │
[ CAPA 4: ROSTRO & EXPRESIÓN EMOCIONAL ]   ──> Cejas, párpados, visemas, sacadas pupilares
                    │
[ CAPA 3: ORIENTACIÓN & ATENCIÓN (HEAD) ]  ──> Cuello orientado al target de interés (Look-At)
                    │
[ CAPA 2: ACCIÓN PRINCIPAL / MANIPULACIÓN] ──> Brazos, manos con IK, agarre de accesorios
                    │
[ CAPA 1: LOCOMOCIÓN & REPOSO BASE (ROOT)] ──> Respiración, Squash & Stretch, oscilación de peso
```

---

## 2. Árboles de Comportamiento (Behavior Trees - BTs) para Personajes

A diferencia de una FSM simple que se vuelve inmanejable al escalar estados, un **Behavior Tree** modela flujos condicionales jerárquicos:

```
                          [ ? Selector: Decisión Raíz ]
                                   /           \
     [ → Secuencia: Reaccionar a Tarea ]     [ → Secuencia: Idle Exploratorio ]
             /        |        \                      /               \
       (¿Hay Tarea?) [Agarrar] [Mostrar]       [Respirar]        [Mirar Cursor]
```

### 2.1. Nodos Fundamentales de un Behavior Tree:
- **`Sequence (→)`**: Ejecuta sus hijos de izquierda a derecha. Falla si alguno devuelve `FAILURE`. Tiene éxito si todos devuelven `SUCCESS`.
- **`Selector (?)`**: Evalúa sus hijos en orden de prioridad. Tiene éxito en cuanto uno devuelve `SUCCESS`. Falla si todos fallan.
- **`Parallel (⇉)`**: Ejecuta múltiples ramas simultáneamente (ej. caminar mientras saluda con una mano y mira a la cámara).

---

## 3. Implementación Ligera de un Behavior Tree en TypeScript

```typescript
export type BTStatus = 'SUCCESS' | 'FAILURE' | 'RUNNING';

export interface BTNode {
  tick(context: CharacterBehaviorContext): BTStatus;
}

export interface CharacterBehaviorContext {
  hasTargetObject: boolean;
  isObjectInRange: boolean;
  isObjectGrasped: boolean;
  userAcknowledged: boolean;
  planner: IntentActionPlanner;
}

// Nodo Secuencia
export class SequenceNode implements BTNode {
  constructor(private children: BTNode[]) {}

  public tick(context: CharacterBehaviorContext): BTStatus {
    for (const child of this.children) {
      const status = child.tick(context);
      if (status !== 'SUCCESS') return status; // Retorna RUNNING o FAILURE
    }
    return 'SUCCESS';
  }
}

// Nodo Selector
export class SelectorNode implements BTNode {
  constructor(private children: BTNode[]) {}

  public tick(context: CharacterBehaviorContext): BTStatus {
    for (const child of this.children) {
      const status = child.tick(context);
      if (status !== 'FAILURE') return status; // Retorna SUCCESS o RUNNING
    }
    return 'FAILURE';
  }
}
```

---

## 4. Plan de Acción Compuesto: «Recoger Objeto y Mostrar al Usuario»

Modelado como una tarea asíncrona de 6 fases con condiciones de guarda e interrupción:

```typescript
export async function executeFetchAndPresentPlan(
  character: CharacterCompositeRig,
  targetObject: THREE.Object3D,
  gripSocket: GripSocket,
  onUserAcknowledge: Promise<void>
): Promise<void> {
  // 1. Orientación visual hacia el objeto
  await character.lookAtTarget(targetObject.position, 350);

  // 2. Extensión de brazo mediante IK hacia el punto de agarre
  await character.reachArmToPoint('right', targetObject.position, 400);

  // 3. Sujeción geométrica (Grasp)
  character.graspController.attachObjectToHand(character.rightHandNode, targetObject, gripSocket);

  // 4. Elevación y presentación hacia la cámara
  const presentationTarget = new THREE.Vector3(0, 0.3, 0.45);
  await Promise.all([
    character.reachArmToPoint('right', presentationTarget, 500),
    character.setFacialExpression('pride', 400),
    character.lookAtCamera(400),
  ]);

  // 5. Esperar confirmación del usuario (clic o evento de interfaz)
  await onUserAcknowledge;

  // 6. Retorno suave a reposo
  await Promise.all([
    character.retractArmToRest('right', 350),
    character.setFacialExpression('satisfaction', 300),
  ]);
}
```
Este pipeline transforma al personaje en un asistente interactivo capaz de ejecutar tareas complejas con fluidez cinematográfica.
