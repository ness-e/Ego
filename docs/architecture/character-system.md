# Arquitectura Canónica: Sistema de Personajes y Runtime Procedural (`CharacterSystem`)
### Motor procedimental `<ego-avatar>` (SVG + canvas), Transición Morph, Activity Widget y Renderizado Multi-Superficie

| Campo | Valor |
| --- | --- |
| Estado | Canónico — Arquitectura del Sistema · **actualizado 2026-10-19** (motor real: `@ego/avatar`) |
| Nivel Jerárquico | Nivel 4 (System Architecture) / Nivel 5 (Experience Design) |
| Owner | ness-e / Principal Systems Engineer |
| Fecha | 2026-10-07 · **actualizado 2026-10-19** |
| Referencia Fuente | Procedural Engine de Coucou (`BotEngine.swift`, `IslandStateMachine.swift`, `windows/src/mochi/`) + Doctrina Unificada de Ego. Adaptado con atribución MIT; ver `packages/avatar/LICENSE.md` |
| Motor vigente | **`@ego/avatar`** — `packages/avatar/` · Web Component `<ego-avatar>` · motores SVG y canvas (*Robot Studio*) |
| Implementación | JS ESM sin tipos con tipos públicos en `index.d.ts` (motor) + TypeScript estricto (superficies React 19) en `apps/desktop/renderer/components/character/` |
| Motor anterior (legacy) | `apps/desktop/renderer/components/character/core/CharacterEngine.ts` — **no dibuja en la interfaz**; ver §0.3 |

---

## 0. Qué motor ejecuta el personaje (lectura previa obligatoria)

> Actualizado 2026-10-19. Esta sección sustituye a las afirmaciones que
> describían `CharacterEngine` como el motor del producto.

### 0.1 El motor vigente: `@ego/avatar`

Un único **Web Component** `<ego-avatar>` con dos motores de render y un
vocabulario propio:

```text
seed ──xmur3──► mulberry32 ──► ① GENOMA (inmutable)
                                  shape{roundness,ratio} · eyes{scale,spacing,yBias}
                                  palette{hue…} · marking · appendage · aura · temperament
                                         │
                                         ▼
                              ② FENOTIPO
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
            MOTOR SVG (defecto)                    MOTOR CANVAS / ROBOT STUDIO
            render/*.js                           studio/*.js (mode="studio")
            <svg> en el shadow root                <canvas> en el shadow root
            exportable a string                   22 estados, 9 ojos, 5 bocas, 16 accesorios
                    │                                         │
                    └────────────────────┬────────────────────┘
                                         ▼
                              ③ ESTADO (15) + EMOTES (11)
                              runtime/states.js
                              (incluye `warning` = degradación tolerable)
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
        ④ PRESENCIA (FSM)                        ⑤ PUENTES AL STUDIO
        hidden/compact/home/greet                 EGO_TO_STUDIO_STATE (14 → 22)
        runtime/presence.js                       STUDIO_TO_EGO_STATE (22 → 14)
```

* **Identidad**: el genoma es inmutable; `setSeed()` regenera.
* **Estado**: 15 estados runtime + 11 emotes; el estado se traduce al
  vocabulario del studio (22) mediante el puente de `src/studio/adapter.js`.
* **Puentes de hooks**: `HOOK_STATE_MAP` (`UserPromptSubmit→thinking`,
  `Stop→finished` con auto-retorno, `PermissionRequest→approval`…).
* **Determinismo**: `xmur3` + `mulberry32`, orden de extracción fijo; ningún
  módulo de identidad usa `Math.random()`.

**Presets de identidad** (canvas): `cx-faithful`, `ego-nucleus`, `ego-cyber`,
`ego-sentinel`, `ego-architect`. No existe ningún preset de Mochi (eliminado
por la decisión D4 del 2026-10-19).

### 0.2 Cómo se conecta al chat

```
ego-chat.tsx
  └─ resolveAvatarLiveState(...)        ← estado real del chat (FUNCIÓN PURA)
       pendingApprovals → "approval_required"
       activeError      → "error"
       último tool_error→ "warning"   (solo del turno en curso)
       isStreaming      → "searching" | "using_tool" | "thinking" | "generating"
       composerText     → "listening"
       (por defecto)    → "idle"
                    │
                    ▼
       CharacterBadge.tsx
         mapCharacterStateToAvatarState()     ← 14 estados del chat → 15 del avatar
                    │
                    ▼
              <ego-avatar>                     ← @ego/avatar (Web Component)
```

> **Ola 2 (2026-07-20).** La resolución se extrajo a una **función pura**,
> `apps/desktop/renderer/components/character/avatar-live-state.ts`. Antes vivía
> dentro de un `useMemo` en un componente de ~1 900 líneas: **no era testeable
> sin montar el chat**. La función recibe además `turnStartToolSeq` porque
> `toolEvents` es **acumulativo** (es historial, no estado): sin acotarlo al
> turno en curso, un `tool_error` del turno 1 dejaba el avatar en ámbar durante
> todos los turnos siguientes. Ese fue un **bug real** que la ola encontró bajo
> una suite en verde.

`CharacterStateMachine.ts` (la FSM de 14 estados) **fue retirado** en el commit
`cce55ae` (2026-10-20), junto con `CharacterCanvas.tsx` y
`CharacterMiniBadge.tsx`. **Nunca se instanció**: su modelo de interpolación
nunca llegó a ejecutarse. El motivo está en
[ADR-0018](../adr/0018-motor-de-personaje.md) §"Retirada de la FSM legacy"
(principio **D3**: el motor del repo `avatar` *es* la primitive; la FSM era la
reimplementación).

### 0.3 El motor anterior: `CharacterEngine` (legacy)

`apps/desktop/renderer/components/character/core/CharacterEngine.ts` (998
líneas) permanece en el repo pero **no dibuja nada**:

| Elemento | Estado real |
|---|---|
| `CharacterCanvas.tsx` | **retirado** en `cce55ae` (definido y nunca renderizado: 0 usos JSX) |
| `CharacterMiniBadge.tsx` | **retirado** en `cce55ae` (idem) |
| `CharacterEngine` (clase) | sólo se usan sus **tipos** (`RGB`, `EyeShape`) y `hexToRGB`, desde `TraitRegistry.ts` y `CharacterMorph.ts`. **No dibuja nada.** |
| `CharacterStateMachine` (FSM) | **retirada** en `cce55ae`. Nunca se instanció. Su vocabulario quedó congelado en `state/character-state.ts` (14 estados) + `CharacterLegacy.test.tsx` (test de regresión del contrato legacy). |
| `CharacterMorph` | usa `hexToRGB`; su morph no está conectado al elemento |

Su vocabulario (`delta-core`, `squircle-core`, `coucou-mochi`, 13 morfologías de
ojos, silueta triangular $C_3$) describe **un motor que ya no se ejecuta**. Las
secciones 10–13 de este documento describen ese motor histórico; se conservan
como referencia de la dirección artística y del trabajo pendiente, y **no** como
descripción del producto actual.

> **Decisión pendiente del owner:** si `@ego/avatar` absorbe a `CharacterEngine`
> y qué módulos legacy se archivan (A4). Registrado en el handoff A6 de la ola
> de remediación del 2026-10-19.

### 0.4 Estado de la implementación (corregido)

| Ítem | Estado real (2026-10-20) |
|---|---|
| Motor | **REAL** — `@ego/avatar`, **274 tests** (266 + 8 de la Ola 2), typecheck real (`tsc --checkJs`), puerta geométrica de **174** combinaciones |
| Estados | **REAL** — **15** runtime + **11** emotes, conectados al chat real; `warning` (degradación tolerable) incluido |
| Estado del chat | **REAL** — `resolveAvatarLiveState` es una **función pura** (`avatar-live-state.ts`) con la precedencia `approval_required` → `error` → `warning` → `searching`/`using_tool`/`thinking`/`generating` → `listening` → `idle` |
| Guard de contrato | **REAL** — `apps/desktop/renderer/test/avatar-state-contract.test.ts` (7 tests): todo `CharacterState` existe en el motor y ninguno cae en el `idle` de reserva |
| Round-trip studio | **REAL** — **15/15** estados con identidad Ego → studio → Ego (medido sobre `src/studio/adapter.js`) |
| Identidad | **REAL** — genoma determinista por semilla; presets de identidad de Ego |
| UI | **REAL** — `CharacterBadge` en chat, Activity Widget, selector de Sub-Egos, sidebar y Presence; ventana flotante aparte |
| Modo canvas (studio) | **REAL** — 22 estados, puente bidireccional de estados, presets, genome→studio |
| `CharacterCanvas` / `CharacterMiniBadge` | **RETIRADOS** (`cce55ae`) — definidos y nunca renderizados |
| FSM `CharacterStateMachine` | **RETIRADA** (`cce55ae`) — nunca se instanció; su vocabulario quedó en `state/character-state.ts` (14 estados) |
| `CharacterEngine` (legacy) | **NO DIBUJA** — sobrevive por sus tipos (`RGB`, `EyeShape`) y `hexToRGB` |
| Persistencia de la identidad | **PARCIAL** — el perfil vive en `packages/subegos`; el genoma es regenerable desde la semilla |
| MotionGuard | **REAL** (`CharacterMotionGuard.ts`) |

---

> **Estado y correcciones (2026-10-08, actualizado 2026-10-14 — D3 parcial honesto; **SUSTITUIDO por §0 el 2026-10-19**):** el motor existe en código (`apps/desktop/renderer/components/character/`, `packages/subegos/src/CharacterProfile.ts`): CHAR-06 REAL (FSM + 7 tests), CHAR-07 REAL (TraitRegistry + 5 tests), CHAR-09 REAL (Morph + 5 tests). Parciales honestos: CHAR-05 motor real (~2000 líneas) pero 0 tests dedicados; CHAR-10 UI y contrato existen pero desconectados (lo guardado no sobrevive reinicio); CHAR-11 MotionGuard real pero faltan benchmarks CPU/memoria y golden frames. Fuente: `docs/agent-ops/reports/2026-10-14-brechas-decisiones-diseno.md` §3. La identidad visual es una **criatura/bot original, carismática y limpia, con cabeza, ojos grandes expresivos, boca y manitas/brazos procedimentales**. No es un humano con ropa de tela ni un logotipo geométrico abstracto. Tareas: `CHAR-01..11` y `WIDG-01..05` en `docs/roadmap/Backlog.md`. El widget in-app es `CANV-11`; la ventana flotante de escritorio es `WIDG-02`; ambos comparten `AttentionStateMachine` (`WIDG-03`). El motor/renderer lo implementa `CHAR-05`/`CHAR-06` (absorbe el alcance técnico de `CANV-08`).
>
> **Corrección 2026-10-19:** el párrafo anterior describe el estado del motor
> **legacy**. El motor vigente es `@ego/avatar` (274 tests, typecheck real), y
> `CharacterEngine` **no dibuja en la interfaz**. La tabla de estado real está
> en §0.4; la decisión sobre qué se archiva sigue pendiente del owner.

## 1. Visión y Doctrina: Un Personaje, Múltiples Superficies, Una Sola Fuente de Estado

El `CharacterSystem` de Ego **NO es un adorno cosmético de la interfaz, un GIF decorativo ni una colección de avatares generados por un LLM en cada respuesta**.

Es una **capa visual viva y determinista del Cognitive Runtime de Ego**, cuya única responsabilidad es proyectar en tiempo real:
1. **Identidad:** Quién está interviniendo (Ego Neutro o un Sub-Ego especializado).
2. **Estado Operativo:** Qué está haciendo el sistema (pensando, buscando, ejecutando comandos, esperando autorización humana).
3. **Nivel de Atención:** Cuánta urgencia o foco requiere del usuario humano.

### Principio Rector Innegociable

> *"Un personaje, múltiples superficies, una sola fuente de estado."*

No existen tres personajes desconectados en la aplicación (uno en el chat, otro en el widget de la barra superior y otro en el Canvas). Existe **una única máquina de estado visual en el runtime** (`CharacterRuntime`), la cual se renderiza con adaptaciones geométricas y cinéticas según la superficie en la que se manifieste.

```text
                           COGNITIVE RUNTIME (Main Process)
                                         │
                    EgoEvent (working, thinking, tool_call, approval)
                                         │
                                Typed IPC Bridge
                                         │
                           CHARACTER RUNTIME (Renderer)
                 ┌───────────────────────┴───────────────────────┐
                 │  - Fuente de verdad de Estado y Transiciones │
                 │  - Interpolador cinético de Morphing          │
                 │  - Dispatcher hacia superficies registradas   │
                 └───────────────────────┬───────────────────────┘
                                         │
         ┌───────────────┬───────────────┼───────────────┬───────────────┐
         ▼               ▼               ▼               ▼               ▼
    App Header      Active Chat    Ego Activity    Dynamic Canvas    OS Desktop
     (28-36px)       (32-48px)     Widget (40-90)    (48-120px)      (Float 48-80)
   Icono/Status    Orador activo    Ejecución/HITL   Superficie DOM   Modo flotante
```

---

## 2. Desacoplamiento Conceptual en 4 Pilares

Para evitar el acoplamiento caótico entre lógica cognitiva y presentación gráfica, el sistema se divide estrictamente en cuatro conceptos ortogonales:

```text
Sub-Ego (Entidad Cognitiva)
  ├── CharacterProfile / DNA ──► Identidad Visual (Quién es)
  ├── CharacterState ──────────► Estado Operativo (Qué hace)
  └── CharacterBehavior ───────► Cinética y Reacción (Cómo se mueve)
         │
         ▼
  CharacterRuntime (Motor de Estado y Renderizado)
         │
         ├── Proyecta sobre: [App Header | Chat | Activity Widget | Canvas | Desktop]
```

1. **`Sub-Ego` (Entidad Cognitiva):** Manifiesto del especialista, herramientas registradas, contexto y alma (`SubEgoSoul`). Reside en el Cognitive Runtime.
2. **`CharacterProfile` / `CharacterDNA` (Identidad Visual):** Familia, silueta, proporciones, paleta y rasgos anatómicos (`traits`) que definen *quién es*. No cambia cuando el especialista ejecuta tareas.
3. **`CharacterState` (Estado Operativo):** Enumeración discreta de lo que la entidad está haciendo en un instante preciso (`idle`, `thinking`, `working`, `approval_required`, etc.).
4. **`CharacterBehavior` (Cinética y Expresión):** Algoritmos de movimiento, física de resortes, seguimiento ocular con proyección 3D simulada y amplitudes de respiración asociadas al estado y la personalidad del especialista.

---

## 3. Separación Ortogonal entre Identidad y Estado

### La Identidad NO Muta cuando Cambia el Estado

Un error común de diseño es asociar una apariencia completamente nueva a cada acción. En Ego:
* **Ego Base (Coordinador):** forma base neutra de la familia (silueta definida en `CHAR-03`), paleta sobria, sin rasgos adicionales, mirada serena y equilibrada.
* **Sub-Ego Dev (ejemplo):** misma familia, proporción ligeramente alargada, acento frío, rasgo sensorial de enfoque, postura inclinada hacia adelante.
* **Sub-Ego Finanzas (ejemplo):** misma familia, proporción compacta, acento sobrio, postura erguida y movimiento contenido.
* **Regla:** la diferenciación usa proporción, `traits`, acento, ritmo y mirada. Nunca ropa ni elementos humanos.

Cuando el **Sub-Ego Dev** pasa de `idle` a `thinking`, luego a `using_tool` (editando código) y finalmente a `approval_required`:
* **Su identidad sigue siendo Dev:** conserva su acento, su proporción y sus rasgos.
* **Solo muta su estado operativo:** Sus ojos se entrecierran en concentración, la cabeza oscila suavemente siguiendo un reloj interno de cómputo y, al requerir aprobación, sus ojos se agrandan y el widget emite una pulsación perimetral de atención.

### Máquina de Estados Operativos Canónicos (`CharacterState`)

```ts
export type CharacterState =
  | "idle"               // Reposo; respiración sutil y parpadeo biológico
  | "listening"          // Usuario escribiendo en el composer; ojos atentos hacia la entrada
  | "thinking"           // Inferencia o razonamiento del modelo; mirada en cálculo reflexivo
  | "working"            // Ejecutando código, workers o procesos locales de larga duración
  | "searching"          // Búsqueda en VantaDB, GraphRAG o motor web; ojos orbitando
  | "using_tool"         // Ejecución activa de una tool puntual con micro-gesto reactivo
  | "waiting"            // Esperando respuesta externa asíncrona (red, webhook, compilación)
  | "approval_required"  // Bloqueado en barrera HITL; exige decisión explícita del humano
  | "question"           // Interpelación directa al usuario para clarificar requisitos
  | "success"            // Tarea culminada satisfactoriamente; destello o rebote de confirmación
  | "warning"            // Advertencia no crítica o resultado con degradación tolerable
  | "error"              // Excepción, fallo irrecuperable o rechazo de política de seguridad
  | "sleeping"           // Ventana sin foco o inactividad prolongada; reducción a 15 fps / reposo
  | "attention";         // Proactividad espontánea o alerta de background no solicitada
```

> **Este es el vocabulario de la CAPA DE CHAT**, no el del motor. `CharacterBadge`
> lo traduce al vocabulario del avatar con `mapCharacterStateToAvatarState()`
> (14 → 14): `generating` → `working`, `using_tool` → `working`,
> `approval_required` → `approval`, y el resto pasa 1:1. A su vez, el motor
> canvas traduce ese vocabulario de 14 al suyo de 22 con `EGO_TO_STUDIO_STATE`
> (`src/studio/adapter.js`). El motor SVG usa los 14 directamente.

---

## 4. Regla de Estabilidad Visual y Política Anti-Fatiga

### Sin Animaciones ni Cambios de Personaje en Cada Respuesta

El personaje **NO debe convertirse en una distracción cinética**. Si la interfaz baila, parpadea o cambia de forma constantemente, el usuario la desactivará.

### Reglas de Estabilidad:

1. **Avatar de Chat Único por Turno:** En el Conversation River, el avatar del personaje solo se renderiza en el primer mensaje de una ráfaga o cuando cambia el orador. Los mensajes consecutivos del mismo especialista no repiten el avatar para preservar la densidad de lectura.
2. **Aislamiento de Consultas Internas de Fondo:** Si Meta-Ego o el Sub-Ego orador consulta internamente a tres Sub-Egos en paralelo para contrastar hechos o verificar código antes de redactar la respuesta:
   * **El avatar visible del chat NO muta ni cambia de cara 3 veces por segundo.**
   * Esas consultas de fondo se proyectan exclusivamente en el **`Ego Activity Widget`** o en el badge de telemetría de ejecución.
3. **Condiciones Únicas de Cambio de Identidad en Superficie Principal:**
   * Mención explícita del usuario (`@Marketing`, `@Dev`).
   * Transición deliberada de orador donde Meta-Ego formalmente cede la palabra visible a un especialista específico.

---

## 5. Evento de Transición y Algoritmo de Morphing en 3 Fases

Cuando se confirma un cambio de orador visible, el sistema no realiza un corte seco (`pop`) ni una transformación infinita. Ejecuta una **interpolación paramétrica en 3 fases continuas**:

### Contrato del Evento de Transición (`SUBEGO_ACTIVATED`)

```ts
export interface CharacterTransitionEvent {
  type: "SUBEGO_ACTIVATED";
  timestamp: number;
  previousSubEgoId: string | null;
  nextSubEgoId: string;
  previousProfile: CharacterProfile;
  nextProfile: CharacterProfile;
  reason: "user_mention" | "delegated_speaker" | "domain_switch" | "session_init";
  visibleToUser: boolean; // Si es false, solo se actualiza el Activity Widget sin mutar el chat principal
}
```

### Algoritmo de Morphing en 3 Fases (Duración Total: 350–550 ms)

```text
       t = 0 ms              t ≈ 120 ms              t ≈ 320 ms              t ≈ 480 ms
   ┌─────────────┐       ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
   │ Especialista │ ────► │ Contracción │ ────► │ Metamorfosis│ ────► │ Rebote de   │
   │  Anterior   │       │  (Squash)   │       │  Geométrica │       │ Entrada     │
   └─────────────┘       └─────────────┘       └─────────────┘       └─────────────┘
     Fase Actual           Fase 1: Prep          Fase 2: Morph         Fase 3: Entry
                          (100 - 150 ms)        (150 - 250 ms)        (100 - 180 ms)
```

1. **Fase 1: Preparación (100–150 ms):**
   * El cuerpo se contrae verticalmente ($\text{scaleY} \approx 0.82$, $\text{scaleX} \approx 1.15$), simulando carga de energía elástica.
   * Los rasgos del especialista saliente se retraen con un fade-out acelerado (`opacity` $\to 0$).
   * Los ojos se cierran ligeramente en anticipación.
2. **Fase 2: Transformación (150–250 ms):**
   * Interpolación matemática de los semiejes de la superelipse ($a, b, n$) desde la forma anterior a la nueva.
   * Interpolación cromática en espacio de color OKLab para transiciones suaves de tonalidad sin cortes grises sucios.
   * Intercambio de rasgos en el punto de máxima compresión física.
3. **Fase 3: Entrada y Asentamiento (100–180 ms):**
   * El cuerpo se expande con un rebote elástico amortiguado ($\text{scaleY} \approx 1.08 \to 1.00$).
   * Los nuevos ojos se abren con la postura y mirada características del nuevo especialista.
   * Los rasgos oscilan mediante `TraitPhysics` absorbiendo la inercia del movimiento.

---

## 6. Arquitectura del `Ego Activity Widget`

Inspirado en el patrón de alta observabilidad de Coucou (`NotchBuddy`), Ego implementa el **`Ego Activity Widget`**.

> **Definición de Función:** El `Ego Activity Widget` **NO es un chat ni una ventana de conversación**. Es una **superficie compacta de telemetría de ejecución, atención y gobernanza interactiva**.

### Estados Estructurales del Widget:

```text
1. MODO REPOSO (IDLE COMPACTO)
   ┌──────────────┐
   │ [●] Todo OK  │  (Discreto en el chrome de la ventana; no invade ni distrae)
   └──────────────┘

2. MODO TRABAJO ACTIVO (SPECIALIST RUNNING)
   ┌─────────────────────────────────────────────────────────────┐
   │ [ Dev (40px) ]  Compilando módulos TypeScript... [ 64% ]   │
   └─────────────────────────────────────────────────────────────┘

3. MODO APROBACIÓN HITL (EXPANDIDO INTERACTIVO)
   ┌─────────────────────────────────────────────────────────────┐
   │ [ Dev (! 48px) ] ¿Autorizar mutación de `package.json`?    │
   │ Archivo: +2 deps | Riesgo: Medio                            │
   │ ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
   │ │  ✓ Aprobar   │  │  ✗ Rechazar  │  │  📄 Ver Diff (Tab)  │ │
   │ └──────────────┘  └──────────────┘  └─────────────────────┘ │
   └─────────────────────────────────────────────────────────────┘

4. MODO BATCH / MULTI-ESPECIALISTA (PARALELO)
   ┌─────────────────────────────────────────────────────────────┐
   │ [Dev] [Fin] [Mkt] +2 tareas en background... [Ver Cola]    │
   └─────────────────────────────────────────────────────────────┘
```

* **Reposo (`idle`):** Ocupa un espacio mínimo (`[ ● ]`) en el encabezado de la ventana.
* **Ejecución Activa:** Despliega al especialista relevante ejecutando la tarea en tiempo real con microanimación y barra de progreso no intrusiva.
* **Gobernanza HITL:** Cuando una herramienta sensible exige confirmación, el widget se expande suavemente, mostrando al especialista en estado `approval_required`, el resumen de impacto y botones de acción inmediata accesibles con teclado (`Enter` = aprobar, `Esc` = rechazar, `Space` = inspeccionar diff en Canvas).
* **Concurrencia Multi-Sub-Ego:** Cuando varios especialistas trabajan en paralelo, muestra sus miniaturas (`[Dev] [Fin] [Mkt] +2`) permitiendo desplegar la cola de ejecución.

---

## 7. Matriz de Intensidad Multi-Superficie (`Multi-Surface Intensity Matrix`)

Cada superficie visual de Ego tiene restricciones físicas y de atención específicas:

| Superficie | Tamaño Base | Tasa Refresco (fps) | Amplitud Física | Comportamiento Mirada | Rol Principal |
|---|:---:|:---:|:---:|---|---|
| **`app-header`** | 28–36 px | 30 fps (dinámico) | Mínima ($\le 5\%$) | Fijo al centro / indicador | Presencia global del sistema en el marco de ventana |
| **`chat`** | 32–48 px | 60 fps (en habla) / 15 fps (idle) | Media ($\le 12\%$) | Atento al texto o usuario | Orador formal del turno de conversación |
| **`canvas`** | 48–120 px | 60 fps | Completa ($\le 25\%$) | Sigue puntero del ratón | Acompañamiento del espacio de trabajo interactivo |
| **`activity-widget`** | 40–90 px | 60 fps | Reactiva a tools | Alerta, foco en acción | Telemetría viva de procesos y aprobaciones HITL |
| **`notification`** | 20–28 px | Estático / Pulso | Cero | Fijo al centro | Icono de alerta en el centro de notificaciones |
| **`desktop-float`** | 48–80 px | 60 fps | Orgánica ($\le 30\%$) | Proyección 3D al cursor | Modo flotante independiente en el escritorio del SO |

### Triple Superficie Operativa: Widget In-App vs Tray OS vs Flotante (cierre isla 2026-10-15)

Las tres superficies comparten la misma `AttentionStateMachine` (WIDG-03) y no se duplican:

- **Widget in-app (`activity-widget`, CANV-11):** telemetría de ejecución + aprobaciones HITL dentro de la ventana de Ego. Es la superficie primaria cuando la app está visible.
- **Tray OS (COUC-19 ✅):** icono a nivel sistema operativo con código de color mínimo (verde idle, azul pensando, rojo HITL) + menú Open/Settings/Pause/Quit + click-restore. Espejo de estado, nunca superficie de trabajo.
- **Flotante desktop-float (WIDG-02, COUC-17/18 ✅):** ventana independiente (`FloatingWindow.ts` + `renderer/floating/floating.html`) con avatar mini, vistas (overview/pill/approval/question/ticker), sonido procedural (COUC-20 parcial) y UploadCanvas. Auto-aparece al minimizar con trabajo/HITL (D2), se silencia o desactiva por preferencia persistente.

Regla: visible una sola superficie de trabajo por vez (app visible → widget; minimizada → flotante; sin ventana → tray como espejo).

---

## 8. Expresividad Reactiva a Herramientas (`Tool-Reactive Expressiveness`)

El especialista no solo adopta un estado `working` genérico. El `CharacterRuntime` modula micro-gestos visuales según la categoría de la herramienta ejecutada:

```ts
export interface ToolAnimationMapping {
  toolCategory: "filesystem" | "terminal" | "database" | "network" | "testing";
  eyeMotion: "scan-horizontal" | "digital-focus" | "orbital-spin" | "blink-rapid";
  bodyMicroGesture: "typing-vibration" | "pulse-breath" | "head-nod" | "nod-spark";
  auxiliaryIcon?: string; // Símbolo vectorial sutil proyectado temporalmente
}
```

| Categoría de Tool | Micro-Animación Procedural | Expresión Visual |
|---|---|---|
| **Lectura/Escritura de Archivos & Git** | Ojos escaneando de izquierda a derecha (`scan-horizontal`). | Concentración metódica; leve vibración de trabajo técnico. |
| **Terminal & Compilación** | Pulso rítmico perimetral (`pulse-breath`). | Cabeza orientada hacia abajo en foco estricto. |
| **VantaDB Retrieval & GraphRAG** | Pupilas orbitando en anillo luminoso (`orbital-spin`). | Consulta profunda a la memoria asociativa del sistema. |
| **Búsqueda Web / Network** | Parpadeo rápido de sincronización (`blink-rapid`). | Antena o visor técnico emitiendo ondas de enlace. |
| **Tests Pasados / Verificación Exitosa** | Rebote con destello luminoso perimetral (`nod-spark`). | Validación completada con certeza. |
| **Test Fallido / Error de Linter** | Sobresalto corporal leve con gota de sudor procedural. | Detección inmediata de anomalía que requiere corrección. |

---

## 9. Visualización de Pipelines Multi-Agente: Modo Narrativo

Para flujos de trabajo complejos donde intervienen varios especialistas en cascada (ejemplo: *Estrategia $\to$ Producto $\to$ Dev $\to$ QA $\to$ Finanzas*), Ego implementa el **Modo Narrativo**:

1. **Sin Contaminación del Chat:** No se emiten 5 mensajes de texto diciendo *"Pasando la tarea a Dev..."* o *"QA ahora revisa..."*.
2. **Relevos en el Activity Widget:** El widget muestra la transición visual de los especialistas en la barra de progreso:
   * Aparece Estrategia, completa su análisis.
   * Realiza un relevo fluido hacia Dev, quien asume el foco en el widget mientras escribe el código.
   * Culmina con QA verificando la suite de tests.
3. **Resumen Consolidado:** Al finalizar el ciclo completo, el orador principal emite un único mensaje de alto valor en el chat con los resultados consolidados y los enlaces a los artefactos en Canvas.

---

## 10. Anatomía y Geometría Procedural del Cuerpo

> **LEGACY (2026-10-19).** Esta sección describe la geometría de
> `CharacterEngine`, que **no se ejecuta**. La geometría vigente del motor
> está en `packages/avatar/src/studio/render/geometry.js` (proporciones
> canónicas del robot de Ego) y en `packages/avatar/src/render/` (motor SVG:
> plantilla paramétrica de 160 puntos + genoma). Se conserva como registro de
> la dirección artística y del trabajo pendiente.

El cuerpo se dibuja analíticamente mediante matemáticas polares y curvas continuas (cero sprites rasterizados ni imágenes estáticas). El runtime soporta una familia parametrizable de geometrías declaradas en `BaseFormSchema` (`packages/subegos/src/CharacterProfile.ts`):

### A. Geometría Canónica Primaria: Triángulo Delta Core (`delta-core`)
Silueta equilátera de esquinas redondeadas con simetría armónica $C_3$, vértice superior en $-\pi/2$ y base horizontal convexa:
$$\theta_{rot} = a + \frac{\pi}{2}$$
$$k = \cos(3\theta_{rot})$$
$$r(a) = 0.92 + 0.38 \cdot k - 0.07 \cdot (k^2 - 0.5)$$
$$px_{tri} = \cos(a) \cdot r(a) \cdot 1.18, \quad py_{tri} = \sin(a) \cdot r(a) \cdot 1.08 + (r_y \cdot 0.16)$$

* **Compensación de Ojos en Y:** Para evitar colisiones con el estrechamiento superior del triángulo, la proyección 3D desplaza dinámicamente los ojos hacia el centro de masa visual:
  $$ey = -\sin(\text{eyePitch}) \cdot r_y + (\text{triangleMorph} \cdot r_y \cdot 0.14)$$

### B. Geometría de Superelipse Paramétrica (`coucou-mochi` / `squircle-core`)
Curva continua de Lamé con exponente $EXP = 2.7$ (el nombre `coucou-mochi` se **eliminó** del motor el 2026-10-19, con la decisión D4; queda sólo como histórico):
$$| \frac{x}{a} |^n + | \frac{y}{b} |^n = 1 \quad (n = 2.7)$$

### C. Morphing Procedural Continuo entre Siluetas
La interpolación punto a punto entre la superelipse y el triángulo se calcula en tiempo real para los 72 vértices del trazado `Path2D`:
$$px = \text{lerp}(px_{squircle}, px_{tri}, \text{morph}), \quad py = \text{lerp}(py_{squircle}, py_{tri}, \text{morph})$$

```ts
export interface BodyGeometry {
  width: number;
  height: number;
  baseForm: "delta-core" | "quantum-monolith" | "energy-core" | "fractal-polyhedron" | "coucou-mochi";
  triangleMorph: number;  // 0 = superelipse, 1 = triángulo Delta Core
  scaleX: number;
  scaleY: number;
  tilt: number;           // Inclinación lateral reactiva
  verticalOffset: number; // Rebote y respiración
}
```

---

## 11. Proyección 3D Simulada de Mirada y Rostro

> **LEGACY (2026-10-19).** Describe `CharacterEngine`. La proyección de mirada
> vigente vive en `packages/avatar/src/render/projection.js` (motor SVG) y en
> `packages/avatar/src/studio/rig/eyes.js` (motor canvas): `eyeYaw`,
> foreshortening y umbral de 0,04, con el mismo modelo de origen.

Los ojos **no se dibujan en coordenadas fijas del lienzo 2D**, sino que se proyectan sobre una **superficie esférica tridimensional simulada**:

```text
                 Simulated 3D Sphere
                      ╭───────╮
                     │   ▲     │
       yaw (← →) ───►│ (o) (o) │◄─── pitch (↑ ↓)
                     │   ▼     │
                      ╰───────╯
                          │
                  Proyección Ortográfica
                          ↓
                Canvas 2D Coordinates
```

### Cálculo de Posición y Perspectiva
1. **Entrada de Foco:** Se calcula el ángulo entre el centro del personaje y el cursor del ratón o el punto focal de atención:
   $$\text{targetYaw} = \arctan2(\Delta x, \text{depth}), \quad \text{targetPitch} = \arctan2(\Delta y, \text{depth})$$
2. **Inercia y Suavizado:** `yaw` y `pitch` se interpolan con un resorte amortiguado (damping ratio $\zeta \approx 0.75$).
3. **Deformación por Perspectiva:** Cuando la cabeza gira hacia la derecha (`yaw > 0`), el ojo izquierdo se comprime horizontalmente y se acerca al borde, mientras el ojo derecho se desplaza hacia el centro, simulando volumen esférico real.

---

## 12. Pipeline de Renderizado Multi-Capa en Canvas 2D / Path2D

> **LEGACY (2026-10-19).** Describe las 6 capas del motor `CharacterEngine`.
> El pipeline vigente del **motor canvas** (`@ego/avatar`, modo studio) tiene 7
> capas en `packages/avatar/src/studio/avatar.js` → `draw()`: sombra · chasis
> · reactor trasero · vainas auditivas · visor · ojos · boca · manos ·
> accesorios · partículas. El **motor SVG** tiene su propia estructura de
> grupos en `packages/avatar/src/render/shell.js` (`.aura`, `.appendage`,
> `.motion-group`, `.head-follow`, `.body-group`, `.eyes-clip`, `.badge`,
> `.particles`).

Cada fotograma se compone en el orden estricto de capas para garantizar la integridad visual sin colisiones de oclusión:

```text
┌─────────────────────────────────────────────────────────────┐
│                 RENDER PIPELINE POR CAPAS                   │
├─────────────────────────────────────────────────────────────┤
│  1. Capa Trasera (Back Traits)                              │
│     Rasgos detrás del cuerpo: apéndices, halos, estelas.    │
├─────────────────────────────────────────────────────────────┤
│  2. Sombra Dinámica (Drop Shadow)                           │
│     Elipse difusa proyectada en la base del personaje.      │
├─────────────────────────────────────────────────────────────┤
│  3. Cuerpo (Silueta de la familia, CHAR-03)                 │
│     Path2D de la silueta, gradiente de volumen y brillo.    │
├─────────────────────────────────────────────────────────────┤
│  4. Rasgos del Cuerpo (Body Traits)                         │
│     Marcas, crestas o texturas recortadas por el cuerpo.    │
├─────────────────────────────────────────────────────────────┤
│  5. Rostro / Órgano Sensorial (Eyes, Pupils, Mouth)         │
│     Ojos proyectados en 3D, parpadeos, rubor y gestos.      │
├─────────────────────────────────────────────────────────────┤
│  6. Capa Frontal (Front Traits)                             │
│     Antenas, visores orgánicos, destellos anatómicos.       │
├─────────────────────────────────────────────────────────────┤
│  7. Partículas & Efectos Reactivos (Overlays)               │
│     Glow de pensamiento, chispas de éxito, gotas de sudor.  │
└─────────────────────────────────────────────────────────────┘
```

---

## 13. Física de Inercia y Resortes para Rasgos (`TraitPhysics`)

> **LEGACY (2026-10-19).** Describe `CharacterEngine`. La física vigente está
> en `packages/avatar/src/core/anim.js` (springs sub-stepped a 240 Hz) y
> `packages/avatar/src/core/timeline.js` (tweens por campo con *locks*),
> con el muelle *jelly* de impacto y el seguimiento de cabeza por *deadband*.

Los rasgos anatómicos con holgura (apéndices, crestas, antenas) no son calcomanías estáticas; reaccionan a las aceleraciones del personaje. Se mantiene el integrador de resorte amortiguado, reimplementado con constantes propias (adaptado del patrón de Coucou, MIT):

```ts
export class TraitPhysics {
  x = 0; y = 0;
  vx = 0; vy = 0;
  private readonly stiffness = 120; // Rigidez del resorte (a calibrar en CHAR-05)
  private readonly damping = 14;    // Amortiguación (a calibrar en CHAR-05)

  update(targetX: number, targetY: number, dt: number) {
    const ax = (targetX - this.x) * this.stiffness - this.vx * this.damping;
    const ay = (targetY - this.y) * this.stiffness - this.vy * this.damping;
    this.vx += ax * dt;
    this.vy += ay * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
}
```

---

## 14. Enlace Orgánico entre `SubEgoSoul` y `CharacterProfile`

El alma del especialista ([`SubEgoSoul`](subego-soul.md)) gobierna directamente los parámetros de identidad y reactividad del `CharacterProfile`:

```text
SubEgoSoul (Arquitectura Cognitiva)
  ├── tone: "analytical-critical" ────► CharacterProfile.traits: ["geometric-crest"]
  ├── temperament.skepticism = "high" ─► CharacterProfile.defaultEye = "line"
  ├── temperament.proactivity = "high" ─► CharacterProfile.pulseRate = 1.3
  └── identityName: "Architect-Prime" ──► CharacterProfile.baseForm = "delta-core"
```

El especialista mantiene coherencia integral: su postura visual refleja su rigor analítico.

---

## 15. Presupuesto de Rendimiento, Benchmarks y Tolerancia a Fallos

* **Consumo de CPU:** $\le 1.0\%$ en reposo (idle); $\le 2.5\%$ en animación activa a 60 fps en una CPU x86_64 o ARM moderna.
* **Frecuencia Adaptativa:** Si la ventana de Ego pierde el foco del sistema operativo o el usuario no interactúa en 60 segundos, la tasa de refresco conmuta automáticamente a **15 fps** o se congela en modo estático determinista (`StillPose`, pose estática determinista).
* **Cero Dependencias Externas Pesadas:** 100% Canvas 2D y Path2D nativos. Sin WebGL redundante ni motores de 500 KB (sin Rive, sin Lottie, sin three.js en P0).
* **Tolerancia Absoluta a Fallos:** Si el renderizador de Canvas produce una excepción no controlada, un `ErrorBoundary` de React aísla el lienzo sin alterar la ejecución de los agentes ni congelar el IPC.
