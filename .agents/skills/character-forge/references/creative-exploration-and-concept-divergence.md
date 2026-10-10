# Creative Exploration, Concept Divergence & Art Direction Engine

Este documento formaliza el motor de pensamiento divergente y exploración conceptual previa a la codificación, erradicando la convergencia hacia clichés predecibles mediante hipótesis visuales estructuralmente diferenciadas.

---

## 1. El Principio Fundamental: Explorar Antes de Construir

Un ingeniero o artista de personajes **nunca salta directamente a escribir el primer modelo que le viene a la mente**. Cuando un encargo permite libertad creativa, la solución inmediata suele ser el promedio estadístico de lo más visto en internet: una esfera o cápsula con visor negro, ojos píldora cian, acabado de vinilo brillante y flotación senoidal.

**La Regla de Oro de la Divergencia**:
> *Cambiar el color de una mascota, ponerle gafas y añadir partículas no crea tres conceptos; crea el mismo concepto con tres disfraces.*

Para que dos propuestas sean genuinamente divergentes, deben diferir en sus **decisiones estructurales primarias**:
1. **Concepto central y narrativa**: ¿Qué metáfora física encarna? (¿Una criatura de arcilla moldeada a mano? ¿Un insecto geométrico de origami? ¿Un talismán de piedra rúnica flotante? ¿Un diagrama técnico viviente?).
2. **Silueta y topología**: ¿Es una masa única bulbosa, una armadura de placas angulares facetadas, una estructura laminar hueca o un enjambre de volúmenes conectados por magnetismo?
3. **Lenguaje de formas dominante**: ¿Es predominantemente triangular/agudo, cuadrado/monolítico, circular/hidráulico o asimétrico/topológico?
4. **Materialidad y acabado**: ¿Textura de fieltro tejido, cerámica agrietada kintsugi, papel kraft doblado, vidrio ahumado o grabado en linóleo?
5. **Dinámica cinética**: ¿Movimiento fluido continuo, rebote de resorte elástico, articulación mecánica paso a paso o *stop-motion* escalonado?

---

## 2. Los Ejes Polares de Exploración Conceptual

Antes de diseñar, se seleccionan entre 3 y 5 ejes de tensión bipolar según el objetivo del proyecto:

```
                    [ EJES POLARES DE EXPLORACIÓN CONCEPTUAL ]
    Eje 1: Orgánico (Biológico / Vivo)   ◄─────────────────►   Mecánico (Industrial / Ensamblado)
    Eje 2: Geometría Suave (Curvilínea)   ◄─────────────────►   Facetado Angular (Cristalino)
    Eje 3: Textura Táctil Artesanal       ◄─────────────────►   Precisión Matemática Abstracta
    Eje 4: Estructura Monolítica Sólida   ◄─────────────────►   Sistema Modular Hueco / Segmentado
    Eje 5: Comportamiento Zen / Sereno    ◄─────────────────►   Conducta Excéntrica / Dinámica
```

---

## 3. El Procedimiento de Ideación en 5 Pasos

### Paso 1: Identificar la Intención y DNA de Marca
- ¿Qué problema de producto o emoción resuelve? (¿Generar calma en un checkout? ¿Comunicar velocidad en un pipeline? ¿Divertir en una pantalla 404?).
- ¿Qué restricciones son duras? (ej. formato SVG para favicon $<15\text{ KB}$ vs Three.js WebGL inmersivo).
- ¿Qué características son negociables para la exploración?

### Paso 2: Mapear los Ejes Polares
Cruzar dos ejes relevantes en una **Matriz Cuadrante 2×2** para forzar ideas en los 4 extremos:
```
                     [ Volumétrico 3D / Táctil ]
                                  │
          Cuadrante B:            │          Cuadrante A:
    "El Autómata de Arcilla"      │    "El Fetiche de Cerámica & Vidrio"
    (Orgánico + Volumétrico)      │    (Mecánico + Volumétrico)
  ────────────────────────────────┼──────────────────────────────── [ Mecánico ]
  [ Orgánico ]                    │
          Cuadrante C:            │          Cuadrante D:
    "La Bestia de Tinta y Linóleo"│    "El Diagrama Vectorial Vivo"
    (Orgánico + Plano 2D)         │    (Mecánico + Plano 2D)
                                  │
                       [ Gráfico 2D / Plano ]
```

### Paso 3: Formulación de 3 a 5 Conceptos Divergentes
Para cada concepto, se redacta una ficha de arquitectura conceptual sin ambigüedades:

```typescript
export interface DivergentConceptHypothesis {
  conceptId: string;
  codename: string;
  centralMetaphor: string;      // ej: "Escultura de madera tallada con juntas de cuerda"
  silhouetteDescription: string;// Forma geométrica primaria y balance de masas
  dominantShapeLanguage: 'circle' | 'square' | 'triangle' | 'faceted_polygon' | 'asymmetric_blob';
  materialFinish: string;       // ej: "Madera de haya mate con grano procedimental + cuerda de lino"
  lightingStyle: string;        // ej: "Luz cálida de taller artesanal a contraluz suave"
  motionSignature: string;      // ej: "Articulaciones mecánicas secas con inercia de madera pesada"
  distinctiveFeature: string;   // El rasgo MEMORABLE e inimitable del personaje
  tradeoffsAndRisks: string;    // Complejidad en código, draw calls o legibilidad a 24px
  brandFitJustification: string;// Por qué encaja con el objetivo sin ser genérico
}
```

### Paso 4: Definición de la Característica Distintiva (The Hook)
Cada concepto debe tener **un rasgo distintivo inolvidable** que un observador pueda describir en una sola frase:
- *No distintivo*: "Un robot azul amigable con visor".
- *Distintivo*: "Un monolito prismático de pizarra oscura que levita fracturado en 3 bloques sostenidos por un núcleo de luz ámbar".
- *Distintivo*: "Una criatura de papel origami plegado que se desdobla y pliega sobre sí misma para cambiar de emoción".

### Paso 5: Matriz Comparativa y Selección Justificada
Se evalúan las alternativas frente a la rúbrica de idoneidad, originalidad relativa y rendimiento técnico antes de proceder al modelado.
