# Puente de Eventos de Agente (Agent Event Bridge): Contratos Tipados y Adaptación Desacoplada

Este módulo formaliza la capa de comunicación y desacoplamiento entre los motores de inferencia de IA (Cognitive Runtimes, servidores MCP, agentes locales) y el motor visual del personaje.

---

## 1. El Flujo Unidireccional Desacoplado

Queda terminantemente prohibido acoplar APIs propietarias o SDKs de proveedores específicos directamente en el código de dibujo:

```
┌─────────────────┐     ┌───────────────────────┐     ┌─────────────────────┐
│ Proveedor de IA │ ──> │ Adaptador Específico │ ──> │ Evento Canónico     │
│ (Claude/OpenAI) │     │ (Payload Translation) │     │ Tipado Normalizado  │
└─────────────────┘     └───────────────────────┘     └──────────┬──────────┘
                                                                 │
                                                                 ▼
┌─────────────────┐     ┌───────────────────────┐     ┌─────────────────────┐
│ Renderizador 2D │ <── │ Pose, Expresión y     │ <── │ Árbitro de Estados  │
│ (Canvas / SVG)  │     │ Badges Resultantes    │     │ y Prioridades       │
└─────────────────┘     └───────────────────────┘     └─────────────────────┘
```

---

## 2. Contrato de Datos Tipado Canónico (`AgentEvent`)

```typescript
export type AgentEventKind =
  | "turn_start"
  | "thinking_progress"
  | "tool_call_start"
  | "tool_call_finish"
  | "approval_required"
  | "approval_resolved"
  | "user_input_required"
  | "turn_finish"
  | "rate_limit_encountered"
  | "system_error";

export interface AgentEvent {
  /** Identificador único para deduplicación */
  eventId: string;
  /** Tipo canónico del evento */
  kind: AgentEventKind;
  /** Marca temporal en milisegundos */
  timestamp: number;
  /** Identificador de sesión o conversación */
  sessionId: string;
  /** Identificador de solicitud de aprobación (si aplica) */
  requestId?: string;
  /** Carga útil con detalles semánticos */
  payload?: {
    toolName?: string;
    description?: string;
    durationMs?: number;
    errorCode?: string;
  };
  /** Nivel de prioridad */
  priority: "low" | "normal" | "high" | "critical";
}
```

---

## 3. Fiabilidad: Deduplicación, Timeouts y Desconexión

1. **Deduplicación**: Los eventos procesados se registran en una cola circular de claves (`eventId`). Eventos duplicados recibidos en menos de $2.0\text{ segundos}$ se descartan silenciosamente.
2. **Timeout de Actividad Incompleta**: Si un evento `thinking_progress` o `tool_call_start` no recibe un evento de cierre (`turn_finish` o `tool_call_finish`) en un periodo de $30\text{ segundos}$, el puente emite un evento sintetizado de advertencia (`system_error` por timeout), retornando a la mascota al estado base y evitando que permanezca congelada en modo pensamiento.
3. **Separación de Responsabilidades**: El personaje refleja y señaliza el estado del agente, pero **no toma decisiones de autorización por su cuenta**.
