# CharacterForge Production Suite

Suite de producción ejecutable y laboratorio de calidad técnica para diseño de personajes, materiales, dirección dramática y calibración física sin regresiones.

## Componentes Arquitectónicos

1. **`recipes/VisualRecipeRegistry.ts`**:
   - Catálogo de recetas visuales tipadas por renderizador (Canvas 2D, Three.js, SVG, WebGL).
   - Generación determinista de grano/ruido mediante PRNG basado en semillas fijas (`splitmix32`).
   - Soporte para materiales canónicos: Cerámica Kintsugi, Fieltro Peach-Fuzz, Vinilo Mate, Gel Translúcido y Grabado a Tinta.

2. **`acting/ActingDirector.ts`**:
   - Motor de dirección de personajes en 10 fases cinemáticas secuenciales:
     1. Detección de estímulo
     2. Orientación cognitiva
     3. Anticipación física (squash/stretch inverso)
     4. Lanzamiento de acción primaria
     5. Contacto clímax
     6. Continuación / Follow-through
     7. Rebote y oscilación
     8. Asimilación cognitiva
     9. Retorno y asentamiento
     10. Almacenamiento en memoria contextual
   - Precondiciones de energía, cola de intenciones con prioridades e interrupciones de emergencia.

3. **`personality/PersonalityManager.ts`**:
   - Vector de personalidad cuantitativo en 8 dimensiones (`curiosity`, `shyness`, `energy`, `diligence`, `whimsy`, `skepticism`, `empathy`, `stoicism`).
   - Proyección directa a parámetros cinemáticos físicos ($\omega_0$, $\zeta$, anticipación, pausas).

4. **`quality/QualityLabRunner.ts`**:
   - Medición cuantitativa determinista de métricas de movimiento:
     - Overshoot porcentual (rango vivo de confort: 8% a 22%).
     - Settling time (límite de rendimiento: $< 0.50\text{ s}$).
     - Jitter RMS y oscilaciones espurias.
     - Error Medio Absoluto (MAE).

5. **`tests/quality-lab.test.ts`**:
   - Suite de pruebas automatizada con simulación del bucle de 11 pasos de detección, inyección y reparación de defectos:
     - Inyección deliberada del defecto `DEF-ANI-01` ($\zeta = 0.22$, overshoot $> 40\%$).
     - Detección cuantitativa y reporte de violación en el Quality Lab.
     - Corrección automática del amortiguamiento a $\zeta = 0.74$.
     - Validación de resolución y no-regresión.

## Ejecución

Para ejecutar la suite de producción:

```bash
npx tsx .agents/skills/character-forge/examples/production-suite/run-suite.ts
```
