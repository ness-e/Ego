# Acting, Non-Verbal Communication & Intent-Driven Behavior

Este documento formaliza el sistema de actuación digital (*digital acting*) y comunicación no verbal para personajes de marca y avatares interactivos, superando las animaciones estáticas aisladas para convertir al personaje en un agente creíble con intenciones y propósitos claros.

---

## 1. El Paradigma de Actuación por Intenciones

Un personaje no debe cambiar de animación de forma reactiva instantánea al recibir un evento. La actuación creíble se descompone en **5 Fases Obligatorias de Comportamiento**:

```
[ 1. Postura Inicial ] ──> [ 2. Anticipación ] ──> [ 3. Acción Principal ]
                                                          │
[ 5. Recuperación / Reposo ] <── [ 4. Reacción Secundaria ] ◄┘
```

```
Fase                       Función Dramática / Cinemática                     Duración Típica
─────────────────────────────────────────────────────────────────────────────────────────────
1. Postura Inicial         Estado de reposo o postura previa del personaje.    Indefinido
2. Anticipación            Movimiento en dirección opuesta al objetivo que    100 – 180 ms
                           comunica la intención al usuario antes de actuar.
3. Acción Principal        El gesto o desplazamiento principal enfocado.      220 – 450 ms
4. Reacción Secundaria     Inercia de accesorios, antenas, parpadeo o         150 – 300 ms
                           mirada residual que absorbe la energía del gesto.
5. Recuperación            Transición amortiguada hacia una nueva postura     200 – 350 ms
                           de reposo estable coherente con el resultado.
```

---

## 2. Catálogo de Intenciones Canónicas y Fases de Actuación

Cada intención define cómo se coordinan la mirada, cabeza, torso y extremidades:

| Intención | Anticipación | Acción Principal | Reacción Secundaria | Recuperación |
|---|---|---|---|---|
| **Observar** | Micro-retroceso de cabeza hacia atrás (-5°). | Mirada y cuello se orientan al objetivo con fijación ocular. | Pupilas se dilatan ligeramente (1.1x), balanceo sutil de antena. | Postura de atención relajada orientada al punto de interés. |
| **Escuchar** | Inclinación de cabeza hacia el lado opuesto. | Cuello rota 18° acercando la "oreja" o sensor al emisor; ojos bajan. | Inmovilización del torso (respiración atenuada para no "hacer ruido"). | Parpadeo suave y orientación frontal hacia el interlocutor. |
| **Dudar / Evaluar** | Cabeza se ladea 8°, ceño asimétrico. | Ojos desvían la mirada a 45° arriba; mano o apéndice roza el mentón. | Balanceo lento del peso corporal de izquierda a derecha. | Suspiro con exhalación (Squash leve) o transición a "Comprender". |
| **Comprender ("Aha!")** | Cabeza baja 4° en concentración final. | Elevación vertical rápida (+12%), ojos se abren al 100%, torso erguido. | Destello en reactor/baliza, resorte elástico en antena. | Asentimiento afirmativo de cabeza (2 cabeceos suaves). |
| **Señalar Objetivo** | Hombro retrocede preparando el vector. | Brazo se extiende con vector recto hacia el target; mirada fija el punto. | Cabeza gira brevemente al usuario para comprobar si está mirando. | Retorno del brazo a reposo lateral o cintura. |
| **Ofrecer Objeto** | Cuerpo se inclina ligeramente hacia atrás. | Ambos brazos se extienden al frente con palmas/soportes hacia arriba. | Pecho se abre, cabeza baja 3° en señal de cortesía y deferencia. | Espera activa con micro-balanceo hasta que el usuario recibe. |
| **Reaccionar a Error** | Inmovilización súbita por impacto (shock). | Cabeza cae 12°, hombros se hunden, ojos bajan o expresan desánimo. | Resorte de antena decae hacia atrás con amortiguamiento pesado. | Postura de disculpa o resolución con mirada tímida al usuario. |
| **Celebrar** | Compresión vertical intensa (Squash 0.82x). | Salto con extensión total (Stretch 1.18x), brazos alzados en "V". | Ojos en arco sonriente, balizas estroboscópicas, partículas. | Aterrizaje amortiguado con balanceo elástico de recuperación. |

---

## 3. Modelo de Datos y Planificador de Intenciones en TypeScript

```typescript
export type IntentId =
  | 'observe'
  | 'listen'
  | 'ponder'
  | 'comprehend'
  | 'point'
  | 'offer'
  | 'error_reaction'
  | 'celebrate';

export interface ActingPhaseConfig {
  durationMs: number;
  easing: (t: number) => number;
  targetHeadRotation: [number, number, number]; // [Pitch, Yaw, Roll] en rad
  targetTorsoOffset: [number, number, number];   // [X, Y, Z]
  eyeLookTarget: [number, number];              // [X, Y] normalizado [-1, 1]
  armPose: 'rest' | 'point' | 'offer' | 'chin_touch' | 'cheer' | 'slump';
  facialTension: number;                        // 0.0 a 1.0
}

export interface IntentSequence {
  intent: IntentId;
  anticipation: ActingPhaseConfig;
  action: ActingPhaseConfig;
  secondary: ActingPhaseConfig;
  recovery: ActingPhaseConfig;
}
```

### 3.1. Ejecutor de Secuencias Cinemáticas Desacoplado:
```typescript
export class IntentActionPlanner {
  private currentIntent: IntentSequence | null = null;
  private currentPhaseIndex: 'anticipation' | 'action' | 'secondary' | 'recovery' = 'anticipation';
  private phaseTimerMs: number = 0;

  public triggerIntent(sequence: IntentSequence): void {
    this.currentIntent = sequence;
    this.currentPhaseIndex = 'anticipation';
    this.phaseTimerMs = 0;
  }

  public update(dtMs: number): ActingPhaseConfig | null {
    if (!this.currentIntent) return null;

    this.phaseTimerMs += dtMs;
    const currentPhaseConfig = this.currentIntent[this.currentPhaseIndex];

    if (this.phaseTimerMs >= currentPhaseConfig.durationMs) {
      this.phaseTimerMs = 0;
      switch (this.currentPhaseIndex) {
        case 'anticipation':
          this.currentPhaseIndex = 'action';
          break;
        case 'action':
          this.currentPhaseIndex = 'secondary';
          break;
        case 'secondary':
          this.currentPhaseIndex = 'recovery';
          break;
        case 'recovery':
          this.currentIntent = null;
          return null;
      }
    }

    return this.currentIntent ? this.currentIntent[this.currentPhaseIndex] : null;
  }
}
```

---

## 4. Proxemia, Orientación y Contacto Visual con el Usuario

La actuación digital debe modular la distancia y el ángulo del personaje según el contexto:

1. **Contacto Visual Directo (Eye Contact Check)**:
   Al ejecutar una acción prolongada (ej. explicar un gráfico o señalar un botón), el personaje no mantiene la mirada fija en el botón al 100% del tiempo. Debe realizar un **vistazo de verificación (*Social Gaze Check*)**: mirar al usuario durante 400 ms, regresar al objeto y continuar.
2. **Proxemia Digital (Espacio Personal)**:
   Si el cursor del usuario se sitúa demasiado cerca del rostro del personaje ($< 50\text{ px}$ en pantalla), el personaje no permanece inmóvil: reacciona con un micro-retroceso de curiosidad o timidez (cabeza se aparta 10° con parpadeo rápido).
