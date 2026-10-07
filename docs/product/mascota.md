# Sistema de Personajes y Mascota de Ego — Fuente Vigente
### Doctrina del Sistema Procedural de Identidad Visual: Ego Base, Sub-Egos y Character DNA

| Campo | Valor |
| --- | --- |
| Estado | Canónico — Fuente vigente de diseño de personajes y mascota |
| Owner | ness-e / Principal Systems Engineer |
| Fecha | 2026-10-07 |
| Inspiración Técnica | Procedural Canvas Engine de `coucou` (`BotEngine`, `MochiOutfitDrawing`, `MochiWardrobe`) |
| Regla Fundamental | **El personaje es un sistema procedural en código, NO una colección de imágenes generadas por IA** |
| Ubicación en Código | `apps/desktop/renderer/components/character/` y `packages/character-runtime/` |

---

## 1. Tesis Fundamental: Sistema Procedural vs Generación por IA

Generar personajes mediante modelos de difusión de imágenes (PNGs para cada rol) produce una experiencia fragmentada, pesada e inconsistente (ángulos dispares, expresiones incoherentes y artefactos visuales).

Ego adopta la arquitectura probada en producción de Coucou (`BotEngine`), llevándola a un nivel superior:

```text
IA Generativa (Upstream)
       ↓ (Exploración conceptual de siluetas, arquetipos y paletas)
Especificación Vectorial / Geométrica
       ↓
Character System (Motor Procedural en Código)
       ↓
Canvas 2D / Path2D a 60 fps (Consistente, Paramétrico, Reactivo)
       ↓
Ego Base + Todos los Sub-Egos
```

> **Directriz de IA:** La IA generativa se utiliza **antes del personaje** (como herramienta de ideación y para sugerir configuraciones de `CharacterDNA`), **NUNCA para generar los assets gráficos en tiempo de ejecución**. El runtime dibuja el personaje matemáticamente mediante código.

---

## 2. La Mascota Base: Ego como Entidad Neutra

Ego no tiene un personaje extravagante ni una caricatura sobrecargada. Su mascota representa el **estado neutro y coordinador del sistema**:

* **Estética:** Monocromática, sobria y minimalista (Ego Black, Ego White, Ego Neutral).
* **Anatomía Base:** Geometría matemática deformable (superelipse / squircle suave).
* **Expresión:** Tranquila, atenta y receptiva; ojos expresivos proyectados sobre una superficie esférica 3D simulada que siguen el cursor del usuario.
* **Comportamiento:** Respiración sutil, parpadeo procedural y serenidad en reposo. Transmite estabilidad: es el sistema que organiza el todo.

---

## 3. Derivación de Sub-Egos: Misma Criatura, Nueva Configuración

Un Sub-Ego **NO es un personaje distinto**. Es una **configuración visual derivada de la misma criatura base**:

```text
                    EGO CHARACTER SYSTEM
                            │
                   Ego Base (Neutral)
                            │
             ┌──────────────┼──────────────┐
             │              │              │
     Sub-Ego Finanzas   Sub-Ego Dev    Sub-Ego Marketing
             │              │              │
      Misma criatura  Misma criatura  Misma criatura
      + Lentes finos  + Hoodie        + Accesorio audaz
      + Corbata       + Gafas tech    + Paleta naranja
      + Paleta verde  + Paleta azul   + Sonrisa amplia
      + Postura seria + Postura tilt  + Gestos activos
```

Esta herencia garantiza que Ego mantenga una **identidad de marca unificada, profesional y cohesiva**, independientemente de cuántos especialistas active el usuario.

---

## 4. El Modelo Character DNA

Cada manifestación visual se define mediante una estructura fuertemente tipada denominada **`CharacterDNA`**:

```ts
export interface CharacterDNA {
  /** Identificador de la especie o morfología base */
  species: "squircle-prime" | "orb-minimal" | "geom-shadow";

  /** Anatomía y geometría del cuerpo */
  body: {
    silhouette: "squircle" | "rounded-capsule" | "drop";
    width: number;
    height: number;
    cornerRadii: [number, number, number, number];
    morphRatio: number; // 0 = orgánico, 1 = prisma/caja
  };

  /** Rostro y proyección visual */
  face: {
    eyeStyle: "dot" | "visor" | "anime-minimal" | "digital-glow";
    eyeSize: number;
    eyeSpacing: number;
    pupilDilation: number;
    mouthStyle: "none" | "line" | "curve" | "digital";
  };

  /** Paleta cromática coordinada */
  palette: {
    primary: string;    // Color de piel/cuerpo
    secondary: string;  // Detalles y sombra
    accent: string;     // Color de energía/ojos
    neutral: string;    // Fondo o contraste
  };

  /** Capas de accesorios y prendas */
  accessories: AccessoryConfig[];
  outfit?: {
    id: string;
    layer: "back" | "torso" | "front";
    paletteOverride?: Partial<CharacterDNA["palette"]>;
  };

  /** Parámetros de personalidad visual (0.0 a 1.0) */
  personality: {
    energy: number;       // Velocidad y amplitud de movimientos
    seriousness: number;  // Tensión postural y firmeza de la mirada
    warmth: number;       // Frecuencia de sonrisas y parpadeos
    playfulness: number;  // Frecuencia de rebotes y curiosidad
    curiosity: number;    // Amplitud de inclinación (tilt/head-roll)
  };

  /** Mapeo de librerías de animación */
  behavior: {
    idleAnimation: "calm-breathe" | "attentive-float" | "focused-scan";
    thinkingAnimation: "orbital-pulsing" | "head-tilt-compute" | "fast-blink";
    successAnimation: "jump-glow" | "nod-spark" | "cheerful-bounce";
    errorAnimation: "dizzy-shake" | "sweat-drop" | "glitch-recenter";
    attentionAnimation: "wave-front" | "badge-pulse" | "direct-stare";
  };
}
```

---

## 5. El Sistema de Personalización en 6 Capas

El usuario o el sistema pueden moldear un Sub-Ego a través de 6 capas ortogonales:

| Capa | Atributos Paramétricos | Ejemplos |
|---|---|---|
| **1. Forma (Silhouette)** | Ancho, alto, curvatura, esfericidad, ratio de deformación | Redondo, estilizado, robusto, compacto |
| **2. Rostro (Face)** | Estilo de ojos, tamaño, separación, apertura pupilar, boca | Ojos grandes atentos, visores cibernéticos, líneas mínimas |
| **3. Color (Palette)** | Primario, secundario, acento luminoso | Monocromático, cian desarrollo, esmeralda finanzas |
| **4. Accesorios (Accessories)** | Gafas, auriculares, mochilas, insignias, sombreros | Gafas redondas, lupa de análisis, antena |
| **5. Vestimenta (Outfit)** | Capa de torso, abrigo, uniforme, accesorios textiles | Hoodie de ingeniería, corbata ejecutiva, bata de laboratorio |
| **6. Comportamiento (Behavior)** | Energía, rigidez postural, ritmo de respiración | Metódico, hiperactivo, reflexivo, protector |

---

## 6. Los 8 Presets Fundacionales de Sub-Egos

Para garantizar usabilidad inmediata sin fricción de diseño, Ego incorpora 8 arquetipos preconfigurados:

1. **`Preset-Professional` (Finanzas / Legal):** Silueta sobria, paleta neutra/azul marino, gafas sutiles, postura erguida, alta seriedad ($0.9$).
2. **`Preset-Technical` (Ingeniería / DevOps):** Silueta estilizada, paleta oscura con acentos cian, visor/gafas técnicas, inclinación hacia adelante, alta curiosidad ($0.8$).
3. **`Preset-Creative` (Diseño / Copywriting):** Silueta orgánica suave, paleta violeta/ámbar, accesorios asimétricos, rebote expresivo, alta energía ($0.7$).
4. **`Preset-Executive` (Estrategia / Producto):** Silueta equilibrada, monocromo con acento dorado, postura firme y pausada, calidez moderada ($0.6$).
5. **`Preset-Friendly` (Soporte / CRM):** Silueta redondeada, ojos amplios luminosos, paleta verde/cálida, sonrisa frecuente, alta calidez ($0.9$).
6. **`Preset-Minimal` (Ego Core / Auditoría):** Silueta squircle pura, rigurosamente blanco/negro, sin accesorios, respiración zen.
7. **`Preset-Futuristic` (Research / Criptografía):** Silueta geométrica con bordes duros, resplandor perimetral neón, pulso orbital continuo.
8. **`Preset-Playful` (Exploración / Brainstorming):** Silueta elástica deformable, animaciones de sorpresa y gestos rápidos de atención.

---

## 7. Desacoplamiento Arquitectónico Total

> **Regla de Oro:** El Character System **NO conoce ni accede a la lógica interna de los Sub-Egos ni a VantaDB**.

Opera exclusivamente como un **consumidor reactivo de eventos**:

```text
Cognitive Runtime (Main Process)
       ↓ Emite evento tipado (EgoEvent / RunEvent)
IPC Bridge (Preload seguro)
       ↓
CharacterRuntime (Renderer Component)
       ↓ Mapea evento a estado visual
CharacterStateMap (working | thinking | approval | success | error)
       ↓
Tween & Physics Engine (Interpolación de yaw, pitch, squish, bounce)
       ↓
HTML5 Canvas 2D (Renderizado a 60 fps)
```

Si el Character System se congela o desactiva, **el trabajo del Cognitive Runtime continúa exactamente igual**. La observabilidad jamás interrumpe la ejecución.
