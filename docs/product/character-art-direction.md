# Dirección Artística Canónica: Sistema Procedural de Personajes Coucou Mochi

| Campo | Valor |
| --- | --- |
| ID Documento | `DIR-ART-CHAR-CANONICAL` |
| Estado | **CANÓNICO Y VIGENTE** (Restauración completa post-auditoría Oct 2026) |
| Herencia Técnica | Motor Canvas 2D probado en producción de `coucou` (`BotEngine`, `mochi-outfits.js`, `minibots.ts`) |
| Componentes en Código | `apps/desktop/renderer/components/character/` (`CharacterEngine`, `CharacterWardrobe`, `CharacterCanvas`, `CharacterMiniBadge`) |

---

## 1. Declaración de Identidad y Rectificación de Arte

Tras la auditoría forense del sistema visual de Ego, queda formalmente revocado y descartado cualquier concepto de abstracciones inertes o monolitos geométricos fríos.

### Identidad Canónica de Ego y los Sub-Egos
1. **Criatura Procedural Carismática:** Ego y todos sus Sub-Egos son entidades de escritorio vivas, carismáticas y entrañables, basadas en la probada arquitectura matemática de **Coucou Mochi**:
   - Silueta **squircle** generada analíticamente mediante la superelipse de Lamé ($EXP = 2.7$):
     $$r(y) = (1 - |y|^{2.7})^{1/2.7}$$
   - Cabeceo en pseudo-3D (`yaw` y `pitch`) con proyección polar esférica de superficie.
   - Dinámica física de resortes elásticos (Euler steps, oscilación armónica, rebote, *squash & stretch*).
2. **Rostro Hiper-Expresivo:**
   - 13 estados de ojos canónicos de Coucou: `pill`, `wide`, `dot`, `line`, `flat`, `happy`, `closed`, `spiral`, `heart`, `star`, `tired`, `wink`, `cup`.
   - Boca reactiva a eventos cognitivos y apertura de voz/audio.
   - Rubor expresivo en mejillas ante éxitos y gratitud.
3. **Manos Gesticulantes y Cinemática:**
   - Manitas redondeadas procedimentales con gestos de saludo, concentración, tecleo técnico y aprobación humana (HITL).
4. **Sistema Completo de Guardarropa y Personalización (`Wardrobe`):**
   - Soporte total para atuendos y accesorios modulares renderizados en capas ordenadas (`back` y `front`):
     - **Gorros y tocados:** `beanie` (gorro de lana con nervaduras y pompón elástico), `santaHat` (gorro festivo con caída gravitatoria), `partyHat` (cono con espiral), `crown` (corona real con gemas), `witchHat`, `pumpkin`.
     - **Gafas:** `sunglasses` (estilo Wayfarer con reflejos lineales), `roundGlasses` (montura metálica redonda).
     - **Accesorios corporales:** `scarf` (bufanda envolvente con extremos oscilantes dinámicos), `bow` (pajarita/lazo), capas y batas de laboratorio.
5. **Efectos de Partículas y Badges:**
   - Partículas dinámicas integradas: corazones, estrellas, gotas de sudor (esfuerzo/error), 'Zzz' (modo reposo).
   - Badges de estado e interactividad en tiempo real.

---

## 2. La Matriz de 6 Capas de Renderizado

Tanto el avatar grande de Dynamic Canvas como los mini-avatares HiDPI de chat (`minibots.ts`) siguen una canalización de renderizado estricta en 6 etapas:

```
┌────────────────────────────────────────────────────────┐
│  CAPA 0: Pre-render / Atuendos Posteriores (Back)     │
│  - Alas, capas, colas o partes traseras de sombreros  │
├────────────────────────────────────────────────────────┤
│  CAPA 1: Sombra y Volumen del Cuerpo (Squircle EXP=2.7)│
│  - Gradiente lineal direccional + oclusión radial      │
│  - Brillo especular superior                          │
├────────────────────────────────────────────────────────┤
│  CAPA 2: Rostro y Expresión (Ojos y Boca)             │
│  - Proyección esférica de mirada (yaw, pitch)          │
│  - 13 morfologías de ojos + apertura de boca          │
├────────────────────────────────────────────────────────┤
│  CAPA 3: Manos y Extremidades Gesticulantes           │
│  - Manos dinámicas adaptadas al estado de acción      │
├────────────────────────────────────────────────────────┤
│  CAPA 4: Guardarropa Frontal (Front Outfits)          │
│  - Gorros, gafas, bufandas, coronas, lazos recortados │
├────────────────────────────────────────────────────────┤
│  CAPA 5: Partículas, Telemetría y Badges              │
│  - Emoticonos flotantes, chispas de éxito, sudor/error│
└────────────────────────────────────────────────────────┘
```

---

## 3. Presets Fundacionales de Sub-Egos

| Sub-Ego | Color Primario | Color Sombra | Outfit Predeterminado | Ojos Habituales | Comportamiento |
|---|---|---|---|---|---|
| **Ego Nucleus** | `#EDEDEF` | `#C4C5CA` | Neutro / Sin atuendo | `pill` | Sereno, respiración balanceada |
| **Engineering (Dev)** | `#3B82F6` | `#1D4ED8` | `sunglasses` o `beanie` | `wide` / `line` | Rápido, inclinado hacia adelante |
| **Finance / Legal** | `#10B981` | `#047857` | `roundGlasses` | `dot` / `flat` | Sólido, mirada atenta y fija |
| **Design / Creative** | `#F59E0B` | `#D97706` | `partyHat` o `bow` | `happy` / `star` | Elástico, rebotes juguetones |
| **Product / Strategy**| `#8B5CF6` | `#6D28D9` | `crown` | `pill` / `wink` | Erguido, gestos deliberados |
| **Support / Care** | `#EC4899` | `#BE185D` | `scarf` | `happy` / `heart` | Caluroso, parpadeo frecuente |

---

## 4. Rendimiento y Cero Fatiga

1. **HiDPI Nativo:** Renderizado escalado por `window.devicePixelRatio` para nitidez absoluta en pantallas Retina y 4K.
2. **Ciclo de Vida Limpio:** Los mini-avatares no utilizados se desregistran automáticamente (`pruneMiniBots`).
3. **Consumo CPU Optimizado:** Física Euler integrada en sub-steps con `requestAnimationFrame` que se amortigua y se detiene completamente cuando el bot se asienta en reposo.
