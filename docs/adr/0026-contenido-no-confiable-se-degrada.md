# ADR 0026: El contenido no confiable se degrada, no se bloquea — el detector detecta, la política juzga

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-21 |
| Estado | Aceptado (implementado y verificado en `packages/security/**` y `packages/runtime/**`) |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |
| Decisor | Owner ("Reconstruir el detector", 2026-10-21) · recomendación técnica A2-bis |
| Sustituye a | Nada - cierra el hueco de capacidad que abrió la retirada de `UntrustedContentSanitizer` |
| Relacionado | [ADR-0019](0019-canal-dual-taint-tracking.md) · [ADR-0025](0025-dos-planos-de-atribucion.md) · `EGO-FIND-60` |

## Contexto

[ADR-0019](0019-canal-dual-taint-tracking.md) fijó el **canal**: el contenido no confiable viaja siempre por el canal sin
privilegios y el taint tracking marca su origen. El `TrustBoundary` decide **en qué canal** viaja el contenido, pero
**no detectaba** que el contenido fuera un vector.

Al retirar `UntrustedContentSanitizer` (código muerto, nadie lo llamaba) quedó un **hueco de capacidad**: ningún módulo de
Ego detectaba una suplantación de rol, un cambio de instrucciones ni una exfiltración del system prompt en el contenido
externo. El taint tracking cubre el **canal**; nadie cubría el **vector**.

El owner decidió (2026-10-21) **reconstruir el detector**, y no comprar un clasificador LLM.

## Decisión

1. **El detector detecta; la política juzga.** `PromptInjectionDetector` (`@ego/security`) es **determinista**, sin LLM y sin
   red: devuelve `{verdict, signals, normalized, truncated}`. **No ejecuta castigos**: no bloquea, no marca, no reescribe.
   La acción la decide el runtime (`TrustBoundary.evaluateTrustPolicy`).
2. **Cinco familias de vector**: `instruction_override` (cambio de instrucciones), `prompt_exfiltration` (robo del system
   prompt), `role_impersonation` (suplantación de rol), `embedded_instructions` (directivas dentro de markdown o de un
   enlace que habla al modelo) y `secret_lure` (lo que_busca que el modelo revele secretos).
3. **Normalización previa**: NFKC + colapso de espacios + eliminación de ceros anchos + homoglifos + minúsculas + formas
   derivadas (sin markdown / compacta). Sin ella, los vectores triviales se escapan.
4. **Evidencia acotada**: cada señal lleva un recorte corto, nunca el texto entero — el registro de seguridad no debe
   convertirse en una copia del contenido.
5. **El detector no se aplica al canal privilegiado.** El contenido de confianza (system prompt, skills registradas,
   contenido firmado) **no se mira**: vive en el canal de control, que el detector no toca.
6. **Política configurable, por defecto conservadora y no bloqueante.** `suspicious` ⇒ el contenido va **siempre** por el
   canal sin privilegios, su fuente queda marcada y se registra. `block` es **opt-in**. El detector **no** detiene el turno
   por defecto: sería un cambio de producto, no una mejora de seguridad silenciosa.
7. **Fail-open explícito.** Si el detector **lanza**, el `TrustBoundary` **no tumba el turno**: degrada a la política
   conservadora y lo registra. Una capacidad de seguridad que tumba el producto cuando falla es un vector de denegación.
8. **Frontera estructural (DIP)**: `packages/runtime` **no** importa `@ego/security`; el detector se inyecta. El runtime no
   depende del detector: el detector puede faltar sin romper el runtime.

## Consecuencias

### A favor

- El hueco de capacidad está **cerrado** con una capacidad **verificable**: 4 familias de señal, entrada normalizada y
  salida estructurada.
- La **tasa de falsos positivos está medida**: **0,060 %** sobre el corpus legítimo del repo (1 de 1 664 ficheros),
  bruta 0,240 % (4 de 1 667, incluidos los fixtures de ataque). Se bajó desde 1,908 % ajustando **6 reglas contra la
  medición**, no subiendo umbrales a ciegas. El umbral declarado es ≤ 2 %.
- La política es **del runtime**, no del detector: cambiarla no toca el detector.
- El detector es **barato** (sin LLM ni red) → entra en el presupuesto de latencia de cada pieza no confiable.

### En contra

- Es un **detector de patrones**: un vector redactado fuera de las 5 familias pasa; entre comillas puede colarse.
  **Documentado**, no escondido.
- Dos superficies siguen **sin** detección: el **recall de memoria** (la mayor superficie) y la entrada de **skills**.
  CABLEARLAS es trabajo de otras zonas, no de este ADR.
- El mecanismo de marca (`markUntrusted()`) estaba **inerte**: no tenía ni un caller. Ahora la ingesta en el
  `ToolExecutionLoop` lo invoca, pero el resto de superficies depende de que se cableen.

## Alternativas descartadas

| Alternativa | Veredicto | Motivo |
| --- | --- | --- |
| Clasificador LLM barato | Descartada | Añade coste y latencia a cada turno, y depende de la disponibilidad del proveedor. El owner eligió el detector determinista. |
| Fiar solo en el taint + el canal dual | Descartada | No hay **detección**: un vector que se cuela en el canal equivocado pasa desapercibido. |
| Bloquear el turno cuando el veredicto es `suspicious` | Descartada por defecto | Es un cambio de producto, no una mejora silenciosa. Queda como `block` **opt-in**. |
| El detector dentro de `packages/runtime` | Descartada | Invierte la dependencia: el runtime no debe depender del detector (DIP). Se inyecta. |
| Normalizar solo por `toLowerCase()` | Descartada | Los ceros anchos y los homoglifos esquivan el patrón. La normalización es lo que hace que el detector muerda. |
