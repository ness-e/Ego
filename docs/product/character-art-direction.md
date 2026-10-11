# Dirección Artística Canónica: Sistema Procedural de Avatares Canvas 2D de Ego

| Campo | Valor |
| --- | --- |
| ID Documento | `DIR-ART-CHAR-CANONICAL` |
| Estado | **CANÓNICO Y VIGENTE** (Sincronización con Motor Procedural Canvas 2D Oct 2026) |
| Herencia Técnica | Motor Canvas 2D procedural adaptado de `BotEngine` (sin imágenes IA en runtime, MIT) |
| Componentes en Código | `apps/desktop/renderer/components/character/` (`CharacterEngine`, `CharacterCanvas`, `CharacterMiniBadge`, `CharacterTraits`) |

---

## 1. Declaración de Identidad y Rectificación de Arte

Ego y todos sus Sub-Egos son entidades cognitivas vivas, carismáticas y dinámicas, renderizadas analíticamente en **Canvas 2D a 60 FPS**, combinando calidez orgánica con rigor geométrico.

### Identidad Canónica de Ego y los Sub-Egos
1. **Entidad Procedural Viva y Geometría Matemática:**
   - Silueta **`delta-core` (Triángulo Delta Core)**: Silueta equilátera de esquinas redondeadas con simetría armónica $C_3$:
     $$\theta_{rot} = a + \frac{\pi}{2}, \quad k = \cos(3\theta_{rot}), \quad r(a) = 0.92 + 0.38k - 0.07(k^2 - 0.5)$$
   - Silueta **`squircle-core` / `coucou-mochi` (temporal hasta `COUC-23`)**: Superelipse de Lamé ($EXP = 2.7$):
     $$r(y) = (1 - |y|^{2.7})^{1/2.7}$$
   - Cabeceo en pseudo-3D (`yaw` y `pitch`) con proyección polar esférica de superficie y centrado compensatorio en Y para geometrías triangulares.
   - Dinámica física de resortes elásticos (Euler steps, oscilación armónica, rebote, *squash & stretch*).
2. **Rostro Hiper-Expresivo:**
   - 13 estados de ojos procedimentales: `pill`, `wide`, `dot`, `line`, `flat`, `happy`, `closed`, `spiral`, `heart`, `star`, `tired`, `wink`, `cup`.
   - Boca reactiva a eventos cognitivos y apertura de voz/audio.
   - Rubor expresivo en mejillas ante éxitos y gratitud.
3. **Manos Gesticulantes y Cinemática:**
   - Manitas redondeadas procedimentales con gestos de saludo (`greet`), concentración, tecleo técnico y aprobación humana (HITL).
4. **Sistema de Rasgos Anatómicos y Energéticos (`TraitConfig`):**
   - Personalización modular mediante rasgos abstractos y campos de fuerza no humanos:
     - `halo`, `energy-cores`, `antennae`, `floating-shards`, `aura-field`, `quantum-crown`, `orbital-rings`, `geometric-crest`.
   - **Prohibición Estricta:** Cero vestimenta humana (`BANNED_HUMAN_CLOTHING` prohíbe trajes, corbatas, gafas humanas, etc.).
5. **Efectos de Partículas y Badges:**
   - Partículas dinámicas integradas: corazones, estrellas, chispas (`spark`), gotas de sudor (esfuerzo/error), 'Zzz' (modo reposo).
   - Badges de estado e interactividad en tiempo real sincronizados con la FSM de atención.
6. **Síntesis de Audio Web Audio API:**
   - Retroalimentación auditiva en tiempo real mediante síntesis senoidal y triangular nativa. Cero dependencias de archivos de voz o sonidos propietarios de terceros.

---

## 2. La Matriz de 6 Capas de Renderizado

Tanto el avatar grande de Dynamic Canvas como los mini-avatares HiDPI de chat (`minibots.ts`) y la Dynamic Island siguen una canalización de renderizado estricta en 6 etapas:

```
┌────────────────────────────────────────────────────────┐
│  CAPA 0: Pre-render / Rasgos Posteriores (Back Traits) │
│  - Halos difusos, anillos orbitales traseros, auras    │
├────────────────────────────────────────────────────────┤
│  CAPA 1: Sombra y Volumen del Cuerpo (Geometría Base)  │
│  - Silueta analítica (delta-core o squircle-core)      │
│  - Gradiente lineal direccional + oclusión radial      │
│  - Brillo especular superior                          │
├────────────────────────────────────────────────────────┤
│  CAPA 2: Rostro y Expresión (Ojos y Boca)             │
│  - Proyección esférica de mirada (yaw, pitch)          │
│  - 13 morfologías de ojos + apertura de boca reactiva │
├────────────────────────────────────────────────────────┤
│  CAPA 3: Manos y Extremidades Gesticulantes           │
│  - Manitas dinámicas adaptadas al estado de acción     │
├────────────────────────────────────────────────────────┤
│  CAPA 4: Rasgos Frontales (Front Traits)              │
│  - Crestas geométricas, núcleos de energía, antenas   │
├────────────────────────────────────────────────────────┤
│  CAPA 5: Partículas, Telemetría y Badges              │
│  - Emoticonos flotantes, chispas de éxito, sudor/error│
└────────────────────────────────────────────────────────┘
```

---

## 3. Presets Fundacionales de Sub-Egos

| Sub-Ego | Silueta Base | Color Primario | Color Sombra | Rasgo / Trait Sugerido | Ojos Habituales | Comportamiento |
|---|---|---|---|---|---|---|
| **Ego Nucleus** | `delta-core` / `coucou-mochi` | `#EDEDEF` | `#C4C5CA` | `aura-field` | `pill` | Sereno, respiración balanceada |
| **Engineering (Dev)** | `delta-core` | `#3B82F6` | `#1D4ED8` | `energy-cores` o `antennae` | `wide` / `line` | Rápido, inclinado hacia adelante |
| **Finance / Legal** | `delta-core` | `#10B981` | `#047857` | `geometric-crest` | `dot` / `flat` | Sólido, mirada atenta y fija |
| **Design / Creative** | `delta-core` | `#F59E0B` | `#D97706` | `floating-shards` | `happy` / `star` | Elástico, rebotes juguetones |
| **Product / Strategy**| `delta-core` | `#8B5CF6` | `#6D28D9` | `quantum-crown` o `orbital-rings` | `pill` / `wink` | Erguido, gestos deliberados |
| **Support / Care** | `delta-core` | `#EC4899` | `#BE185D` | `halo` | `happy` / `heart` | Caluroso, parpadeo frecuente |

---

## 4. Rendimiento y Cero Fatiga

1. **HiDPI Nativo:** Renderizado escalado por `window.devicePixelRatio` para nitidez absoluta en pantallas Retina y 4K.
2. **Ciclo de Vida Limpio:** Los mini-avatares no utilizados se desregistran automáticamente (`pruneMiniBots`).
3. **Consumo CPU Optimizado:** Física Euler integrada en sub-steps con `requestAnimationFrame` que se amortigua y se detiene completamente cuando el bot se asienta en reposo.
