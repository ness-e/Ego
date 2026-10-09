import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CharacterStateMachine,
  CANONICAL_STATE_TARGETS,
  type CharacterState,
} from "../renderer/components/character/state/CharacterStateMachine.js";

describe("CharacterStateMachine — FSM de 14 Estados Canónicos e Interpolación (CHAR-06)", () => {
  let fsm: CharacterStateMachine;

  beforeEach(() => {
    fsm = new CharacterStateMachine("idle");
  });

  it("1. Inicializa correctamente en estado 'idle' con canales configurados", () => {
    expect(fsm.currentState).toBe("idle");
    expect(fsm.previousState).toBe("idle");
    expect(fsm.channels.open).toBeCloseTo(CANONICAL_STATE_TARGETS.idle.open, 2);
    expect(fsm.channels.aura).toBeCloseTo(CANONICAL_STATE_TARGETS.idle.auraIntensity, 2);
  });

  it("2. Contiene exactamente los 14 estados operativos canónicos definidos", () => {
    const canonicalStates: CharacterState[] = [
      "idle",
      "listening",
      "thinking",
      "generating",
      "searching",
      "using_tool",
      "waiting",
      "approval_required",
      "question",
      "success",
      "warning",
      "error",
      "sleeping",
      "attention",
    ];

    expect(canonicalStates.length).toBe(14);
    for (const state of canonicalStates) {
      const cfg = CANONICAL_STATE_TARGETS[state];
      expect(cfg).toBeDefined();
      expect(cfg.open).toBeGreaterThanOrEqual(0);
      expect(cfg.pulseSpeed).toBeGreaterThan(0);
      expect(cfg.accent.length).toBe(3);
    }
  });

  it("3. Transiciona suavemente e interpola canales con amortiguación lerp", () => {
    fsm.setState("thinking");
    expect(fsm.currentState).toBe("thinking");
    expect(fsm.previousState).toBe("idle");

    // En el frame 0 post-setState, el squash se activa levemente
    expect(fsm.channels.squashX).toBeGreaterThan(1.0);
    expect(fsm.channels.squashY).toBeLessThan(1.0);

    // Ejecutamos varios ticks de simulación
    for (let i = 0; i < 30; i++) {
      fsm.update(0.016); // 16ms por frame
    }

    // Los canales deben haber convergido hacia el objetivo de 'thinking'
    expect(fsm.channels.open).toBeLessThan(CANONICAL_STATE_TARGETS.idle.open);
    expect(fsm.channels.open).toBeGreaterThan(0.5);
    expect(fsm.channels.open).toBeLessThan(0.8);
    expect(fsm.channels.aura).toBeGreaterThan(CANONICAL_STATE_TARGETS.idle.auraIntensity);
    expect(fsm.channels.squashX).toBeCloseTo(1.0, 1);
  });

  it("4. Notifica a los observadores ante cada transición de estado", () => {
    const listener = vi.fn();
    const unsub = fsm.onTransition(listener);

    fsm.setState("generating");
    expect(listener).toHaveBeenCalledWith("generating", "idle");

    fsm.setState("using_tool");
    expect(listener).toHaveBeenCalledWith("using_tool", "generating");

    unsub();
    fsm.setState("success");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("5. Coalesce eventos de streaming sucesivos sin reiniciar bruscamente", () => {
    fsm.setState("generating");
    const enteredAt = fsm.timeInCurrentStateMs;

    // Llamadas continuas a notifyStreamingActivity mantienen el estado
    fsm.notifyStreamingActivity();
    expect(fsm.currentState).toBe("generating");
    expect(fsm.timeInCurrentStateMs).toBeGreaterThanOrEqual(enteredAt);
  });

  it("6. Transiciona de vuelta a 'idle' automáticamente para estados transitorios", () => {
    vi.useFakeTimers();
    try {
      fsm.setState("success");
      expect(fsm.currentState).toBe("success");

      // Avanzamos 2 segundos: aún sigue en success
      vi.advanceTimersByTime(2000);
      fsm.update(0.016);
      expect(fsm.currentState).toBe("success");

      // Avanzamos a 4 segundos (supera los 3800ms de success)
      vi.advanceTimersByTime(2000);
      fsm.update(0.016);
      expect(fsm.currentState).toBe("idle");
    } finally {
      vi.useRealTimers();
    }
  });

  it("7. Maneja de forma inmediata el salto si immediate=true", () => {
    fsm.setState("approval_required", true);
    expect(fsm.currentState).toBe("approval_required");
    expect(fsm.channels.open).toBe(CANONICAL_STATE_TARGETS.approval_required.open);
    expect(fsm.channels.aura).toBe(CANONICAL_STATE_TARGETS.approval_required.auraIntensity);
  });
});
