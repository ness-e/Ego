# Visual Identity, Color Science & Brand Palette Systems

Este documento formaliza la ciencia del color, espacios cromáticos perceptualmente uniformes y sistemas de paletas paramétricas para personajes de marca en código.

---

## 1. Espacios de Color Perceptualmente Uniformes (OKLCH / OKLAB)

Tradicionalmente, la interpolación de color en WebGL y CSS se realizaba en el espacio $sRGB$ no lineal, provocando bandas oscuras en las transiciones intermedias y distorsiones perceptuales de brillo.

En Character Forge, **las paletas paramétricas y transiciones de gradiente deben calcularse en OKLCH** (Luminancia perceptual $L$, Croma $C$, Matiz o Hue $H$):

```
          Espacio sRGB (No Lineal)                      Espacio OKLCH (Perceptual)
    Azul (#0000ff) ────[ Transición ]──── Amarillo       Luminancia constante predecible
           ↓                                                    ↓
    Gris sucio y opaco en el centro               Transición suave sin caída de energía
```

### 1.1. Ventajas de OKLCH para Personajes:
1. **Conservación de Luminancia ($L$)**: Al alterar el tono corporativo ($H$), la luminosidad percibida permanece idéntica, garantizando que el personaje mantenga el mismo contraste visual en interfaces.
2. **Control de Croma ($C$)**: Permite modular la saturación para estados de advertencia o ahorro de energía sin descalibrar el matiz.

### 1.2. Conversión Bidireccional de Color en TypeScript:
```typescript
/**
 * Convierte valores OKLCH a RGB lineal normalizado [0, 1] para shaders WebGL
 */
export function oklchToLinearRgb(L: number, C: number, H: number): [number, number, number] {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  // Transformación a conos LMS de OKLab
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // Matriz LMS a RGB Lineal
  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return [
    Math.max(0, Math.min(1, r)),
    Math.max(0, Math.min(1, g)),
    Math.max(0, Math.min(1, bl))
  ];
}
```

---

## 2. Regla de Distribución Cromática 60-30-10 para Personajes

Para evitar saturación visual o falta de jerarquía, la superficie del personaje debe dividirse siguiendo la proporción armónica:

```
┌─────────────────────────────────────────────────────────────┐
│ 60%  Color Dominante (Chasis / Torso / Carcasa principal)   │
├──────────────────────────────────────────────┬──────────────┤
│ 30%  Color Secundario (Articulaciones /      │ 10% Acento   │
│      Visor / Placas mecánicas)               │     Emisivo  │
└──────────────────────────────────────────────┴──────────────┘
```

1. **Color Dominante (60%)**: Define la identidad primaria de marca. No debe competir con el acento.
2. **Color Secundario (30%)**: Tono neutro o complementario (gris pizarra, azul grafito, blanco marfil) que aporta escala y estructura física.
3. **Color de Acento Emisivo (10%)**: Focaliza la mirada en los puntos de interacción crítica: **ojos, baliza de antena, corazón o display interactivo**. Debe ser de alta luminancia ($L \ge 0.85$, $C \ge 0.15$).

---

## 3. Matriz de Atributos Visuales y Accesibilidad de Contraste

### 3.1. Prueba de Contraste WCAG 2.2 contra Fondos Diversos
El personaje debe mantener un ratio de contraste de silueta mínimo de **$3:1$ para elementos gráficos grandes** y **$4.5:1$ para ojos/expresiones**:

$$\text{Ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}$$

| Tipo de Fondo de Interfaz | Hexadecimal Fondo | Ajuste Automático del Personaje |
|---|---|---|
| **Dark Theme** | `#090d16` a `#0f172a` | Chasis con reflectividad moderada, Rim Light brillante para recortar silueta. |
| **Light Theme** | `#ffffff` a `#f8fafc` | Acentuar contorno o sombra de contacto propia; cambiar emisión ocular a contraste inverso si es necesario. |
| **Fondos de Marca** | Primario de la empresa | Activar variante monocromática con tinte de luminosidad invertida. |

### 3.2. Adaptabilidad para Deficiencias de Visión Cromática (Daltonismo)
Los estados del personaje no deben depender exclusivamente del matiz cromático (ej. verde para éxito, rojo para error).
- **Éxito**: Color cian/verde **+** Ojos arqueados en felicidad **+** Salto dinámico hacia arriba.
- **Error**: Color rojo/ámbar **+** Ojos entrecerrados en ángulo **+** Sacudida lateral y cabeza baja.

---

## 4. Esquema Paramétrico de Temas y Skins

Un sistema modular expone tokens configurables:

```typescript
export interface BrandCharacterThemeTokens {
  id: string;
  name: string;
  primaryLinearRgb: [number, number, number];
  secondaryLinearRgb: [number, number, number];
  emissiveLinearRgb: [number, number, number];
  roughness: number;
  clearcoat: number;
  metalness: number;
}

export const PRESET_THEMES: Record<string, BrandCharacterThemeTokens> = {
  vanta_cyan: {
    id: 'vanta_cyan',
    name: 'Teal High-Tech',
    primaryLinearRgb: [0.0, 0.55, 0.65],
    secondaryLinearRgb: [0.08, 0.12, 0.2],
    emissiveLinearRgb: [0.0, 0.95, 1.0],
    roughness: 0.18,
    clearcoat: 0.85,
    metalness: 0.05,
  },
  obsidian_gold: {
    id: 'obsidian_gold',
    name: 'Obsidian Luxury',
    primaryLinearRgb: [0.04, 0.04, 0.05],
    secondaryLinearRgb: [0.12, 0.12, 0.15],
    emissiveLinearRgb: [1.0, 0.75, 0.1],
    roughness: 0.25,
    clearcoat: 0.95,
    metalness: 0.45,
  },
  ceramic_coral: {
    id: 'ceramic_coral',
    name: 'Matte Coral',
    primaryLinearRgb: [0.95, 0.35, 0.4],
    secondaryLinearRgb: [0.95, 0.95, 0.96],
    emissiveLinearRgb: [1.0, 0.9, 0.3],
    roughness: 0.75,
    clearcoat: 0.0,
    metalness: 0.0,
  },
};
```
Este diseño desacopla completamente el arte de los componentes de renderizado.
