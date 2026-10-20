// geometry.js — proporciones canónicas del avatar de Ego (Robot Studio 2.5D).
//
// GEOMETRÍA PROPIA DE EGO.
//
// Aquí vive la única definición de las proporciones del robot: chasis
// superelíptico, vainas auditivas, reactor trasero, anclaje de accesorios,
// rubor y métricas de boca. Antes estas medidas vivían dispersas como
// números mágicos heredados del single-file del estudio; ahora están
// nombradas y centralizadas, de modo que la forma del avatar es una decisión
// de Ego y no una transcripción.
//
// UNIDADES: píxeles del espacio de dibujo del studio. El motor trabaja con un
// radio de chasis base (`baseR = 84` en studio/avatar.js) y escala el conjunto
// con `globalScale`; por eso las medidas absolutas son aquí la fuente de
// verdad y `rx`/`ry` se usan solo para las proporciones (ancho/alto).
//
// Adapted from ego-avatar/avatar_studio_cx_artlab_mochi_2_0.html (MIT),
// líneas 2325-2474, 2245-2320, 3030-3206, 3389-3805: se adapta el PATRÓN
// (casco, cúpula acústica, boca por estados, accesorio superior); las
// proporciones y la nomenclatura son propias.

/**
 * Chasis: superelipse con exponente variable (`squircleN`).
 * 2 = elipse, 4 = squircle marcado, >6 casi rectángulo con esquinas suaves.
 */
export const CHASSIS = Object.freeze({
  /** Exponente por defecto de la superelipse. */
  DEFAULT_EXPONENT: 4.0,
  /** Radio base del chasis en el espacio de dibujo. */
  BASE_RADIUS: 84,
  /** Proporción alto/ancho del chasis. */
  HEIGHT_RATIO: 0.92,
  /** Ancho del panel trasero rehundido, como fracción de rx. */
  REAR_PANEL_W: 0.96,
  /** Alto del panel trasero rehundido, como fracción de ry. */
  REAR_PANEL_H: 0.76,
  /** Desplazamiento vertical del panel trasero, como fracción de ry. */
  REAR_PANEL_Y: -0.38,
  /** Radio de esquina del panel trasero. */
  REAR_PANEL_RADIUS: 18,
  /** Radio del anillo del reactor. */
  REACTOR_RING_R: 16,
  /** Radio del núcleo del reactor. */
  REACTOR_CORE_R: 6,
  /** Grosor del anillo del reactor. */
  REACTOR_LINE_W: 4,
  /** Desenfoque del resplandor del reactor. */
  REACTOR_GLOW: 16,
});

/**
 * Vaina auditiva lateral ("pód"): se dibuja en dos pasadas, frontal y trasera,
 * porque la profundidad 3D la decide el giro de la cabeza.
 */
export const EAR_POD = Object.freeze({
  /**
   * Collar de unión al chasis: y, ancho, alto, radio. La x difiere por lado
   * (el collar se apoya en el borde interior de la vaina), de ahí los dos
   * valores explícitos.
   */
  SOCKET: Object.freeze({ xLeft: -4, xRight: -10, y: -21, w: 14, h: 42, r: 6 }),
  /** Cúpula acústica principal: x, y, ancho, alto, radio. */
  DOME: Object.freeze({ x: -10, y: -19, w: 20, h: 38, r: 9 }),
  /** Cámara acústica rehundida: x, y, ancho, alto, radio. */
  CHAMBER: Object.freeze({ x: -4.5, y: -13, w: 9, h: 26, r: 4.5 }),
  /** Núcleo LED: x, ancho, radio. La altura y la y dependen del pulso. */
  LED: Object.freeze({ x: -2.5, w: 5, r: 2.5 }),
  /** Alto del LED en reposo. */
  LED_IDLE_H: 14,
  /** Amplitud de la onda del LED cuando hay actividad. */
  LED_PULSE_H: 14,
  /** Radio base del anillo de onda al pasar el puntero. */
  WAVE_R: 16,
  /** Crecimiento del anillo de onda. */
  WAVE_GROWTH: 14,
  /** Desplazamiento lateral de la cámara y del LED según la profundidad 3D. */
  DEPTH_SHIFT: 2,
});

/**
 * Accesorio superior: se ancla sobre el casco y gira con `antennaAngle`.
 */
export const ACCESSORY = Object.freeze({
  /** Altura del ancla, como fracción de ry. */
  ANCHOR_Y: -0.90,
  /** Base de la antena: x, y, ancho, alto, radio. */
  ANTENNA_BASE: Object.freeze({ x: -14, y: -4, w: 28, h: 10, r: 5 }),
  /** Altura del tallo de la antena. */
  ANTENNA_STEM_H: -38,
  /** Radio de la punta de la antena. */
  ANTENNA_TIP_R: 9,
  /** Radio del anillo expansivo de la punta. */
  ANTENNA_RING_R: 10,
  /** Crecimiento del anillo expansivo de la punta. */
  ANTENNA_RING_GROWTH: 22,
  /** Grosor del aro de auriculares. */
  HEADPHONE_BAND_W: 8,
  /** Auricular: x, y, ancho, alto, radio. */
  HEADPHONE_CUP: Object.freeze({ x: -10, y: -24, w: 20, h: 48, r: 9 }),
});

/**
 * Rubor: sólo aparece sin visor (cuerpos de silueta abierta) y en estados
 * afectivos.
 */
export const BLUSH = Object.freeze({
  /** Separación mínima del rubor respecto al centro. */
  MIN_OFFSET: 26,
  /** Separación adicional al espaciado real de los ojos. */
  OFFSET_FROM_EYES: 11,
  /** Semieje horizontal de la mejilla. */
  RX: 13,
  /** Semieje vertical de la mejilla. */
  RY: 7,
  /** Altura respecto al centro de los ojos. */
  Y: 16,
  /** Grosor de los trazos del rubor. */
  STROKE_W: 1.5,
});

/**
 * Métricas de la boca. `led-wave` es el estilo por defecto de Ego.
 */
export const MOUTH = Object.freeze({
  /** Ancho de la boca abierta, en estado normal. */
  OPEN_W: 24,
  /** Ancho de la boca en sorpresa. */
  SURPRISE_W: 14,
  /** Alto de la boca en sorpresa. */
  SURPRISE_H: 15,
  /** Alto mínimo de la boca abierta. */
  OPEN_MIN_H: 4,
  /** Ganancia de altura con la apertura. */
  OPEN_H_GAIN: 16,
  /** Grosor de trazo del estilo led-wave. */
  LED_WAVE_W: 3.5,
  /** Semiancho de la onda de error. */
  ERROR_WAVE_W: 14,
  /** Paso de muestreo de la onda de error. */
  ERROR_WAVE_STEP: 2,
  /** Semiancho del ceño fruncido. */
  FROWN_W: 12,
  /** Semiancho de la boca plana. */
  FLAT_W: 10,
  /** Semiancho de la sonrisa. */
  SMILE_W: 13,
  /** Profundidad de la sonrisa neutra. */
  SMILE_DEPTH: 8,
  /** Profundidad de la sonrisa afirmativa. */
  SMILE_DEPTH_HAPPY: 12,
  /** Frecuencias de la articulación labial (sílaba A / sílaba B). */
  SYLLABLE_HZ: 24,
  SYLLABLE_HZ_B: 15.5,
  /** Frecuencia de oscilación del ancho de la boca. */
  WIDTH_HZ: 19,
  /** Frecuencia de escucha. */
  LISTEN_HZ: 12,
  /** Suavizado de la apertura. */
  OPEN_SMOOTH: 0.45,
  /** Suavizado del decaimiento. */
  DECAY_SMOOTH: 0.25,
  /** Suavizado de escucha. */
  LISTEN_SMOOTH: 0.3,
});
