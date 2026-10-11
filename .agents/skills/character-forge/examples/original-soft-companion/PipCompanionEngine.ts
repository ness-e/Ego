import {
  PipExpressionName,
  PipActingActionName,
  FacialRigParameters,
  PipPersonalityProfile,
  PipCustomizationDNA,
  KinematicState
} from './types';

export class PipCompanionEngine {
  public personality: PipPersonalityProfile;
  public dna: PipCustomizationDNA;
  public currentExpression: PipExpressionName = 'neutral_attentive';
  public currentAction: PipActingActionName = 'idle_breathe';

  // Canales faciales activos interpolados
  public facialChannels: FacialRigParameters;

  // Estado cinemático del cuerpo
  public kinematics: KinematicState;

  // Temporizadores y tiempo interno
  private actionTime: number = 0;
  private blinkTimer: number = 0;
  private nextBlinkInterval: number = 3.2;
  private microgestureTimer: number = 0;
  private idleTimeCounter: number = 0;

  // Override para testing y control fino
  private squashOverride: number | null = null;

  constructor(
    customDNA?: Partial<PipCustomizationDNA>,
    customPersonality?: Partial<PipPersonalityProfile>
  ) {
    this.dna = {
      primaryColor: '#38bdf8',
      bellyColor: '#f0f9ff',
      antennaColor: '#f59e0b',
      materialMode: 'plush',
      fuzzStrength: 1.0,
      surfaceRoughness: 0.86,
      eyeSizeScale: 1.0,
      eyeSeparation: 1.0,
      bodyFatness: 1.0,
      earFluffScale: 1.0,
      ...customDNA
    };

    this.personality = {
      energy: 0.75,
      curiosity: 0.85,
      expressiveness: 0.80,
      reactionSpeed: 1.2,
      idleMicrogesturesFreq: 0.70,
      gazeEngagement: 0.90,
      movementAmplitude: 1.0,
      restThresholdSeconds: 12.0,
      ...customPersonality
    };

    this.facialChannels = this.getExpressionChannels('neutral_attentive');

    this.kinematics = {
      elevationY: 0,
      squashY: 1.0,
      stretchXZ: 1.0,
      tiltZ: 0,
      turnY: 0,
      pitchX: 0,
      shadowScale: 1.0,
      shadowOpacity: 0.60
    };
  }

  /**
   * Catálogo de las 12 Expresiones Emocionales Diferenciadas
   */
  public getExpressionChannels(expr: PipExpressionName): FacialRigParameters {
    const base: FacialRigParameters = {
      eyeOpenLeft: 1.0,
      eyeOpenRight: 1.0,
      pupilDilation: 1.0,
      gazeX: 0,
      gazeY: 0,
      browInnerRaise: 0,
      browOuterRaise: 0,
      mouthCurve: 0.2, // sonrisa sutil neutra
      mouthOpen: 0,
      earSwayLeft: 0,
      earSwayRight: 0,
      antennaPulse: 0.3,
      blushIntensity: 0.1
    };

    switch (expr) {
      case 'neutral_attentive':
        return { ...base, eyeOpenLeft: 1.0, eyeOpenRight: 1.0, mouthCurve: 0.15, antennaPulse: 0.4 };
      case 'joyful':
        return { ...base, eyeOpenLeft: 0.85, eyeOpenRight: 0.85, pupilDilation: 1.15, mouthCurve: 0.9, mouthOpen: 0.25, blushIntensity: 0.6, earSwayLeft: 0.2, earSwayRight: -0.2, antennaPulse: 0.9 };
      case 'curious':
        return { ...base, eyeOpenLeft: 1.1, eyeOpenRight: 0.9, pupilDilation: 1.3, browInnerRaise: 0.4, mouthCurve: 0.3, mouthOpen: 0.1, earSwayLeft: 0.4, earSwayRight: 0.1, antennaPulse: 0.8 };
      case 'surprised':
        return { ...base, eyeOpenLeft: 1.3, eyeOpenRight: 1.3, pupilDilation: 1.45, browInnerRaise: 0.8, mouthCurve: 0.0, mouthOpen: 0.75, earSwayLeft: -0.3, earSwayRight: 0.3, antennaPulse: 1.0 };
      case 'confused':
        return { ...base, eyeOpenLeft: 1.15, eyeOpenRight: 0.65, pupilDilation: 0.9, browInnerRaise: -0.3, browOuterRaise: 0.5, mouthCurve: -0.2, mouthOpen: 0.15, earSwayLeft: 0.5, earSwayRight: -0.2, antennaPulse: 0.6 };
      case 'sad':
        return { ...base, eyeOpenLeft: 0.65, eyeOpenRight: 0.65, pupilDilation: 0.85, browInnerRaise: 0.6, browOuterRaise: -0.4, mouthCurve: -0.7, mouthOpen: 0.05, earSwayLeft: -0.5, earSwayRight: 0.5, antennaPulse: 0.1, blushIntensity: 0.3 };
      case 'frustrated':
        return { ...base, eyeOpenLeft: 0.7, eyeOpenRight: 0.7, pupilDilation: 0.75, browInnerRaise: -0.8, browOuterRaise: -0.2, mouthCurve: -0.6, mouthOpen: 0.2, earSwayLeft: -0.4, earSwayRight: 0.4, antennaPulse: 0.2 };
      case 'enthusiastic':
        return { ...base, eyeOpenLeft: 1.2, eyeOpenRight: 1.2, pupilDilation: 1.35, mouthCurve: 1.0, mouthOpen: 0.55, blushIntensity: 0.7, earSwayLeft: 0.4, earSwayRight: -0.4, antennaPulse: 1.0 };
      case 'tired':
        return { ...base, eyeOpenLeft: 0.4, eyeOpenRight: 0.4, pupilDilation: 0.8, browInnerRaise: 0.2, mouthCurve: -0.1, mouthOpen: 0.1, earSwayLeft: -0.3, earSwayRight: 0.3, antennaPulse: 0.15 };
      case 'sleeping':
        return { ...base, eyeOpenLeft: 0.04, eyeOpenRight: 0.04, pupilDilation: 0.5, browInnerRaise: 0, mouthCurve: 0.1, mouthOpen: 0.0, earSwayLeft: -0.4, earSwayRight: 0.4, antennaPulse: 0.05, blushIntensity: 0.2 };
      case 'focused':
        return { ...base, eyeOpenLeft: 0.85, eyeOpenRight: 0.85, pupilDilation: 0.95, browInnerRaise: -0.3, mouthCurve: 0.0, mouthOpen: 0.0, earSwayLeft: 0.1, earSwayRight: -0.1, antennaPulse: 0.85 };
      case 'playful':
        return { ...base, eyeOpenLeft: 0.9, eyeOpenRight: 0.1, pupilDilation: 1.2, browInnerRaise: 0.3, mouthCurve: 0.8, mouthOpen: 0.3, blushIntensity: 0.5, earSwayLeft: 0.35, earSwayRight: -0.2, antennaPulse: 0.95 };
    }
  }

  public setExpression(expr: PipExpressionName): void {
    this.currentExpression = expr;
    this.facialChannels = this.getExpressionChannels(expr);
  }

  public triggerAction(action: PipActingActionName): void {
    this.currentAction = action;
    this.actionTime = 0;
  }

  public setSquashOverride(sy: number): void {
    this.squashOverride = sy;
  }

  public clearSquashOverride(): void {
    this.squashOverride = null;
  }

  /**
   * Actualización cinemática por tick
   * @param dt delta de tiempo en segundos
   * @param mouseTargetX posición normalizada de mirada [-1, 1]
   * @param mouseTargetY posición normalizada de mirada [-1, 1]
   */
  public update(dt: number, mouseTargetX: number = 0, mouseTargetY: number = 0): void {
    this.actionTime += dt;
    this.idleTimeCounter += dt;

    // A) Respiración Orgánica sinusoidal basal
    let breathFreq = 2.4 * this.personality.energy;
    let breathAmp = 0.035 * this.personality.expressiveness;
    if (this.currentAction === 'fall_asleep' || this.currentExpression === 'sleeping') {
      breathFreq = 1.1;
      breathAmp = 0.055;
    }

    let actionElevation = 0;
    let actionSquash = 1.0;
    let actionTiltZ = 0;
    let actionTurnY = 0;
    let actionPitchX = 0;

    // B) Lógica de las 10 Actuaciones Dramáticas
    switch (this.currentAction) {
      case 'idle_breathe':
        actionTurnY = mouseTargetX * 0.25 * this.personality.curiosity;
        actionPitchX = -mouseTargetY * 0.18;
        break;

      case 'look_at_user':
        actionTurnY = mouseTargetX * 0.45 * this.personality.gazeEngagement;
        actionPitchX = -mouseTargetY * 0.30;
        actionTiltZ = -mouseTargetX * 0.08;
        break;

      case 'tilt_curious':
        actionElevation = 0.15;
        actionTiltZ = 0.28 * this.personality.curiosity;
        actionTurnY = 0.20;
        break;

      case 'jump_bounce': {
        const period = 1.0;
        const phase = (this.actionTime % period) / period;
        if (phase < 0.22) {
          // Anticipación (Squash en el suelo)
          actionSquash = 0.72;
          actionElevation = -0.15;
        } else if (phase < 0.65) {
          // Vuelo en el aire (Stretch vertical)
          const flightT = (phase - 0.22) / 0.43;
          actionElevation = Math.sin(flightT * Math.PI) * 0.75 * this.personality.movementAmplitude;
          actionSquash = 1.28;
        } else if (phase < 0.85) {
          // Aterrizaje / Impacto (Squash amortiguador)
          actionSquash = 0.68;
          actionElevation = 0;
        } else {
          // Recuperación a reposo
          actionSquash = 1.0;
          actionElevation = 0;
        }
        break;
      }

      case 'celebrate_success': {
        const phase = (this.actionTime % 1.2) / 1.2;
        if (phase < 0.5) {
          actionElevation = Math.sin(phase * 2 * Math.PI) * 0.45;
          actionSquash = 1.22;
          actionTiltZ = Math.sin(phase * 4 * Math.PI) * 0.15;
        } else {
          actionElevation = 0;
          actionSquash = 0.85;
          actionTiltZ = 0;
        }
        break;
      }

      case 'startle_alert':
        if (this.actionTime < 0.25) {
          actionSquash = 1.35;
          actionElevation = 0.40;
        } else {
          actionSquash = 1.0 + Math.sin(this.actionTime * 18.0) * Math.exp(-this.actionTime * 5.0) * 0.22;
          actionElevation = 0;
        }
        break;

      case 'cower_retract':
        actionElevation = -0.22;
        actionSquash = 0.65;
        actionPitchX = 0.25;
        break;

      case 'stretch_wake':
        if (this.actionTime < 0.8) {
          actionSquash = 1.32;
          actionElevation = 0.18;
          actionPitchX = -0.20;
        } else {
          actionSquash = 0.88;
          actionElevation = 0;
        }
        break;

      case 'fall_asleep':
        actionElevation = -0.18;
        actionSquash = 0.82;
        actionPitchX = 0.22;
        break;

      case 'react_click':
        if (this.actionTime < 0.2) {
          actionSquash = 0.62; // Gran compresión elástica
        } else {
          actionSquash = 1.0 + Math.sin(this.actionTime * 20.0) * Math.exp(-this.actionTime * 6.0) * 0.25;
        }
        break;
    }

    // C) Cálculo final de Deformación con CONSERVACIÓN DE VOLUMEN Sxz = 1 / sqrt(Sy)
    let calculatedSy = (1.0 + Math.sin(this.actionTime * breathFreq) * breathAmp) * actionSquash;

    if (this.squashOverride !== null) {
      calculatedSy = this.squashOverride;
    }

    const calculatedSxz = 1.0 / Math.sqrt(Math.max(0.2, calculatedSy));

    // D) Acoplamiento de la Sombra de Contacto
    const elevationNorm = Math.max(0, Math.min(1.0, actionElevation / 0.75));
    const shadowScale = calculatedSxz * (1.0 + elevationNorm * 0.65);
    const shadowOpacity = 0.60 * (1.0 - elevationNorm * 0.70);

    // E) Guardar estado cinemático
    this.kinematics = {
      elevationY: actionElevation,
      squashY: calculatedSy,
      stretchXZ: calculatedSxz,
      tiltZ: actionTiltZ,
      turnY: actionTurnY,
      pitchX: actionPitchX,
      shadowScale,
      shadowOpacity
    };

    // F) Micro-Sacadas y Parpadeo de Poisson
    this.blinkTimer += dt;
    if (this.blinkTimer >= this.nextBlinkInterval) {
      this.facialChannels.eyeOpenLeft = 0.05;
      this.facialChannels.eyeOpenRight = 0.05;
      this.blinkTimer = 0;
      this.nextBlinkInterval = 2.0 + Math.random() * 3.5;
    } else if (this.facialChannels.eyeOpenLeft < 0.5 && this.currentExpression !== 'sleeping') {
      // Restauración tras parpadeo
      this.facialChannels.eyeOpenLeft = 1.0;
      this.facialChannels.eyeOpenRight = 1.0;
    }
  }
}
