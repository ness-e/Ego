# Personality Traits, Behavioral Styles & Contextual Reactions

Este documento formaliza la definición cuantitativa de rasgos de personalidad y la matriz de reacciones contextuales que modula el comportamiento del personaje ante eventos del usuario y la aplicación.

---

## 1. El Vector Cuantitativo de Personalidad

La personalidad del personaje no es una etiqueta estática. Se codifica mediante un vector de **6 Parámetros Conductuales Normalizados $[0.0, 1.0]$** que alteran matemáticamente la velocidad, amplitud y latencia de sus acciones:

```typescript
export interface CharacterPersonalityTraits {
  energy: number;            // 0.0 (lento, pesado, sosegado) a 1.0 (eléctrico, rápido, saltarín)
  reactionSpeed: number;     // 0.0 (reflexivo, pausas largas) a 1.0 (respuestas instantáneas)
  gestureAmplitude: number;  // 0.0 (microgestos sutiles) a 1.0 (gestos teatrales amplios)
  curiosity: number;         // 0.0 (centrado en su tarea) a 1.0 (investiga cada movimiento de cursor)
  formality: number;         // 0.0 (posturas relajadas asimétricas) a 1.0 (erguido, simétrico, militar)
  timidity: number;          // 0.0 (audaz, contacto visual firme) a 1.0 (esquiva mirada, cauto)
}
```

### 1.1. Modulación Cinemática Directa por Rasgos:
$$\text{VelocidadEfectiva} = v_{\text{base}} \cdot \left(0.6 + 0.8 \cdot \text{energy}\right)$$

$$\text{AmplitudGesto} = A_{\text{base}} \cdot \left(0.5 + 0.9 \cdot \text{gestureAmplitude}\right)$$

$$\text{LatenciaReacción} = t_{\text{base}} \cdot \left(1.4 - 0.9 \cdot \text{reactionSpeed}\right)$$

---

## 2. Arquetipos de Personalidad Precalibrados

| Arquetipo | Energy | Reaction | Amplitude | Curiosity | Formality | Timidity | Comportamiento Típico |
|---|---|---|---|---|---|---|---|
| **El Centinela Técnico (Axiom)** | 0.45 | 0.85 | 0.60 | 0.70 | 0.85 | 0.10 | Postura erguida, movimientos precisos sin rebotes excesivos, contacto visual directo y sobrio. |
| **La Mascota Curiosa (Kairo)** | 0.80 | 0.75 | 0.90 | 0.95 | 0.20 | 0.15 | Inclinaciones frecuentes de cabeza, mirada inquieta que explora el cursor, rebotes ágiles y festivos. |
| **El Analista Sereno** | 0.25 | 0.40 | 0.35 | 0.50 | 0.70 | 0.30 | Movimientos lentos y calculados, pausas de reflexión prolongadas, respiración profunda. |
| **El Asistente Tímido** | 0.35 | 0.60 | 0.40 | 0.80 | 0.40 | 0.85 | Evita la mirada directa prolongada, se retrae si el cursor se acerca demasiado, expresiones suaves. |

---

## 3. Matriz de Reacciones Contextuales ante Eventos de la Aplicación

```typescript
export interface ContextualEventReactionRule {
  eventType: string;
  facialTarget: string;
  intentToTrigger: string;
  delayMs: number;
}

export function resolveContextualReaction(
  event: { type: string; payload?: unknown },
  personality: CharacterPersonalityTraits
): ContextualEventReactionRule {
  const isTimid = personality.timidity > 0.6;
  const isEnergetic = personality.energy > 0.7;

  switch (event.type) {
    case 'CURSOR_PROXIMITY_ALERT':
      // Cursor a menos de 40px del rostro
      return {
        eventType: event.type,
        facialTarget: isTimid ? 'timidity' : 'curiosity',
        intentToTrigger: isTimid ? 'recoil' : 'observe',
        delayMs: Math.round(180 * (1.2 - personality.reactionSpeed)),
      };

    case 'API_CALL_START':
      return {
        eventType: event.type,
        facialTarget: 'concentration',
        intentToTrigger: 'ponder',
        delayMs: 100,
      };

    case 'API_CALL_SUCCESS':
      return {
        eventType: event.type,
        facialTarget: isEnergetic ? 'enthusiasm' : 'satisfaction',
        intentToTrigger: isEnergetic ? 'celebrate' : 'comprehend',
        delayMs: 80,
      };

    case 'API_CALL_ERROR':
      return {
        eventType: event.type,
        facialTarget: 'frustration',
        intentToTrigger: 'error_reaction',
        delayMs: 60,
      };

    case 'USER_INACTIVE_IDLE':
      // Más de 8 segundos sin interacción
      return {
        eventType: event.type,
        facialTarget: 'serenity',
        intentToTrigger: 'observe',
        delayMs: 500,
      };

    default:
      return {
        eventType: 'NONE',
        facialTarget: 'neutral',
        intentToTrigger: 'observe',
        delayMs: 200,
      };
  }
}
```
Esto asegura que las reacciones del personaje resulten coherentes con su identidad de marca y estables a lo largo del tiempo.
