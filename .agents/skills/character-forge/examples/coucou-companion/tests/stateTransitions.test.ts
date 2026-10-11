/**
 * @file stateTransitions.test.ts
 * @description Suite de pruebas para transiciones de estados y árbitro de prioridades.
 */

import { StateArbiter } from "../behavior/stateArbiter";
import { SpatialPresenceFSM } from "../behavior/spatialPresence";
import { AgentEventBridge } from "../runtime/agentEventBridge";

export function runStateTransitionTests(): { passed: number; failed: number; errors: string[] } {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, msg: string) {
    if (condition) passed++;
    else {
      failed++;
      errors.push(msg);
    }
  }

  // Test 1: Prevalencia absoluta de HITL sobre sueño
  const poseHITLenSueño = StateArbiter.resolve("sleeping", "happy", "waitingForApproval");
  assert(poseHITLenSueño.badge === "bang", "Una alerta HITL debe imponer el badge 'bang' incluso en estado sleeping");
  assert(!poseHITLenSueño.isSleeping, "Una alerta HITL debe anular el estado dormido del render");
  assert(poseHITLenSueño.priorityLevel === 100, "El nivel de prioridad de HITL debe ser 100");

  // Test 2: Prevalencia de Error sobre emociones
  const poseError = StateArbiter.resolve("onDesktop", "happy", "error");
  assert(poseError.eyeShape === "flat", "Un error del agente debe imponer ojos planos ('flat') sobre emoción happy");

  // Test 3: Watchdog del puente de eventos tras timeout
  const bridge = new AgentEventBridge();
  bridge.ingest({ eventId: "evt-1", type: "thinking", timestamp: 1000 });
  assert(bridge.getState() === "thinking", "El estado tras evento thinking debe ser 'thinking'");

  // Simular paso de 30 segundos sin eventos
  const stateAfterTimeout = bridge.checkWatchdog(performance.now() + 35000);
  assert(stateAfterTimeout === "idle", "El watchdog debe retornar el estado a 'idle' tras timeout de inactividad");

  // Test 4: Histéresis de la FSM Espacial
  const fsm = new SpatialPresenceFSM({ wakeDistance: 100, sleepDistance: 150, sleepTimeoutSec: 10 });
  const center = { x: 500, y: 500 };

  // El cursor está a 160 px (lejos), pasa tiempo -> duerme
  fsm.update(12, center, { x: 660, y: 500 }, false);
  assert(fsm.currentState === "sleeping", "La FSM espacial debe entrar en 'sleeping' tras timeout y distancia >= 150");

  // El cursor se acerca a 130 px (entre 100 y 150, zona de histéresis) -> NO debe despertar todavía
  fsm.update(0.1, center, { x: 630, y: 500 }, false);
  assert(fsm.currentState === "sleeping", "En la zona de histéresis (distancia 130), el personaje permanece dormido");

  // El cursor cruza el umbral de despertar (< 100 px) -> DEBE despertar
  fsm.update(0.1, center, { x: 580, y: 500 }, false);
  assert(fsm.currentState === "onDesktop", "Al cruzar el umbral wakeDistance (< 100 px), el personaje despierta a 'onDesktop'");

  return { passed, failed, errors };
}
