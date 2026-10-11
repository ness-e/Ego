# Personalidad Conductual y Reactividad Contextual (Behavioral Personality System)

Este módulo formaliza el perfil cuantitativo de personalidad y la política de selección de acciones, permitiendo que distintos personajes reaccionen con cadencias, amplitudes y estilos propios ante el mismo evento del sistema operativo o del agente inteligente.

---

## 1. El Vector Tipado de Personalidad Conductual

En lugar de etiquetas cualitativas genéricas ("simpático" o "tímido"), la personalidad se define como un vector normalizado en $[0, 1]$ con 8 dimensiones medibles:

```typescript
export interface PersonalityProfile {
  id: string;
  name: string;
  serenity: number;     // 0 = Nervioso/Hiperactivo, 1 = Flemático/Zen
  curiosity: number;    // 0 = Indiferente, 1 = Explora proactivamente
  energy: number;       // 0 = Aletargado/Bajo consumo, 1 = Rápido/Dinámico
  expressiveness: number; // 0 = Poses sutiles mínimas, 1 = Gestos amplios y deformación
  formality: number;    // 0 = Informal/Juguetón, 1 = Sobrio/Corporativo
  persistence: number;  // 0 = Abandona rápido la mirada, 1 = Mantiene foco sostenido
  sensitivity: number;  // 0 = Imperturbable a interrupciones, 1 = Altamente reactivo
  spatialModesty: number; // 0 = Invade pantalla, 1 = Permanece discreto en los bordes
}
```

---

## 2. Modulación Paramétrica de la Cinemática

El perfil de personalidad altera directamente las constantes del motor de simulación física y animación:

$$\omega_0 = 10.0 + \text{energy} \times 8.0 \quad (\text{rad/s})$$
$$\zeta = 0.50 + \text{serenity} \times 0.40 \quad (\text{amortiguamiento})$$
$$\text{Amplitud Gestual} = 0.60 + \text{expressiveness} \times 0.80$$
$$\text{Latencia de Respuesta} = (1.0 - \text{energy}) \times 180\text{ ms}$$

---

## 3. Política de Selección de Comportamiento Determinista

Cuando entra un evento, la función de utilidad selecciona la variante de actuación idónea evaluando el perfil y el historial reciente:

```typescript
export class BehaviorSelector {
  constructor(public profile: PersonalityProfile) {}

  public selectReaction(
    eventType: "user_approach" | "task_success" | "error_encountered",
    recentHistory: string[]
  ): string {
    if (eventType === "task_success") {
      if (this.profile.formality > 0.7) return "contained_nod";
      if (this.profile.expressiveness > 0.6) return "jubilant_jump";
      return "gentle_happy_eyes";
    }

    if (eventType === "user_approach") {
      if (this.profile.curiosity > 0.6) return "lean_in_inspect";
      if (this.profile.serenity > 0.7) return "slow_look_up";
      return "quick_blink_greet";
    }

    return "default_recovery";
  }
}
```

---

## 4. Microcomportamientos Aperiódicos Autónomos

Para dotar de vida orgánica continua sin sobrecargar la atención del usuario:
1. **Respiración Asimétrica**: Inhalación en $40\%$ del ciclo, exhalación en $60\%$.
2. **Micro-Sacadas Oculares**: Variación del punto de mira en $\pm 4^\circ$ cada $2.5\text{ a } 6.0\text{ s}$ mediante proceso de Poisson.
3. **Suspensión en Trabajo Crítico**: Cuando el runtime reporta `runningTool` o el usuario escribe a alta velocidad, los microcomportamientos se pausan automáticamente para no inducir fatiga visual.
