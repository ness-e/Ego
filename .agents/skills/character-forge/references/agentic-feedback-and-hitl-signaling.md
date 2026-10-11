# Señalética Cognitiva de Agentes y Flujo de Aprobación Humana (HITL Signaling)

Este módulo establece el contrato formal y la representación visual de los estados operativos de un agente de IA autónomo mediante la mascota de escritorio, garantizando que el usuario comprenda el estado del sistema sin requerir la apertura obligatoria de una consola de texto.

---

## 1. Contrato de Estados Operativos Normalizados (Vendor-Agnostic)

Para evitar acoplar la mascota a la taxonomía específica de un único proveedor de IA (Claude, OpenAI, Ollama o VantaDB), el motor normaliza los eventos a una taxonomía canónica:

```typescript
export type AgentOperationalState =
  | "idle"               // Agente en reposo, listo para instrucciones
  | "thinking"           // Inferencia y razonamiento interno
  | "reading"            // Inspección de archivos o lectura de memoria
  | "writing"            // Generación de artefactos o edición de código
  | "runningTool"        // Ejecución de herramienta local/MCP
  | "waitingForApproval" // BLOQUEANTE: Requiere aprobación humana (HITL)
  | "needsInput"         // Pregunta o aclaración requerida al usuario
  | "success"            // Tarea completada con éxito
  | "warning"            // Advertencia no bloqueante (degradación)
  | "error"              // Fallo operativo recuperable
  | "rateLimited"        // Límite de frecuencia (HTTP 429 / cuota)
  | "disconnected"       // Pérdida de conexión con el runtime
  | "cancelled";         // Operación abortada por el usuario
```

---

## 2. Indicadores Visuales y Badges Flotantes

Cada estado operativo se proyecta sobre la mascota mediante una combinación de **tinte cromático corporal**, **deformación de ojos** y un **Badge flotante** anclado en la parte superior:

| Estado Operativo | Badge Flotante | Tinte Corporal | Forma Ojos | Animación Física |
|---|---|---|---|---|
| `idle` | `null` | Tinte 0.0 (Base) | `pill` | Respiración sutil |
| `thinking` | `dots` (Violeta) | Tinte 0.72 | `pill` | Mirada hacia arriba |
| `runningTool` | `dots` (Cian) | Tinte 0.75 | `wide` | Escaneo horizontal |
| `waitingForApproval` | `bang` (`!`, Ámbar) | Tinte 0.85 | `wide` | Rebote vertical continuo |
| `needsInput` | `question` (`?`, Cian) | Tinte 0.75 | `pill` | Inclinación de duda (`tilt = 0.17`) |
| `success` | `dot` (Verde esmeralda) | Tinte 0.35 | `happy` | Salto de celebración |
| `rateLimited` | `dot` (Naranja) | Tinte 0.72 | `tired` | Gotas de sudor procedural |
| `error` | `dot` (Rojo carmín) | Tinte 0.78 | `flat` | Sacudida lateral en X |

### 2.1. Animación de Tres Puntos con Fase Temporal Compartida
Para representar el procesamiento de datos (`dots`), se utiliza una fase analítica continua para evitar saltos o reinicios de animación:

$$\phi_i(t) = (\omega t + \phi_0 - i \cdot \Delta\phi) \bmod 2\pi, \quad i \in \{0, 1, 2\}$$

Donde $\omega = 2.4 \cdot 2\pi\text{ rad/s}$ y $\Delta\phi = 0.22 \cdot 2\pi$.

El radio dinámico de cada punto se calcula como:
$$r_i(t) = r_{\text{base}} \cdot \left(1 + 0.4 \cdot \max(0, \sin(\phi_i(t)))\right)$$

---

## 3. Protocolo Estricto de Aprobación Humana (HITL Protocol)

La aprobación de acciones sensibles (ejecución de comandos, mutaciones de archivos o transacciones) es un **estado crítico de máxima prioridad**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PROTOCOLO HITL: SECUENCIA DE 6 PASOS OBLIGATORIA                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Recepción del Evento: Runtime emite 'agent:approval_required' con        │
│    { requestId, toolName, description }.                                    │
│ 2. Prevalencia en el Árbitro: Interrumpe estados cosméticos y despierta     │
│    a la mascota si estaba en 'sleeping' (vuelo hacia el anclaje si aplica). │
│ 3. Señal Inequívoca: Badge 'bang' (!) parpadeante, rebote sónico y alerta   │
│    visual de contraste accesible.                                           │
│ 4. Envío de Acuse de Recibo (ACK): Se notifica al runtime 'approval_ack'    │
│    confirmando que la interfaz ha presentado la solicitud.                  │
│ 5. Interacción del Usuario: Clic en el personaje o tarjeta emergente emite  │
│    'allow' o 'deny'.                                                        │
│ 6. Actualización Condicionada: El estado visual solo transiciona a          │
│    'runningTool' o 'cancelled' TRAS recibir la confirmación del runtime.    │
└─────────────────────────────────────────────────────────────────────────────┘
```

> [!CAUTION]
> **Prohibición de Suposiciones Optimistas**: Queda estrictamente prohibido marcar una aprobación como completada o retornar a `idle` de forma optimista antes de que el runtime confirme que la decisión fue registrada.

---

## 4. Gestión de Límite de Frecuencia (Rate Limits) y Errores

### 4.1. Rate Limiting (`rateLimited`)
* La mascota adopta ojos cansados (`tired`) e inclina levemente la cabeza hacia abajo.
* Emite partículas de sudor (*sweat droplets*) calculadas con trayectoria balística hacia abajo.
* No bloquea el sistema, pero indica al usuario que el LLM está esperando por cuota de tokens.

### 4.2. Desconexión del Runtime (`disconnected`)
Si transcurre un timeout de $15\text{ segundos}$ sin recibir latidos (*heartbeats*) del proceso de IA, el personaje abandona automáticamente el estado `thinking` y transiciona a `disconnected` con una señal atenuada, evitando que el usuario crea erróneamente que el modelo sigue procesando.
