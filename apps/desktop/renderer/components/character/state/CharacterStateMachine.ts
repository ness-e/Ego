// CharacterStateMachine.ts — Máquina de Estados Finitos (FSM) de 14 Estados Canónicos e Interpolador Cinético
// Basada en docs/architecture/character-system.md y COUC-06 (Attention FSM adaptada).

import { lerp } from "../core/anim.js";
import type { RGB } from "../core/CharacterEngine.js";

/**
 * Los 14 estados operativos canónicos de la criatura Ego (character-system.md §3).
 */
export type CharacterState =
  | "idle"              // Reposo/vigilancia relajada; respiración orgánica base
  | "listening"         // Entrada activa de texto o audio; inclinación de atención
  | "thinking"          // Ensamblado de contexto y razonamiento en Cognitive Runtime
  | "generating"        // Emisión continua de tokens de respuesta (streaming)
  | "searching"         // Búsqueda en VantaDB, GraphRAG o web; ojos orbitando
  | "using_tool"        // Ejecución activa de una herramienta puntual (fs, git, terminal)
  | "waiting"           // Espera de respuesta externa asíncrona
  | "approval_required" // Bloqueado en barrera HITL; exige decisión humana interactiva
  | "question"          // Clarificación o pregunta interactiva al usuario
  | "success"           // Tarea culminada satisfactoriamente con rebote y destello
  | "warning"           // Advertencia o degradación tolerable
  | "error"             // Fallo, excepción o rechazo de política
  | "sleeping"          // Reposo prolongado o ventana sin foco
  | "attention";        // Proactividad espontánea o alerta perimetral

export interface ChannelsState {
  gazeX: number;       // -1 (izq) a +1 (der)
  gazeY: number;       // -1 (arriba) a +1 (abajo)
  open: number;        // Apertura ocular (0 = cerrado, 1 = normal, >1 = dilatado)
  pulse: number;       // Amplitud de pulso respiratorio/latido (0 a 1)
  aura: number;        // Intensidad del halo o resplandor (0 a 1)
  accent: RGB;         // Color primario del estado en espacio RGB [0..1, 0..1, 0..1]
  tint: number;        // Mezcla de tinte del cuerpo (0 = base, 1 = pleno)
  tilt: number;        // Inclinación angular de cabeza en radianes
  energy: number;      // Tasa de agitación motora (0 = dormido, 1 = hiperactivo)
  squashX: number;     // Escala X de volumen orgánico (1.0 = normal)
  squashY: number;     // Escala Y de volumen orgánico (1.0 = normal)
}

export interface StateTargetConfig {
  open: number;
  pulseSpeed: number;
  auraIntensity: number;
  accent: RGB;
  tint: number;
  tilt: number;
  energy: number;
  transient: boolean;      // Si es true, retorna automáticamente a 'idle' tras timeout
  transientDurationMs?: number;
}

export const CANONICAL_STATE_TARGETS: Record<CharacterState, StateTargetConfig> = {
  idle: {
    open: 0.9,
    pulseSpeed: 1.0,
    auraIntensity: 0.05,
    accent: [0.902, 0.914, 0.933], // Neutral slate / zinc
    tint: 0.0,
    tilt: 0.0,
    energy: 0.3,
    transient: false,
  },
  listening: {
    open: 1.0,
    pulseSpeed: 1.2,
    auraIntensity: 0.25,
    accent: [0.231, 0.62, 1.0],   // Cyan-blue atento
    tint: 0.2,
    tilt: 0.12,
    energy: 0.6,
    transient: false,
  },
  thinking: {
    open: 0.65,
    pulseSpeed: 1.8,
    auraIntensity: 0.55,
    accent: [0.545, 0.361, 0.965], // Violeta profundo
    tint: 0.35,
    tilt: -0.1,
    energy: 0.7,
    transient: false,
  },
  generating: {
    open: 0.88,
    pulseSpeed: 2.2,
    auraIntensity: 0.65,
    accent: [0.06, 0.71, 0.83],    // Cian lúcido
    tint: 0.4,
    tilt: 0.05,
    energy: 0.85,
    transient: false,
  },
  searching: {
    open: 0.75,
    pulseSpeed: 1.6,
    auraIntensity: 0.45,
    accent: [0.02, 0.52, 0.78],    // Zafiro retrieval
    tint: 0.3,
    tilt: 0.0,
    energy: 0.65,
    transient: false,
  },
  using_tool: {
    open: 0.8,
    pulseSpeed: 2.5,
    auraIntensity: 0.6,
    accent: [0.06, 0.73, 0.51],    // Verde motor/ejecución
    tint: 0.45,
    tilt: 0.08,
    energy: 0.9,
    transient: false,
  },
  waiting: {
    open: 0.7,
    pulseSpeed: 0.8,
    auraIntensity: 0.15,
    accent: [0.45, 0.52, 0.62],    // Gris azulado tenue
    tint: 0.15,
    tilt: -0.05,
    energy: 0.25,
    transient: false,
  },
  approval_required: {
    open: 1.15,
    pulseSpeed: 3.0,
    auraIntensity: 0.9,
    accent: [0.984, 0.682, 0.082], // Ámbar/dorado de alerta HITL
    tint: 0.7,
    tilt: 0.0,
    energy: 1.0,
    transient: false,
  },
  question: {
    open: 1.05,
    pulseSpeed: 1.4,
    auraIntensity: 0.35,
    accent: [0.1, 0.75, 0.7],      // Turquesa reflexivo
    tint: 0.25,
    tilt: -0.22,
    energy: 0.5,
    transient: false,
  },
  success: {
    open: 1.0,
    pulseSpeed: 2.0,
    auraIntensity: 0.85,
    accent: [0.133, 0.773, 0.369], // Esmeralda triunfal
    tint: 0.6,
    tilt: 0.05,
    energy: 0.95,
    transient: true,
    transientDurationMs: 3800,
  },
  warning: {
    open: 0.9,
    pulseSpeed: 2.4,
    auraIntensity: 0.7,
    accent: [0.961, 0.62, 0.043],  // Naranja preventivo
    tint: 0.5,
    tilt: -0.08,
    energy: 0.8,
    transient: true,
    transientDurationMs: 4500,
  },
  error: {
    open: 0.7,
    pulseSpeed: 2.8,
    auraIntensity: 0.8,
    accent: [0.937, 0.267, 0.243], // Rojo carmesí
    tint: 0.75,
    tilt: 0.15,
    energy: 0.85,
    transient: true,
    transientDurationMs: 5000,
  },
  sleeping: {
    open: 0.0,
    pulseSpeed: 0.5,
    auraIntensity: 0.0,
    accent: [0.35, 0.36, 0.42],    // Ceniza nocturno
    tint: 0.0,
    tilt: 0.18,
    energy: 0.05,
    transient: false,
  },
  attention: {
    open: 1.1,
    pulseSpeed: 2.6,
    auraIntensity: 0.85,
    accent: [0.38, 0.55, 1.0],     // Azul pulsante proactivo
    tint: 0.55,
    tilt: 0.0,
    energy: 0.9,
    transient: true,
    transientDurationMs: 4000,
  },
};

/**
 * Máquina de Estados Finitos (FSM) con interpolador cinemático amortiguado.
 * Garantiza transiciones sin saltos bruscos y coalescencia de ráfagas.
 */
export class CharacterStateMachine {
  private _currentState: CharacterState = "idle";
  private _previousState: CharacterState = "idle";
  private _stateEnteredAtMs = Date.now();
  private _lastStreamingKeepAliveMs = Date.now();

  // Canales actuales interpolados continuamente
  public readonly channels: ChannelsState = {
    gazeX: 0,
    gazeY: 0,
    open: CANONICAL_STATE_TARGETS.idle.open,
    pulse: 0,
    aura: CANONICAL_STATE_TARGETS.idle.auraIntensity,
    accent: [...CANONICAL_STATE_TARGETS.idle.accent] as unknown as RGB,
    tint: CANONICAL_STATE_TARGETS.idle.tint,
    tilt: CANONICAL_STATE_TARGETS.idle.tilt,
    energy: CANONICAL_STATE_TARGETS.idle.energy,
    squashX: 1.0,
    squashY: 1.0,
  };

  // Mirada objetivo (cursor o foco de interés)
  private _targetGazeX = 0;
  private _targetGazeY = 0;

  // Tiempo acumulado para osciladores de onda
  private _clock = 0;

  // Factor de amortiguación (mayor = más rápido, menor = más elástico)
  public smoothingFactor = 8.5;

  // Listeners de transición de estado
  private _listeners: Array<(newState: CharacterState, oldState: CharacterState) => void> = [];

  constructor(initialState: CharacterState = "idle") {
    this.setState(initialState, true);
  }

  public get currentState(): CharacterState {
    return this._currentState;
  }

  public get previousState(): CharacterState {
    return this._previousState;
  }

  public get timeInCurrentStateMs(): number {
    return Date.now() - this._stateEnteredAtMs;
  }

  public get lastStreamingKeepAliveMs(): number {
    return this._lastStreamingKeepAliveMs;
  }

  /**
   * Suscribe una función callback que se ejecuta ante cualquier cambio de estado.
   */
  public onTransition(fn: (newState: CharacterState, oldState: CharacterState) => void): () => void {
    this._listeners.push(fn);
    return () => {
      const idx = this._listeners.indexOf(fn);
      if (idx >= 0) this._listeners.splice(idx, 1);
    };
  }

  /**
   * Conmuta el estado operativo. Si `immediate` es true, salta instantáneamente los canales.
   */
  public setState(nextState: CharacterState, immediate = false): void {
    if (this._currentState === nextState) {
      // Coalescencia: si ya estamos en 'generating' o 'using_tool', refrescamos el pulso de vida
      this._lastStreamingKeepAliveMs = Date.now();
      return;
    }

    const prev = this._currentState;
    this._previousState = prev;
    this._currentState = nextState;
    this._stateEnteredAtMs = Date.now();
    this._lastStreamingKeepAliveMs = this._stateEnteredAtMs;

    const target = CANONICAL_STATE_TARGETS[nextState];

    if (immediate) {
      this.channels.open = target.open;
      this.channels.aura = target.auraIntensity;
      this.channels.accent = [...target.accent] as unknown as RGB;
      this.channels.tint = target.tint;
      this.channels.tilt = target.tilt;
      this.channels.energy = target.energy;
      this.channels.squashX = 1.0;
      this.channels.squashY = 1.0;
    } else {
      // Micro-gesto cinético de transición (Squash leve al cambiar de intención)
      this.channels.squashX = 1.08;
      this.channels.squashY = 0.93;
    }

    for (const listener of this._listeners) {
      try {
        listener(nextState, prev);
      } catch (err) {
        console.error("[CharacterStateMachine] Error en listener:", err);
      }
    }
  }

  /**
   * Fija las coordenadas normalizadas del punto de atención/mirada (-1 a +1).
   */
  public setTargetGaze(x: number, y: number): void {
    this._targetGazeX = Math.max(-1, Math.min(1, x));
    this._targetGazeY = Math.max(-1, Math.min(1, y));
  }

  /**
   * Notifica actividad de streaming continuo para evitar timeouts transitorios.
   */
  public notifyStreamingActivity(): void {
    this._lastStreamingKeepAliveMs = Date.now();
    if (this._currentState !== "generating") {
      this.setState("generating");
    }
  }

  /**
   * Actualiza e interpola todos los canales en cada fotograma del ciclo de renderizado.
   * @param dt Delta time en segundos (e.g. 0.016 para 60fps)
   */
  public update(dt: number): void {
    this._clock += dt;
    const now = Date.now();
    const target = CANONICAL_STATE_TARGETS[this._currentState];

    // 1. Circuit Breaker de auto-retorno para estados transitorios
    if (target.transient) {
      const dur = target.transientDurationMs ?? 4000;
      if (now - this._stateEnteredAtMs > dur) {
        this.setState("idle");
      }
    }

    // 2. Modulaciones procedimentales por estado (Ondas sinusoidales)
    let dynamicGazeX = this._targetGazeX;
    let dynamicGazeY = this._targetGazeY;
    let dynamicOpen = target.open;

    if (this._currentState === "searching") {
      // Mirada en escaneo orbital continuo
      dynamicGazeX = Math.cos(this._clock * 4.5) * 0.7;
      dynamicGazeY = Math.sin(this._clock * 4.5) * 0.4 - 0.1;
    } else if (this._currentState === "using_tool") {
      // Escaneo horizontal rápido de linter/archivos
      dynamicGazeX = Math.sin(this._clock * 6.0) * 0.55;
      dynamicGazeY = 0.1;
    } else if (this._currentState === "thinking") {
      // Mirada desviada hacia arriba mientras razona
      dynamicGazeX = Math.sin(this._clock * 1.5) * 0.3;
      dynamicGazeY = -0.4;
      dynamicOpen = 0.65 + Math.sin(this._clock * 3.0) * 0.08;
    } else if (this._currentState === "sleeping") {
      dynamicGazeX = 0;
      dynamicGazeY = 0.3;
      dynamicOpen = 0;
    }

    // Respiración / pulso orgánico
    const breathRate = target.pulseSpeed;
    const breathPulse = (Math.sin(this._clock * Math.PI * breathRate) + 1) * 0.5;

    // 3. Interpolación amortiguada (lerp exponencial)
    const factor = Math.min(1.0, this.smoothingFactor * dt);

    this.channels.gazeX = lerp(this.channels.gazeX, dynamicGazeX, factor);
    this.channels.gazeY = lerp(this.channels.gazeY, dynamicGazeY, factor);
    this.channels.open = lerp(this.channels.open, dynamicOpen, factor);
    this.channels.pulse = breathPulse;
    this.channels.aura = lerp(this.channels.aura, target.auraIntensity, factor);
    this.channels.tint = lerp(this.channels.tint, target.tint, factor);
    this.channels.tilt = lerp(this.channels.tilt, target.tilt, factor);
    this.channels.energy = lerp(this.channels.energy, target.energy, factor);

    // Interpolación cromática RGB
    this.channels.accent = [
      lerp(this.channels.accent[0], target.accent[0], factor),
      lerp(this.channels.accent[1], target.accent[1], factor),
      lerp(this.channels.accent[2], target.accent[2], factor),
    ] as unknown as RGB;

    // Retorno de squash & stretch hacia volumen 1.0
    this.channels.squashX = lerp(this.channels.squashX, 1.0, factor * 1.5);
    this.channels.squashY = lerp(this.channels.squashY, 1.0, factor * 1.5);
  }
}
