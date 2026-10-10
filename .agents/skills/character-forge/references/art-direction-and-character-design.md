# Art Direction, Character Design & Silhouette Engineering

Este documento establece los principios de dirección de arte, anatomía estilizada y diseño formal para traducir la identidad y tono de una marca en un personaje visual coherente, legible y listo para producción por código.

---

## 1. La Prueba de la Silueta y Reconocimiento Multi-Escala

Un personaje interactivo debe funcionar simultáneamente como favicon de 24×24 píxeles, avatar de 64×64 en un header, ilustración central de 250×250 en un empty state y modelo 3D focal en una landing page.

```
Escala Icono (24x24 px)          Escala Interfaz (120x120 px)        Escala Escena (512x512 px)
     ┌─────┐                           ┌───────────┐                       ┌───────────────┐
     │ o.o │                           │  \  o.o / │                       │   \  (• ◡ •) /│
     │ └─┘ │                           │   ┌─────┐ │                       │    ┌─────────┐│
     └─────┘                           │   │ Tor │ │                       │    │  Torso  ││
(Lectura de contorno)                  └───────────┘                       └───────────────┘
                                   (Detalle secundario)                  (Microdetalles y PBR)
```

### 1.1. Principios de Legibilidad de Contorno
1. **Espacio Negativo Activo**: La distancia mínima entre las extremidades y el tronco debe ser de al menos el 15% del ancho del torso. Si las extremidades colapsan contra el torso, la silueta se lee como una masa amorfa.
2. **Eliminación de Tangencias**: Dos líneas de contorno nunca deben coincidir tangencialmente (ej. el borde inferior de la oreja alineado exactamente con la coronilla). Debe existir solapamiento (*overlap*) claro o separación neta.
3. **Puntos Focales por Frecuencia Visual**:
   - **Baja frecuencia (silueta externa)**: Cabeza, torso y postura general. Determina el arquetipo.
   - **Media frecuencia (volúmenes internos)**: Visor, extremidades, emblema de marca y orejas/antenas.
   - **Alta frecuencia (detalles)**: Biseles, tornillos, pupilas, costuras, reflejos emisivos.

---

## 2. Lenguaje de Formas y Psicología Visual (Shape Language)

El lenguaje de formas no debe aplicarse mediante clichés simplistas ("círculo = siempre bueno, triángulo = siempre malo"). En diseño de sistemas, las formas comunican **dinámica física y rol de producto**:

| Geometría Base | Dinámica Física | Rol de Producto / Arquetipo | Reglas de Construcción |
|---|---|---|---|
| **Círculo / Esfera** | Rodamiento, suavidad, presión hidrostática uniforme, cercanía | Asistentes de soporte, onboarding, productos de salud y educación | Esquinas con radio $> 40\%$, proporciones bulbosas, volumen expansivo. |
| **Cuadrado / Cubo** | Anclaje gravitatorio, rigidez estructural, baja inercia | Infraestructura, bases de datos, seguridad, fintech B2B | Ángulos rectos suavizados con bisel fino (10-15%), base ancha, simetría en masa. |
| **Triángulo / Cono** | Vector direccional, penetración aerodinámica, aceleración | Herramientas de despliegue rápido, analítica en tiempo real, testing | Vértices dominantes orientados hacia arriba o adelante, extremidades agudas. |
| **Superelipse (Squircle)** | Tensión de curvatura continua (G2), equilibrio orgánico-mecánico | IA moderna, interfaces de usuario prémium, software cognitivo | Curvatura basada en exponente $n \approx 4$ o 5 de la fórmula de Lamé. |

---

## 3. Proporciones y Distribución de Masas (Anatomía Estilizada)

La jerarquía anatómica estilizada altera intencionadamente las proporciones humanas reales (1:7.5 cabezas) para priorizar las áreas portadoras de significado:

```
Proporción Micro-Chibi (1:1.3)        Proporción Mascota Tech (1:2.2)       Proporción Agente Heroico (1:3.5)
       ┌─────────┐                           ┌─────────┐                           ┌───────┐
       │ Cabeza  │ 60%                       │ Cabeza  │ 45%                       │Cabeza │ 28%
       └─────────┘                           └─────────┘                           └───────┘
       ┌─────────┐                           ┌─────────┐                           ┌───────┐
       │ Cuerpo  │ 40%                       │  Torso  │ 35%                       │ Torso │ 42%
       └─────────┘                           ├─────────┤                           ├───────┤
                                             │ Piernas │ 20%                       │Piernas│ 30%
                                             └─────────┘                           └───────┘
```

### 3.1. Regla de Distribución de Pesos
- **Centro de Gravedad Bajo**: Para personajes amigables y estables, el centro de masa se sitúa en el tercio inferior del cuerpo (base acampanada).
- **Flotación Magnética / Suspensión**: Personajes sin piernas físicas que levitan deben tener una base cónica o elipsoidal con un radio menor que los hombros, compensando la inestabilidad gravitatoria con un emisor de energía o sombra de contacto dinámica.

---

## 4. Diseño del Rostro y Rasgos Expresivos

El rostro concentra más del 70% de la empatía del usuario.

### 4.1. Anatomía del Visor y Ojos
- **Altura Ocular**: Para maximizar la empatía y ternura (*neotenia*), los ojos deben situarse en la mitad inferior de la cabeza, nunca en la mitad superior.
- **Espaciado Interpupilar**: La distancia canónica entre ojos en personajes estilizados es de **1.0 a 1.2 veces el ancho de un ojo**. Una separación mayor ($>1.5\times$) comunica inocencia o despiste; una separación menor ($<0.8\times$) comunica concentración intensa, astucia o agresividad.
- **Pupilas y Brillos**: Dos brillos asimétricos (uno primario a $45^\circ$ y otro secundario a $225^\circ$) anclan la orientación espacial de la mirada.

### 4.2. Matriz Paramétrica de Rasgos Faciales en TypeScript
```typescript
export interface CharacterFacialRig {
  // Ojos y Párpados
  eyeOpenness: number;        // 0.0 (cerrado) a 1.0 (abierto completo)
  eyeSquint: number;          // 0.0 a 1.0 (sonrisa de mejilla levantada)
  pupilTarget: [number, number]; // Coordenadas normalizadas [-1.0, 1.0]
  pupilDilation: number;      // 0.7 (alerta/enfoque) a 1.3 (emoción/asombro)

  // Cejas
  browSlant: number;          // -1.0 (tristeza/preocupación) a +1.0 (determinación/enojo)
  browArch: number;           // 0.0 (recta) a 1.0 (arco sorprendido)
  browHeight: number;         // -1.0 a +1.0

  // Boca
  mouthForm: 'line' | 'curve' | 'open_oval' | 'happy_crecent' | 'worried_wave';
  mouthWidth: number;         // Factor multiplicador 0.6 a 1.4
  mouthCurvature: number;     // -1.0 (comisuras abajo) a +1.0 (sonrisa franca)
}
```

---

## 5. Turnaround y Hojas de Producción (Model Sheets)

Para construir el personaje en 3D procedural o SVG sin discrepancias anatómicas, se definen especificaciones ortográficas:

### 5.1. Cuadrícula de Proporciones Canónicas (Turnaround 4 Vistas)
```
  [ VISTA FRONTAL ]         [ VISTA LATERAL ]       [ VISTA 3/4 ]        [ VISTA POSTERIOR ]
        o  (Antena)               o  (Antena)             o                   o
        |                         |                       |                   |
    ┌───────┐                 ┌───────┐               ┌───────┐           ┌───────┐
    │ (• ◡ •)│  Altura Cabeza │  (• | │               │ (• ◡ •)│          │  [===]│ (Panel mochila)
    └───────┘                 └───────┘               └───────┘           └───────┘
    ┌───────┐                 ┌───────┐               ┌───────┐           ┌───────┐
 \--│   ●   │--/ Torso        │   )   │ < Visor       │  ●    │           │   ○   │ (Ventilación)
    └───────┘                 └───────┘               └───────┘           └───────┘
     |     |  Piernas          |                       |   |               |     |
    ( )   ( )                 ( )                     ( ) ( )             ( )   ( )
```

### 5.2. Puntos Críticos de Validación de Turnaround:
1. **Profundidad del Visor en Vista Lateral**: El visor debe tener un retranqueo positivo hacia el interior de la cabeza (entre $0.04$ y $0.08$ unidades) para crear oclusión ambiental natural bajo las cejas y proyectar sombra propia.
2. **Posición del Cuello**: El cuello no se inserta en el centro geométrico del cráneo, sino ligeramente retrasado hacia el tercio posterior para permitir balanceo cervical natural.
3. **Mochila o Rasgo Dorsal**: La vista posterior no debe ser una pared plana; debe contener conectores de energía, rejillas o el logotipo secundario de la marca.

---

## 6. Rúbrica de Evaluación de Calidad de Diseño

Antes de pasar a la fase de modelado por código, el diseño debe someterse a esta rúbrica:

1. **Prueba del Umbral de Contraste**: Si se reduce la imagen a escala de grises y se aplica un umbral binario (*thresholding*), ¿el personaje es reconocible al 100% solo por su silueta?
2. **Prueba de Tangencias**: ¿Hay algún punto donde las manos toquen el borde del torso creando ambigüedad de volumen?
3. **Prueba de Identidad de Marca**: ¿Los colores y proporciones evocan directamente el tono del producto sin depender de un logotipo impreso?
