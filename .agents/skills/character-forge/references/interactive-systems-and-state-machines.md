# Interactive Systems, Finite State Machines & Application Architecture

Este documento formaliza la arquitectura de integración de personajes en aplicaciones web y de escritorio, utilizando Máquinas de Estados Finitas (FSM) formales, Statecharts desacoplados y sistemas de eventos de alta prioridad.

---

## 1. La Arquitectura Desacoplada de 4 Capas

Para evitar componentes monolíticos inmanejables, el personaje se organiza en 4 capas estrictas:

```
[ CAPA 1: ENTRADA / EVENTOS ]  ──> Mouse, Teclado, Touch, Red, Estado Global de la App
               │
               v
[ CAPA 2: MÁQUINA DE ESTADOS ] ──> FSM / Statechart (Transiciones, Prioridades, Guardas)
               │
               v
[ CAPA 3: SIMULACIÓN & FÍSICA] ──> Resortes simplécticos, IK, Amortiguamiento, Clamps
               │
               v
[ CAPA 4: RENDERIZADO VISUAL ] ──> SVG DOM / Canvas 2D / Three.js / WebGL Shaders
```

---

## 2. Máquina de Estados Finita Tipada con Prioridades y Guardas

Una FSM ingenua permite que cualquier evento interrumpa a otro. En producción, **ciertos eventos tienen prioridad jerárquica** (ej. un `ERROR` crítico de red interrumpe inmediatamente una animación pasiva de `IDLE` o `THINKING`):

```typescript
export type CharacterStateId =
  | 'idle'
  | 'noticing'
  | 'tracking'
  | 'thinking'
  | 'success'
  | 'error'
  | 'celebrating'
  | 'sleeping';

export type CharacterEvent =
  | { type: 'POINTER_ENTER' }
  | { type: 'POINTER_LEAVE' }
  | { type: 'TASK_START' }
  | { type: 'TASK_SUCCESS' }
  | { type: 'TASK_ERROR'; message?: string }
  | { type: 'SYSTEM_SLEEP' }
  | { type: 'TIMEOUT' };

export interface StateNode {
  priority: number; // 0 (baja) a 10 (urgencia crítica)
  onEnter?: () => void;
  onExit?: () => void;
  transitions: Partial<Record<CharacterEvent['type'], CharacterStateId>>;
}
```

### 2.1. Motor de Estados Ejecutable con Prevención de Bloqueos:
```typescript
export class CharacterStateMachine {
  private currentState: CharacterStateId = 'idle';
  private stateTimer: number = 0;
  private readonly states: Record<CharacterStateId, StateNode> = {
    idle: {
      priority: 1,
      transitions: {
        POINTER_ENTER: 'noticing',
        TASK_START: 'thinking',
        TASK_ERROR: 'error',
        SYSTEM_SLEEP: 'sleeping',
      },
    },
    noticing: {
      priority: 2,
      transitions: {
        TIMEOUT: 'tracking',
        POINTER_LEAVE: 'idle',
        TASK_START: 'thinking',
        TASK_ERROR: 'error',
      },
    },
    tracking: {
      priority: 2,
      transitions: {
        POINTER_LEAVE: 'idle',
        TASK_START: 'thinking',
        TASK_ERROR: 'error',
      },
    },
    thinking: {
      priority: 4,
      transitions: {
        TASK_SUCCESS: 'success',
        TASK_ERROR: 'error',
      },
    },
    success: {
      priority: 5,
      transitions: {
        TIMEOUT: 'idle',
        TASK_ERROR: 'error',
      },
    },
    error: {
      priority: 8, // Alta prioridad: nada interrumpe el error salvo un timeout de recuperación
      transitions: {
        TIMEOUT: 'idle',
        TASK_START: 'thinking',
      },
    },
    celebrating: {
      priority: 6,
      transitions: {
        TIMEOUT: 'idle',
      },
    },
    sleeping: {
      priority: 1,
      transitions: {
        POINTER_ENTER: 'noticing',
        TASK_START: 'thinking',
      },
    },
  };

  public transition(event: CharacterEvent): boolean {
    const currentNode = this.states[this.currentState];
    const targetStateId = currentNode.transitions[event.type];

    if (!targetStateId) return false;

    const targetNode = this.states[targetStateId];
    // Verificar si el nuevo estado tiene jerarquía suficiente
    if (targetNode.priority >= currentNode.priority || event.type === 'TIMEOUT') {
      if (currentNode.onExit) currentNode.onExit();
      this.currentState = targetStateId;
      this.stateTimer = 0;
      if (targetNode.onEnter) targetNode.onEnter();
      return true;
    }
    return false;
  }

  public update(dt: number): void {
    this.stateTimer += dt;
    // Auto-transición por timeout para estados transitorios
    if (this.currentState === 'noticing' && this.stateTimer >= 0.25) {
      this.transition({ type: 'TIMEOUT' });
    } else if ((this.currentState === 'success' || this.currentState === 'error') && this.stateTimer >= 2.0) {
      this.transition({ type: 'TIMEOUT' });
    }
  }

  public getState(): CharacterStateId {
    return this.currentState;
  }
}
```

---

## 3. Integración en Flujos de Producto y Event Buses

Para conectar el personaje con llamadas a APIs asíncronas de la aplicación:

```typescript
export function bindCharacterToAsyncAction<T>(
  fsm: CharacterStateMachine,
  asyncAction: () => Promise<T>
): Promise<T> {
  fsm.transition({ type: 'TASK_START' });

  return asyncAction()
    .then((result) => {
      fsm.transition({ type: 'TASK_SUCCESS' });
      return result;
    })
    .catch((error) => {
      fsm.transition({ type: 'TASK_ERROR', message: error.message });
      throw error;
    });
}
```
Esto garantiza que la mascota responda automáticamente a la realidad de la aplicación sin acoplar código de UI en los servicios backend.
