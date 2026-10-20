# Sistema de Personajes y Mascota de Ego — Fuente Vigente
### Doctrina del Sistema Procedural de Identidad Visual: Ego Base, Sub-Egos, Character DNA y Ego Activity Widget

| Campo | Valor |
| --- | --- |
| Estado | Canónico — Fuente vigente de diseño de producto y experiencia |
| Owner | ness-e / Principal Systems Engineer |
| Fecha | 2026-10-07 · **actualizado 2026-10-19** (motor real: `@ego/avatar`) |
| Motor en Código | **`@ego/avatar`** — paquete `packages/avatar/`, Web Component `<ego-avatar>` (motor SVG + motor canvas *Robot Studio*) |
| Superficies | `apps/desktop/renderer/components/character/CharacterBadge.tsx` (chat, widget, selector de Sub-Egos, sidebar) · `apps/desktop/renderer/floating/` (ventana flotante) |
| Motor anterior (legacy) | `apps/desktop/renderer/components/character/core/CharacterEngine.ts` — **no es el motor vigente**; ver §10 |
| Inspiración Técnica | Procedural Canvas Engine de `coucou` (`BotEngine`, `MochiOutfitDrawing`, `IslandStateMachine`) — adaptado, con atribución MIT; ver `packages/avatar/LICENSE.md` |
| Regla Fundamental | **El personaje es una capa visual del Cognitive Runtime procedural en código, NO imágenes generadas por IA** |

> **Dirección artística canónica (Actualizada Oct 2026):** Ego y sus Sub-Egos se basan en un **motor gráfico procedural** construido sobre el Web Component `<ego-avatar>`: una entidad bio-digital/geométrica viva con cabeza paramétrica, rostro hiper-expresivo, manos gesticulantes y un sistema integral de personalización basado en **siluetas matemáticas** combinadas con **rasgos anatómicos y energéticos no humanoides** (`traits`: halos, núcleos de energía, anillos orbitales, crestas y antenas). Cero vestimenta humana (`BANNED_HUMAN_CLOTHING`), cero assets gráficos privativos de terceros y síntesis de audio pura en tiempo real (Web Audio API). Ver [`character-art-direction.md`](character-art-direction.md) y [`../architecture/character-system.md`](../architecture/character-system.md).

> **Vocabulario de siluetas.** El motor vigente (`@ego/avatar`) trabaja con **genoma procedimental** (semilla → genoma → organismo: forma, ojos, paleta, marca, apéndice, aura, temperamento) y con **presets de identidad** de Ego (`cx-faithful`, `ego-nucleus`, `ego-cyber`, `ego-sentinel`, `ego-architect`). Los nombres `delta-core` / `squircle-core` / `coucou-mochi` pertenecen al **vocabulario legacy** de `CharacterEngine` y se conservan aquí solo como histórico: el motor que se ejecuta hoy no los produce.

---

## 1. Tesis Fundamental: Sistema Procedural vs Generación por IA

Generar personajes mediante modelos de difusión de imágenes (PNGs para cada rol) produce una experiencia fragmentada, pesada e inconsistente (ángulos dispares, expresiones incoherentes y artefactos visuales).

Ego adopta la arquitectura probada en producción de Coucou (`BotEngine`), adaptándola a un Sistema Operativo Cognitivo:

```text
IA Generativa (Upstream)
       ↓ (Exploración conceptual de siluetas, arquetipos y paletas)
Especificación Vectorial / Geométrica
       ↓
Character System (Motor Procedural en Código)
       ↓
Canvas 2D / Path2D a 60 fps (Consistente, Paramétrico, Reactivo)
       ↓
Ego Base + Todos los Sub-Egos (Un Solo Motor, Múltiples Superficies)
```

> **Directriz de Producto:** La IA generativa se utiliza **antes del personaje** (como herramienta de ideación y para sugerir configuraciones de `CharacterDNA`), **NUNCA para generar los assets gráficos en tiempo de ejecución**. El runtime dibuja el personaje matemáticamente mediante código.

---

## 2. Doctrina: Un Personaje, Múltiples Superficies, Una Sola Fuente de Estado

El personaje **no es una imagen que se regenera cada vez que un LLM escribe texto**, ni tampoco existen "tres mascotas distintas" en la aplicación. Es un **organismo procedimental vivo** con identidad estable (semilla → genoma) que se proyecta en varias superficies.

El sistema se rige por una regla cardinal:
> **"Un personaje, múltiples superficies, una sola fuente de estado."**

La fuente de estado es el **`<ego-avatar>`** (`@ego/avatar`): un Web Component con 14 estados runtime y 11 emotes. Las distintas superficies de la aplicación simplemente proyectan ese mismo elemento en diferentes tamaños y niveles de expresividad:

```text
                    <ego-avatar>  (Web Component, @ego/avatar)
                                 │
       ┌──────────────────────┬─┴────────────────┬──────────────────────┐
       ▼                      ▼                  ▼                      ▼
   App Header            Active Chat        Ego Activity          Dynamic Canvas
  (Icono Estado)       (Orador Formal)     Widget (Acción)       (Área de Trabajo)
```

---

## 3. Desacoplamiento en 4 Pilares: Identidad vs Estado

El personaje representa **dos dimensiones completamente ortogonales**:

```text
Sub-Ego (Especialista Cognitivo)
  ├── 1. CharacterProfile / DNA ──► Identidad: ¿QUIÉN ES? (Invariante durante el trabajo)
  ├── 2. CharacterState ──────────► Estado: ¿QUÉ HACE? (Muta en tiempo real)
  └── 3. CharacterBehavior ───────► Cinética: ¿CÓMO REACCIONA? (Física, mirada y gestos)
         │
         ▼
  4. <ego-avatar> (motor) ────────► Proyección unificada sobre Chat, Canvas y Activity Widget
```

### Regla: La Identidad NO Cambia cuando Cambia el Estado

* **Identidad:** ¿Quién es?
  * **Ego Base:** Forma base neutra de la familia derivada del **genoma** (seed → genoma → organismo), sin rasgos adicionales, paleta limpia, mirada serena y balanceada. Preset de identidad: `ego-nucleus`.
  * **Sub-Ego Dev (ejemplo):** misma base paramétrica, paleta azul eléctrico `#3B82F6`, postura inclinada hacia adelante, rasgo de enfoque `energy-cores` o `antennae`. Preset: `ego-cyber`.
  * **Sub-Ego Finanzas (ejemplo):** proporción compacta, paleta esmeralda `#10B981`, postura erguida, movimiento contenido, rasgo de solidez `geometric-crest`.
  * Regla de diferenciación: la identidad utiliza la **forma procedimental derivada del genoma**, la **paleta cromática de dominio**, la **morfología de ojos** y el **preset de identidad** del Sub-Ego (`ego-nucleus` / `ego-cyber` / `ego-sentinel` / `ego-architect`), además de los **rasgos anatómicos abstractos no humanos (`traits`: halos, núcleos de energía, anillos orbitales, antenas)** según [`character-art-direction.md`](character-art-direction.md) y el contrato `CharacterProfile`. Prohibida la ropa humana.
* **Estado Operativo:** ¿Qué está haciendo?
  * `idle`, `listening`, `thinking`, `working`, `searching`, `using_tool`, `waiting`, `approval_required`, `question`, `success`, `warning`, `error`, `sleeping`, `attention`.

**Comportamiento en Producto:**
Cuando el Sub-Ego Dev pasa de pensar a editar un archivo en disco, no se transforma en otro personaje; **sigue siendo Dev**, pero sus ojos se enfocan y el Activity Widget refleja la micro-animación de escritura técnica.

---

## 4. Regla de Estabilidad Visual: Cero Fatiga en el Chat

El personaje **no debe convertirse en una fuente de fatiga o distracción**:

1. **Avatar Único por Turno:** En el chat, el avatar solo aparece en el primer mensaje de una intervención o cuando se produce un relevo de orador.
2. **Consultas Internas de Fondo No Mutan el Chat:** Si Meta-Ego o un especialista consulta internamente a varios Sub-Egos para armar una respuesta:
   * **El avatar del chat NO parpadea ni muta entre especialistas.**
   * Las consultas de fondo se proyectan sutilmente en el **`Ego Activity Widget`**.
3. **Cambio de Identidad Visible:** Solo se produce cuando:
   * El usuario menciona explícitamente a un especialista (`@Dev`, `@Marketing`).
   * Meta-Ego delega deliberadamente el turno formal de conversación a un Sub-Ego.

### Transición de Morphing (350–550 ms)
Cuando cambia el orador relevante, la transición es una coreografía procedural suave:
* **Fase 1: Preparación (100–150 ms):** El personaje se comprime elásticamente (squash) y retrae los rasgos salientes.
* **Fase 2: Metamorfosis (150–250 ms):** Interpola suavemente geometría y color.
* **Fase 3: Entrada (100–180 ms):** Rebote elástico ascendente y despliegue de los rasgos del nuevo especialista.

---

## 5. El `Ego Activity Widget`: Observación, Ejecución y Gobernanza

Adaptado del concepto de widget dinámico de Coucou, el **`Ego Activity Widget`** resuelve la visibilidad de los agentes sin saturar el flujo de conversación:

> **Definición de Producto:** El Activity Widget **representa actividad, ejecución y atención**, NO conversación.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        MODOS DEL ACTIVITY WIDGET                       │
├────────────────────────────────────────────────────────────────────────┤
│  1. IDLE (Reposo)                                                      │
│     [ ● ]  Discreto en el chrome de la ventana. Cero ruido visual.     │
├────────────────────────────────────────────────────────────────────────┤
│  2. EN TRABAJO (Active Execution)                                      │
│     [ Dev (40px) ]  Optimizando índices LSM... [ 78% ]                 │
├────────────────────────────────────────────────────────────────────────┤
│  3. APROBACIÓN REQUERIDA (HITL Interactivo)                            │
│     [ Dev (! 48px) ] ¿Ejecutar migración de esquema en disco?          │
│     [ ✓ Aprobar ]   [ ✗ Rechazar ]   [ 📄 Inspeccionar Diff ]           │
├────────────────────────────────────────────────────────────────────────┤
│  4. MULTI-ESPECIALISTA (Concurrencia / Pipelines)                      │
│     [Dev] [Fin] [Mkt] +2 procesos activos...                           │
└────────────────────────────────────────────────────────────────────────┘
```

### Funcionalidades Clave de Producto:
* **Interacción Inmediata sin Salir del Contexto:** El usuario puede aprobar o rechazar acciones críticas directamente en el widget mediante atajos rápidos de teclado (`Enter`, `Esc`).
* **Visualización de Pipelines Multi-Agente (Modo Narrativo):** Cuando una tarea recorre varios roles (Estrategia $\to$ Dev $\to$ QA), el widget muestra el relevo entre especialistas de forma secuencial sin generar mensajes redundantes en el chat.
* **Detached Desktop Float (Opcional):** El usuario puede arrastrar el widget fuera de la ventana principal para mantener al especialista flotando en su escritorio mientras trabaja en otros programas.

---

## 6. Las 4 Superficies de Presencia en la Interfaz (D6: "superficies", no "niveles")

| Nivel de Presencia | Superficie | Tamaño | Comportamiento |
|---|---|:---:|---|
| **1. Sistema Global** | Chrome Header (superficie `app-header`) | 28–36 px | Indicador de pulso y estado general de Ego. |
| **2. Orador Activo** | Conversation River (Chat) | 32–48 px | Representa a la entidad que tiene la palabra en la conversación. |
| **3. Ejecución & Control** | Ego Activity Widget | 40–90 px | Muestra tareas en progreso, telemetría y barreras de aprobación HITL. |
| **4. Trabajo Ampliado** | Dynamic Canvas | 48–120 px | Acompaña dashboards, código o artefactos interactivos de gran tamaño. |

---

## 7. El Modelo Canónico `CharacterProfile`

Cada manifestación visual se define mediante el contrato tipado Zod implementado en `packages/subegos/src/CharacterProfile.ts`:

```ts
export interface CharacterProfile {
  id: string; // "char_<id>" o "ego.<subego>.char"
  name: string;
  
  /**
   * Silueta base matemática del personaje:
   * 'delta-core' (triángulo C3), 'quantum-monolith', 'energy-core',
   * 'fractal-polyhedron'. LEGACY: `coucou-mochi` se elimino con el motor `@ego/avatar`.
   */
  baseForm: "delta-core" | "quantum-monolith" | "energy-core" | "fractal-polyhedron"; // + "coucou-mochi" en el motor legacy

  /** Paleta cromática coordinada */
  palette: {
    primary: string;    // Color superior de la superficie (gradiente)
    secondary: string;  // Color inferior de la superficie (sombra)
    accent: string;     // Color de ojos/energía
    aura: string;       // Resplandor perimetral
    glow?: string;      // Destello de excitación cognitiva
  };

  /** Rostro y órganos sensoriales */
  defaultEye: "pill" | "wide" | "dot" | "line" | "flat" | "happy" | "closed" | "spiral" | "heart" | "star" | "tired" | "wink" | "cup";
  defaultMouth: "flat" | "slight-smile" | "open-smile" | "o-shape" | "wavy" | "smirk" | "tongue-out" | "frown";

  /**
   * Rasgos Anatómicos y Energéticos No Humanos (TraitConfig):
   * Cero vestimenta humana (BANNED_HUMAN_CLOTHING prohíbe trajes, corbatas, gafas humanas, etc.).
   */
  traits: Array<{
    kind: "halo" | "energy-cores" | "antennae" | "floating-shards" | "aura-field" | "quantum-crown" | "orbital-rings" | "geometric-crest";
    intensity: number;  // 0.0 a 1.0
    color?: string;
    enabled: boolean;
  }>;

  scale: number;      // Factor de escala (0.5 a 3.0)
  pulseRate: number;  // Velocidad de respiración y pulso
}
```

---

## 8. Presets Fundacionales de Sub-Egos (Paleta y Rasgos Abstractos)

Cada Sub-Ego se distingue inmediatamente por su silueta geométrica, paleta cromática, rasgos anatómicos no humanos y cinemática:

| Preset | Dominios típicos | Preset de identidad (motor) |
|---|---|---|---|---|---|
| `Preset-Core` | Ego Nucleus | `ego-nucleus` | `#EDEDEF` / `#C4C5CA` (Plata limpio) | `aura-field` sobrio | Calmo, reflexivo, pulso suave |
| `Preset-Technical` | Ingeniería, DevOps | `ego-cyber` | `#3B82F6` / `#1D4ED8` (Azul eléctrico) | `energy-cores` o `antennae` | Enfocado, cabeceo rápido |
| `Preset-Rigorous` | Finanzas, Legal | `ego-sentinel` | `#10B981` / `#047857` (Esmeralda oscuro) | `geometric-crest` | Firme, mirada directa |
| `Preset-Creative` | Diseño, Copywriting | `ego-architect` | `#F59E0B` / `#D97706` (Ámbar vibrante) | `floating-shards` | Elástico, ojos `happy` / `star` |
| `Preset-Strategic` | Estrategia, Producto | `ego-architect` | `#8B5CF6` / `#6D28D9` (Púrpura real) | `quantum-crown` o `orbital-rings` | Pausado, postura erguida |
| `Preset-Warm` | Soporte, CRM | `ego-nucleus` | `#EC4899` / `#BE185D` (Rosa cálido) | `halo` | Acogedor, parpadeo frecuente |

---


## 9. Desacoplamiento Arquitectónico Total

> **Garantía Innegociable:** El Character System **NO conoce ni accede a la lógica interna de los Sub-Egos ni a VantaDB**.

Opera exclusivamente como un **consumidor reactivo de eventos**:
* Si el lienzo de Canvas se desactiva o sufre un error, **el Cognitive Runtime continúa ejecutando sin alteración**.
* La observabilidad jamás penaliza ni bloquea el trabajo productivo.

---

## 10. Qué motor ejecuta realmente el personaje

> Actualizado 2026-10-19. Esta sección sustituye a las referencias que apuntaban
> a `apps/desktop/renderer/components/character/core/CharacterEngine.ts` como si
> fuese el motor vigente.

### 10.1 El motor vigente: `@ego/avatar`

| | |
|---|---|
| Paquete | `packages/avatar/` (npm `@ego/avatar`), 0 dependencias |
| Elemento | `<ego-avatar>` — Custom Element v1 + Shadow DOM, ESM puro |
| Motores de render | **SVG** (defecto, exportable a string) y **canvas / Robot Studio** (`mode="studio"`) |
| Identidad | **genoma procedimental**: `seed` → `xmur3` → `mulberry32` → genoma inmutable (forma, ojos, paleta, marca, apéndice, aura, temperamento) |
| Vocabulario | **14 estados runtime** + **11 emotes** (`src/runtime/states.js`); el studio amplía a **22 estados** (`src/studio/config.js`) y traduce con `EGO_TO_STUDIO_STATE` / `STUDIO_TO_EGO_STATE` |
| Presets de identidad | `cx-faithful`, `ego-nucleus`, `ego-cyber`, `ego-sentinel`, `ego-architect` |
| Consumidores | `CharacterBadge.tsx` (chat, Activity Widget, selector de Sub-Egos, sidebar, Presence) y la ventana flotante (`apps/desktop/renderer/floating/`) |
| Estado en el chat | `ego-chat.tsx` computa `avatarLiveState` desde `pendingApprovals` / `activeError` / `isStreaming` / `toolEvents` / `composerText` y lo mapea al vocabulario del avatar |

**El personaje SÍ es un avatar**, en el sentido de que es una entidad
procedimental viva con identidad propia que se proyecta en varias superficies.
Lo que **no** es, y esta es la doctrina intacta: una imagen que se regenera al
escribir texto, ni un resultado de un modelo de difusión, ni un asset de
terceros. Todo se dibuja con código.

### 10.2 El motor anterior: `CharacterEngine` (legacy)

`apps/desktop/renderer/components/character/core/CharacterEngine.ts`
(998 líneas) sigue en el repo, pero **no dibuja nada en la interfaz**:

* `CharacterCanvas.tsx` y `CharacterMiniBadge.tsx` están **definidos y nunca
  renderizados** (0 usos JSX).
* La clase sólo se usa hoy por tres módulos que importan de ella **tipos**
  (`RGB`, `EyeShape`) y un utilería (`hexToRGB`): `CharacterStateMachine.ts`,
  `TraitRegistry.ts` y `CharacterMorph.ts`.
* La FSM de 14 estados (`CharacterStateMachine`) **nunca se instancia**: sólo
  se importa su *tipo*. El estado real lo computa el `useMemo` de
  `ego-chat.tsx`.

Su vocabulario (`delta-core`, `squircle-core`, `coucou-mochi`, 13 morfologías de
ojos) es **histórico** y no describe lo que se ve en pantalla.

### 10.3 Decisión pendiente

Si `@ego/avatar` absorbe a `CharacterEngine` (y qué se archiva) es una decisión
**del owner**, todavía abierta. Ver el handoff A6 de la ola de remediación del
2026-10-19.
