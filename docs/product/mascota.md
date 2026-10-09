# Sistema de Personajes y Mascota de Ego — Fuente Vigente
### Doctrina del Sistema Procedural de Identidad Visual: Ego Base, Sub-Egos, Character DNA y Ego Activity Widget

| Campo | Valor |
| --- | --- |
| Estado | Canónico — Fuente vigente de diseño de producto y experiencia |
| Owner | ness-e / Principal Systems Engineer |
| Fecha | 2026-10-07 |
| Inspiración Técnica | Procedural Canvas Engine de `coucou` (`BotEngine`, `MochiOutfitDrawing`, `IslandStateMachine`) |
| Regla Fundamental | **El personaje es una capa visual del Cognitive Runtime procedural en código, NO imágenes generadas por IA** |
| Ubicación en Código | `apps/desktop/renderer/components/character/` y `apps/desktop/renderer/components/activity-widget/` |

> **Dirección artística canónica (Restaurada Oct 2026):** Ego y sus Sub-Egos se basan en la arquitectura procedural probada de **Coucou Mochi**: un bot/criatura carismático de silueta squircle (superelipsoide EXP=2.7) con cabeza 3D cabeceante, rostro hiper-expresivo (13 estados de ojos, boca reactiva), manos gesticulantes y un sistema integral de personalización de 6 capas (`Wardrobe`: accesorios, gorros, gafas, bufandas, lazos y distintivos). Cada Sub-Ego se distingue por su color, accesorios de especialidad, cinemática y tono, manteniendo la calidez, dinamismo y cero fatiga visual. Ver [`character-art-direction.md`](character-art-direction.md).

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

El personaje **NO es un avatar que aparece cada vez que un LLM genera texto**, ni tampoco existen "tres mascotas distintas" en la aplicación.

El sistema se rige por una regla cardinal:
> **"Un personaje, múltiples superficies, una sola fuente de estado."**

La máquina de estado reside en el `CharacterRuntime`. Las distintas superficies de la aplicación simplemente proyectan esa misma entidad en diferentes tamaños y niveles de expresividad:

```text
                      CHARACTER RUNTIME (Fuente Única)
                                     │
      ┌──────────────────────┬───────┴──────────────┬──────────────────────┐
      ▼                      ▼                      ▼                      ▼
  App Header            Active Chat            Ego Activity          Dynamic Canvas
 (Icono Estado)       (Orador Formal)        Widget (Acción)        (Área de Trabajo)
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
  4. CharacterRuntime ────────────► Proyección unificada sobre Chat, Canvas y Activity Widget
```

### Regla: La Identidad NO Cambia cuando Cambia el Estado

* **Identidad:** ¿Quién es?
  * **Ego Base:** Forma base neutra de la familia, sin rasgos adicionales, paleta sobria, mirada serena (silueta definitiva pendiente de `CHAR-03`).
  * **Sub-Ego Dev (ejemplo):** misma familia, proporción ligeramente alargada, acento frío, inclinación hacia adelante, rasgo sensorial de enfoque.
  * **Sub-Ego Finanzas (ejemplo):** misma familia, proporción compacta, acento sobrio, postura erguida, movimiento contenido.
  * Regla: la diferenciación usa proporción, `traits`, acento, ritmo y mirada. **Nunca ropa ni elementos humanos.**
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

## 6. Los 4 Niveles de Presencia en la Interfaz

| Nivel de Presencia | Superficie | Tamaño | Comportamiento |
|---|---|:---:|---|
| **1. Sistema Global** | Chrome Header | 28–36 px | Indicador de pulso y estado general de Ego. |
| **2. Orador Activo** | Conversation River (Chat) | 32–48 px | Representa a la entidad que tiene la palabra en la conversación. |
| **3. Ejecución & Control** | Ego Activity Widget | 40–90 px | Muestra tareas en progreso, telemetría y barreras de aprobación HITL. |
| **4. Trabajo Ampliado** | Dynamic Canvas | 48–120 px | Acompaña dashboards, código o artefactos interactivos de gran tamaño. |

---

## 7. El Modelo `CharacterDNA`

Cada manifestación visual se define mediante una estructura fuertemente tipada:

```ts
export interface CharacterDNA {
  /**
   * Familia visual canónica: 'mochi-squircle' (basada en el superelipsoide EXP=2.7 de Coucou).
   */
  family: "mochi-squircle";

  /** Anatomía y geometría del cuerpo squircle */
  body: {
    baseRadius: number; // Radio de escala base
    morphRatio?: number; // 0 = orgánico, 1 = angular
  };

  /** Rostro y órganos sensoriales */
  face: {
    eyeShape: "pill" | "wide" | "dot" | "line" | "flat" | "happy" | "closed" | "spiral" | "heart" | "star" | "tired" | "wink" | "cup";
    eyeSpacing: number;
    hasBlush: boolean;
  };

  /** Paleta cromática coordinada */
  palette: {
    primary: string;    // Color superior del cuerpo (gradiente)
    secondary: string;  // Color inferior del cuerpo (sombra)
    accent: string;     // Color de ojos/energía
  };

  /**
   * Capa de Guardarropa y Personalización (Wardrobe / Outfits de Coucou):
   * Permite equipar accesorios y atuendos procedurales.
   */
  wardrobe?: {
    outfitId?: "beanie" | "santaHat" | "partyHat" | "crown" | "witchHat" | "pumpkin";
    eyewearId?: "sunglasses" | "roundGlasses";
    neckwearId?: "scarf" | "bow";
  };

  /** Parámetros de personalidad y física cinética (0.0 a 1.0) */
  personality: {
    energy: number;       // Velocidad y amplitud de movimientos
    seriousness: number;  // Tensión postural y firmeza de la mirada
    warmth: number;       // Frecuencia de sonrisas y parpadeos
    playfulness: number;  // Frecuencia de rebotes y curiosidad
    curiosity: number;    // Amplitud de inclinación (tilt/head-roll)
  };
}
```

---

## 8. Presets Fundacionales de Sub-Egos (Paleta y Guardarropa Especializado)

Cada Sub-Ego se distingue inmediatamente por su paleta cromática, accesorios especializados y cinemática:

| Preset | Dominios típicos | Paleta Primaria | Outfit / Accesorio Sugerido | Tono / Movimiento |
|---|---|---|---|---|
| `Preset-Core` | Ego Nucleus | `#EDEDEF` / `#C4C5CA` (Plata limpio) | Neutro / Sin accesorio | Calmo, reflexivo, pulso suave |
| `Preset-Technical` | Ingeniería, DevOps | `#3B82F6` / `#1D4ED8` (Azul eléctrico) | `sunglasses` o `beanie` | Enfocado, cabeceo rápido |
| `Preset-Rigorous` | Finanzas, Legal | `#10B981` / `#047857` (Esmeralda oscuro) | `roundGlasses` | Firme, mirada directa |
| `Preset-Creative` | Diseño, Copywriting | `#F59E0B` / `#D97706` (Ámbar vibrante) | `partyHat` o `bow` | Elástico, ojos `happy` / `star` |
| `Preset-Strategic` | Estrategia, Producto | `#8B5CF6` / `#6D28D9` (Púrpura real) | `crown` | Pausado, postura erguida |
| `Preset-Warm` | Soporte, CRM | `#EC4899` / `#BE185D` (Rosa cálido) | `scarf` | Acogedor, parpadeo frecuente |

| Preset | Dominios típicos | Proporción / ritmo | Personalidad dominante |
|---|---|---|---|

---


## 9. Desacoplamiento Arquitectónico Total

> **Garantía Innegociable:** El Character System **NO conoce ni accede a la lógica interna de los Sub-Egos ni a VantaDB**.

Opera exclusivamente como un **consumidor reactivo de eventos**:
* Si el lienzo de Canvas se desactiva o sufre un error, **el Cognitive Runtime continúa ejecutando sin alteración**.
* La observabilidad jamás penaliza ni bloquea el trabajo productivo.
