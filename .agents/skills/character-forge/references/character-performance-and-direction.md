# Motor de Actuación y Dirección de Personajes (Character Performance & Direction)

Este módulo formaliza el sistema de dirección dramática para personajes digitales, transformando intenciones comunicativas discretas en secuencias temporales coherentes mediante la anatomía de 10 fases, la gramática de movimiento y el grafo de actuación determinista (*Acting Graph*).

---

## 1. Catálogo Canónico de Intenciones Comunicativas

Una actuación no es un cambio instantáneo de pose ni una animación aislada. Comunica un objetivo hacia el usuario o el entorno:

| Intención Comunicativa | Significado a Transmitir | Intensidad | Señales Visuales Clave | Errores / Interpretaciones a Evitar |
|---|---|---|---|---|
| `acknowledge_return` | El usuario ha vuelto a la app tras ausencia. | Media-baja | Mirada hacia arriba, sutil estiramiento en Y, parpadeo alegre. | Sobresalto exagerado o interrupción ruidosa. |
| `curiosity_investigate` | Detección de dato/archivo nuevo e interesante. | Media | Inclinación de cabeza (tilt), ojos achinados, postura proyectada al frente. | Alarma defensiva o agresión visual. |
| `satisfaction_contained` | Tarea completada con éxito sin grandilocuencia. | Media | Asentimiento rítmico, hombros relajados, sonrisa contenida. | Euforia infantil o saltos desmedidos. |
| `decision_needed` | El sistema está bloqueado esperando input (HITL). | Alta | Mirada frontal fija, badge vibrante, inclinación de pregunta, tensión en postura. | Pasividad que parezca que el sistema se colgó. |
| `frustration_polite` | Error recuperable o degradación de servicio. | Media | Cabeza levemente ladeada hacia abajo, exhalación visual (squash en Y), ojos planos. | Hostilidad o enfado que asuste al usuario. |
| `progress_flowing` | Tarea en proceso activo prolongado. | Baja | Micro-balanceo rítmico, mirada en escaneo horizontal suave. | Estaticidad rígida (muerte visual) o hiperactividad distractora. |
| `error_recovery` | Reconocimiento de fallo y retorno a control. | Media-alta | Sacudida leve en X, parpadeo rápido, reasentamiento firme en pose base. | Minimizar el error sin comunicarlo o quedar bloqueado. |

---

## 2. Anatomía de una Actuación en 10 Fases

Toda actuación compleja se descompone en una secuencia estructurada de diez fases temporales:

```
[1. Estímulo] ──> [2. Interpretación] ──> [3. Preparación] ──> [4. Anticipación]
                                                                        │
┌───────────────────────────────────────────────────────────────────────┘
│
▼
[5. Acción Principal] ──> [6. Acento / Ápex] ──> [7. Reacción Secundaria]
                                                              │
┌─────────────────────────────────────────────────────────────┘
│
▼
[8. Asentamiento] ──> [9. Recuperación] ──> [10. Memoria Contextual]
```

1. **Estímulo**: El evento físico o de red que desencadena la acción (ej. evento `tauri://drag-enter` o `agent:approval_required`).
2. **Interpretación**: Evaluación cognitiva donde el personaje categoriza la urgencia y el significado.
3. **Preparación**: Ajuste inicial de tensión muscular, dilatación pupilar u orientación de la mirada hacia el foco de atención.
4. **Anticipación**: Movimiento físico previo en sentido opuesto al impulso principal (ej. agacharse antes de saltar, retraer la cabeza antes de asentir con fuerza).
5. **Acción Principal**: La trayectoria motriz de mayor desplazamiento o transformación.
6. **Acento**: El instante de máxima extensión, claridad siluetual o impacto cinemático.
7. **Reacción Secundaria**: Movimiento inercial de accesorios, cabello, orejas, ropa o pestañas respondiendo a la deceleración del cuerpo.
8. **Asentamiento**: Amortiguación asintótica del oscilador donde la velocidad decrece a cero.
9. **Recuperación**: Transición cinemática suave hacia la pose de reposo (*Idle Stance*).
10. **Memoria Contextual**: Actualización del registro interno de estado (ej. recordar que el usuario acaba de rechazar una acción para modular la próxima respuesta).

---

## 3. Gramática de Movimiento: Catálogo de Verbos de Actuación

Cada verbo define una unidad atómica ejecutable con precondiciones y límites estrictos:

```typescript
export interface PerformanceVerb {
  verbId: string;
  name: string;
  preconditions: { minEnergy?: number; allowedStates: string[] };
  targetPose: { yaw: number; pitch: number; tilt: number; sx: number; sy: number };
  curve: "linear" | "ease_in_out" | "elastic_out" | "back_out";
  durationRangeSec: [number, number]; // [min, max]
  secondaryMotionFactor: number;
  interruptible: boolean;
  recoveryVerbId?: string;
}
```

### Verbos Clave Estandarizados:
* `look_at`: Reorientación de mirada y cabeza con clamp angular y velocidad máxima $120^\circ/\text{s}$.
* `lean_in`: Inclinación hacia adelante ($S_y = 1.08, \text{pitch} = -0.2$) para denotar interés o escucha activa.
* `nod_affirm`: Asentimiento en dos pulsos con aceleración asimétrica (bajada rápida, subida amortiguada).
* `shake_deny`: Oscilación lateral en $X$ con decaimiento exponencial en 3 armónicos.
* `recoil_defend`: Retracción hacia atrás ($S_y = 0.88, \text{pitch} = 0.25$) ante un error o peligro.
* `absorb_ingest`: Deformación en elipse absorbente al recibir un archivo soltado.

---

## 4. Acting Graph y Director Determinista

El `ActingDirector` gestiona una cola de actuaciones jerárquicas garantizando que las alertas de alta prioridad (HITL o fallos de red) interrumpan limpiamente acciones cosméticas secundarias:

```typescript
export class ActingDirector {
  private currentAction: ActivePerformance | null = null;
  private actionQueue: PerformanceRequest[] = [];

  public requestAction(req: PerformanceRequest): void {
    if (!this.currentAction) {
      this.startPerformance(req);
      return;
    }

    if (req.priority > this.currentAction.priority) {
      // Interrupción limpia: inyectar pose actual como punto de partida para evitar saltos
      this.currentAction.abortCleanly();
      this.startPerformance(req);
    } else {
      this.actionQueue.push(req);
    }
  }
}
```

---

## 5. Continuidad Corporal y Guardrails de Animación

1. **Continuidad $C^1$ de Velocidad**: Queda prohibido reiniciar la velocidad a cero instantáneamente al interrumpir una acción. La velocidad actual se transfiere como condición inicial del resorte siguiente.
2. **Límites Anatómicos y ROM**: Guiñada ($\psi \in [-35^\circ, 35^\circ]$), cabeceo ($\theta \in [-22^\circ, 22^\circ]$), inclinación ($\tau \in [-18^\circ, 18^\circ]$).
3. **Preservación de Volumen en Squash-and-Stretch**: Toda compresión en $Y$ debe compensarse en $X$ para mantener masa visual constante:
   $$S_x \approx \frac{1}{\sqrt{S_y}}$$
