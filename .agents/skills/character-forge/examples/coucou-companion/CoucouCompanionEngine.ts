/**
 * @file CoucouCompanionEngine.ts
 * @description Fachada coordinadora del motor de compañero desktop 2.5D.
 */

import { SuperellipsoidGeometry } from "./geometry/superellipsoid";
import { AnimationClock } from "./animation/animationClock";
import { DampedSpring } from "./animation/spring";
import { SpatialPresenceFSM } from "./behavior/spatialPresence";
import { StateArbiter, type EmotionalState, type ResolvedVisualPose } from "./behavior/stateArbiter";
import { AgentEventBridge, type AgentInputEvent } from "./runtime/agentEventBridge";
import { AudioFeedbackSystem } from "./audio/audioFeedback";
import { CompanionRenderer2D, type RenderContext2D } from "./rendering/renderer2d";

export interface CompanionEngineConfig {
  canvas: HTMLCanvasElement;
  radius?: number;
  exponent?: number; // 2.7 = Mochi
}

export class CoucouCompanionEngine {
  public geometry: SuperellipsoidGeometry;
  public clock: AnimationClock;
  public springSx: DampedSpring;
  public springSy: DampedSpring;
  public spatialFsm: SpatialPresenceFSM;
  public agentBridge: AgentEventBridge;
  public audio: AudioFeedbackSystem;
  public renderer: CompanionRenderer2D;

  private emotionalState: EmotionalState = "neutral";
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  public cursorX: number = 0;
  public cursorY: number = 0;
  public lightNorm: { x: number; y: number } = { x: -0.5, y: -0.7 };
  public yaw: number = 0;
  public pitch: number = 0;

  constructor(config: CompanionEngineConfig) {
    this.canvas = config.canvas;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D de Canvas");
    this.ctx = ctx;

    const r = config.radius || 60;
    const p = config.exponent || 2.7;

    this.geometry = new SuperellipsoidGeometry({ a: r, b: r * 0.88, c: r, p });
    this.clock = new AnimationClock();
    this.springSx = new DampedSpring(16.0, 0.72, 1.0);
    this.springSy = new DampedSpring(16.0, 0.72, 1.0);
    this.spatialFsm = new SpatialPresenceFSM();
    this.agentBridge = new AgentEventBridge();
    this.audio = new AudioFeedbackSystem();
    this.renderer = new CompanionRenderer2D(this.geometry);
  }

  /**
   * Recibe un evento del agente de IA.
   */
  public handleAgentEvent(event: AgentInputEvent): void {
    const newState = this.agentBridge.ingest(event);
    if (newState === "waitingForApproval") {
      this.spatialFsm.wakeImmediately();
      this.springSy.perturb(0.35);
      this.audio.playAlertBuzz();
    } else if (newState === "success") {
      this.springSy.perturb(0.25);
      this.audio.playPop(880);
    }
  }

  /**
   * Actualiza simulación física y renderiza un fotograma.
   */
  public tick(nowMs: number = performance.now()): ResolvedVisualPose {
    const dt = this.clock.tick(nowMs);
    const charPos = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
    const cursorPos = { x: this.cursorX, y: this.cursorY };

    // 1. Watchdog del agente
    const agentState = this.agentBridge.checkWatchdog(nowMs);
    const isAgentActive = agentState === "thinking" || agentState === "runningTool" || agentState === "waitingForApproval";

    // 2. FSM Espacial
    const spatialState = this.spatialFsm.update(dt, charPos, cursorPos, isAgentActive);

    // 3. Resolución en Árbitro de Estados
    const resolvedPose = StateArbiter.resolve(spatialState, this.emotionalState, agentState);

    // 4. Integración física de resortes
    const sx = this.springSx.update(dt);
    const sy = this.springSy.update(dt);

    // 5. Look-At reactivo
    if (!resolvedPose.isSleeping) {
      const dx = this.cursorX - charPos.x;
      const dy = this.cursorY - charPos.y;
      this.yaw = Math.max(-0.6, Math.min(0.6, dx / 240));
      this.pitch = Math.max(-0.4, Math.min(0.4, dy / 180));
    } else {
      this.yaw = 0;
      this.pitch = 0.2;
    }

    // 6. Pipeline de Renderizado
    const rc: RenderContext2D = {
      ctx: this.ctx,
      width: this.canvas.width,
      height: this.canvas.height,
      scale: 1.0,
    };
    this.renderer.render(rc, resolvedPose, this.yaw, this.pitch, this.lightNorm, sx, sy);

    return resolvedPose;
  }

  public setEmotionalState(emotion: EmotionalState): void {
    this.emotionalState = emotion;
  }
}
