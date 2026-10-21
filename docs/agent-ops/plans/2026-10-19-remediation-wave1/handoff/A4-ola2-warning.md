# A4 — Ola 2 · `warning`: el motor sabe representarlo, la app ya lo pide

> **Agente:** A4 · **Zona de escritura:** `apps/desktop/**` (EXCEPTO `apps/desktop/renderer/floating/vendor/avatar/**` → A6).
> **Tarea:** cerrar el hueco de producto del estado `warning` (A6 lo añadió al motor; la cadena se cortaba en el renderer).
> **Fecha:** 2026-10-20 · **Commits:** ninguno (árbol sucio a propósito, por instrucción del owner).
> **Entrada:** `handoff/A6-ola2-warning.md` §5 (el diff exacto que faltaba) + `A3`/`A4-ola2-E6.md`.

---

## 1. Resumen

| Punto | Estado |
|---|---|
| **1.** `avatarLiveState` produce `warning` cuando una tool falla y el turno continúa | ✅ aplicado (con **un acotado al turno** que A6 no tenía: §3.2) |
| **2.** `mapCharacterStateToAvatarState` traduce `warning` | ✅ aplicado + **guard de contrato** que enumera TODOS los estados del chat contra los que existen en el motor (§5) |
| **3.** Round-trip `ratelimit → bored → idle` | ✅ **verificado y documentado** (§4): no afecta a este diff; la deuda queda **nombrada y vigilada** por un test, no silenciosa |
| Renderer | **70 ficheros / 489 tests** (antes de esta ola: 65 / 436) → **mi aportación: +4 ficheros, +32 tests** (el resto es trabajo concurrente de otros agentes) |
| `@ego/avatar` (motor) | **intocado** (zona de A6) |

---

## 2. Los tres puntos, en el orden del brief

### Punto 1 — `apps/desktop/renderer/components/ego-chat.tsx`

El diff de A6 (§5.2) aplicaba `lastTool.kind === "tool_error" → "warning"` dentro del bloque `isStreaming`. **Aplicado**, pero con dos diferencias deliberadas respecto a A6:

1. **La resolución se extrajo a una función pura** (`components/character/avatar-live-state.ts`). El `useMemo` vivía en un componente de ~1900 líneas: no era testeable sin montar el chat entero (A6 lo dijo en su §5.4: *"si prefieres no extraer la función pura, el test puede montarse sobre el componente"*; su recomendación era la extracción). Con la función pura, los tests son **deterministas y sin DOM** — y eso permite testear la precedencia entera, que con el componente montado solo se podría observar a través del atributo `state` del `<ego-avatar>`.
2. **El aviso quedó acotado al turno en curso** (§3.2): el diff de A6, tal cual, tenía un defecto que habría pintado de ámbar **todos los turnos siguientes** a un fallo de tool.

### Punto 2 — `apps/desktop/renderer/components/character/CharacterBadge.tsx`

`case "warning": return "warning";` aplicado en el mapa (§5.1 de A6). Sin esta rama, `warning` caía en `default: return "idle"` y se perdía.

### Punto 3 — el round-trip `ratelimit → bored → idle`

**Verificado, no supuesto** (§4).

---

## 3. Las decisiones (razonadas)

### 3.1 La precedencia de las señales

| # | Señal | Estado | Por qué en ese puesto |
|---|---|---|---|
| 1 | `pendingApprovals.length > 0` | `approval_required` | Requiere una decisión **humana ya**: nada del turno compite con un aviso de herramienta. |
| 2 | `activeError` | `error` | Fallo **duro**: el turno se está abortando. Un aviso tolerable no puede tapar un error real. |
| 3 | último evento de tool **del turno en curso** = `tool_error` | **`warning`** | Degradación **tolerable**: la tool falló y el modelo sigue. Dentro de `isStreaming`: si el turno abortó, el aviso desaparece (manda `error` o el reposo). |
| 4 | último evento de tool = `tool_call`/`tool_start` | `searching` / `using_tool` | Trabajo en curso con una herramienta. |
| 5 | streaming | `thinking` / `generating` | Trabajo normal del modelo. |
| 6 | `composerText` no vacío | `listening` | El usuario está escribiendo. |
| 7 | — | `idle` | Reposo. |

**Por qué `warning` (3) va por delante de `generating` (5)** — la pregunta que pedía el brief:

El aviso gana porque **es más raro y más accionable**. El usuario ya ve que el modelo escribe (el texto fluye, el cursor parpadea); **no** ve que una herramienta falló. Y el estado `warning` del motor es un estado **vivo** (pose `warn`, movimiento `sway`, glow 0.4): el avatar sigue comunicando "algo está pasando" en lugar de quedarse congelado. El coste de la precedencia es que, durante el resto del turno, se pierde la señal "está escribiendo" — un coste aceptable, porque esa señal ya la da el texto.

### 3.2 `warning` durante el streaming: **persiste hasta el final del turno** (con un acotado que A6 no tenía)

**La pregunta:** si una tool falla y el asistente sigue emitiendo texto, el array `toolEvents` no cambia → ¿`warning` persiste durante el resto del stream? **¿Es eso lo que quiero?**

**Respuesta: sí, pero con un recorte que el diff de A6 no tenía.**

#### (a) Por qué persiste

- **Consistencia con la regla ya existente.** El estado del avatar es función del **último evento de tool**, no del texto. Eso ya era verdad antes de esta ola: un `tool_call` deja el avatar en `using_tool` mientras el modelo escribe, hasta que llega el siguiente evento de tool. El `warning` se comporta **exactamente igual**. Introducir otra regla ("el texto cancela el aviso") haría que un estado dependiera del texto y los demás no.
- **Un aviso que dura un token es invisible.** La alternativa que el brief plantaba ("warning solo mientras no hay texto nuevo después del error") haría que el ámbar durase ~50 ms (hasta el siguiente delta de texto): parpadearía y el usuario **nunca lo percibiese**. Sería un estado decorativo.
- **El aviso está acotado**: termina cuando llega el siguiente evento de tool (la herramienta se reintenta y funciona → el avatar vuelve al trabajo) o cuando acaba el turno. El intervalo en el que el aviso es accionable es exactamente "lo que queda del turno".

#### (b) El defecto del diff de A6 (y su arreglo)

**Medido en el código:** `toolEvents` **no se limpia al empezar un turno**. Se limpia solo en el slash command `/clear` (`ego-chat.tsx:1370`); `executeTurn` (el inicio de turno) no lo toca, y el array es **acumulativo** (`setToolEvents((prev) => [...prev, …])`).

Consecuencia del diff tal cual: un `tool_error` del turno 1 deja la cola del array en `tool_error` → **en el turno 2 el avatar se pintaría de ámbar durante todo el turno**, aunque no hubiera pasado nada. El aviso se convertiría en ruido permanente (fatiga de alerta) y, peor, en un aviso **falso**.

**Arreglo (implementado):** el estado se acota al turno en curso con la secuencia del evento.

```ts
// ego-chat.tsx — corte de turno
turnStartToolSeqRef.current = toolSeqRef.current;   // en executeTurn
```

```ts
// avatar-live-state.ts — el aviso solo mira los eventos POSTERIORES al corte
function lastToolEventOfCurrentTurn(events, turnStartToolSeq) {
  if (turnStartToolSeq === undefined) return events[events.length - 1];
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].seq > turnStartToolSeq) return events[i];
  }
  return undefined;
}
```

El panel de actividad de tools **sigue mostrando el historial** (no se toca `toolEvents`): el acotado afecta **solo** al estado del avatar.

> **El criterio, en una frase:** *el aviso de tool vale mientras el último evento de tool **de este turno** sea un error; un error de un turno cerrado no avisa de nada.*

#### (c) Si el owner prefiere la otra semántica

El criterio alternativo ("warning solo mientras no hay texto nuevo después del error") se puede implementar **sin tocar la precedencia**: basta con que `resolveAvatarLiveState` reciba, además, la marca del último texto posterior al error, y ceda a `generating` cuando haya texto más nuevo que el error. El coste es **un estado más** (o una comparación de `seq` entre el evento de tool y el del texto) y una regla que hay que explicar. **No lo recomiendo** por el argumento del parpadeo (§3.2a), pero la decisión es del owner y el punto de sustitución está aislado en una función pura con sus tests.

### 3.3 La precedencia NO se rompe con el resto del chat

La extracción a función pura conserva **exactamente** la lógica anterior (verificada test a test): `pendingApprovals` → `activeError` → streaming (tool → thinking/generating) → `composerText` → `idle`. El único cambio de comportamiento es la rama nueva de `tool_error` y el acotado al turno.

---

## 4. Punto 3 — el round-trip `ratelimit → bored → idle`

### 4.1 Qué es

El motor se puede pilotar de dos maneras: **motor SVG** (`STATES`, 15 estados) o **studio** (`EGO_TO_STUDIO_STATE` → `STUDIO_TO_EGO_STATE`, 23 estados). El badge del renderer usa el studio por defecto (`mode="studio"`), así que un estado que no sobreviva al viaje de ida y vuelta **se pierde**.

A6 (§2) avisó de que `ratelimit` pasó a reclamar la imagen `bored` del studio (para que `warning` no se desambiguara) y de que el round-trip `ratelimit → bored → idle` queda **lossy** (antes `ratelimit → warning → warning`).

### 4.2 Verificación (medida, no supuesta)

`test/avatar-studio-roundtrip.test.ts` importa el puente real del studio (`@ego/avatar/studio`) y mide el viaje de vuelta de **los 15 estados que el renderer puede pedir**:

| Estado de Ego | → studio | → Ego | ¿Pierde identidad? |
|---|---|---|---|
| `idle` | idle | idle | no |
| `listening` | listen | listening | no |
| `working` | input | working | no |
| `searching` | inspect | searching | no |
| `waiting` | waiting | waiting | no |
| `success` | success | success | no |
| `finished` | wake | finished | no |
| `error` | error | error | no |
| `sleeping` | sleep | sleeping | no |
| `dizzy` | dizzy | dizzy | no |
| **`warning`** | **warning** | **warning** | **no** ✅ |
| `thinking` | waiting | waiting | **sí** (preexistente) |
| `approval` | waiting | waiting | **sí** (preexistente) |
| `question` | inspect | searching | **sí** (preexistente) |
| `ratelimit` | bored | idle | **sí** (la queausal A6) |

### 4.3 Conclusión

- **El diff de esta ola NO afecta al round-trip**: `warning` hace el viaje **perfecto** (Ego → studio → Ego). El `warning` que A6 añadió al motor es 1:1 en las dos direcciones.
- **La pérdida de `ratelimit` es de la zona de A6** (`packages/avatar/**`, el puente del studio) y es **preexistente**: el studio tiene menos estados que el motor de Ego, así que el estado más próximo gana. **No la toco** (no es mi zona) pero **tampoco la dejo silenciosa**: el test la **nombra** y vigila que **no crezca**.

El test no fija la deuda (no afirma "ratelimit DEBE perder la identidad"): afirma que el conjunto de estados con pérdida es **exactamente** el declarado. Si A6 arregla uno, el test sigue verde (el conjunto se encoge); si alguien añade un estado al renderer que no sobrevive al studio (como habría pasado con `warning` si el puente no lo hubiera tenido), **el test falla**.

---

## 5. El guard que faltaba (y que habría cazado el hueco)

`test/avatar-state-contract.test.ts` (7 tests) — **este es el guard que el brief pedía**:

1. El motor canónico declara el estado `warning` (lee `packages/avatar/src/runtime/states.js`, el mismo fichero que usa el motor en runtime).
2. **Todo** `CharacterState` se traduce a un estado que **existe en el motor**.
3. **Ningún `CharacterState` cae en el `idle` de reserva** — `idle` es el `default` del mapa: si un estado noIdle acaba en `idle`, es que **su `case` no existe** y el estado se ha perdido en silencio. **Este es el assert que habría cazado el hueco de `warning`.**
4. `warning` se traduce a `warning`.
5. El mapa es total (un estado desconocido cae en `idle`: fail-safe).
6. Cada estado del chat traduce a un estado conocido por el motor.
7. Los estados de señal (`warning`, `error`, `success`, `question`, `searching`, `sleeping`) existen en el motor.

**No se importa el paquete para la lista de estados**: su `exports` no expone `states.js` (y atravesar la frontera del paquete desde el renderer **duplicaría el motor en el bundle**). El test **lee el fuente canónico** en tiempo de ejecución, que es exactamente "los estados que existen en el motor".

### 5.1 RED demostrado (el guard cazó el hueco)

Con el test escrito **antes** de la implementación:

```
❯ test/avatar-state-contract.test.ts (7 tests | 2 failed)
  AssertionError: estados que caen en el idle de reserva (falta el case): warning: expected [ 'warning' ] to deeply equal []
  AssertionError: expected 'idle' to be 'warning'
```

Y el test del estado vivo (RED por módulo inexistente):

```
Error: Failed to resolve import "../components/character/avatar-live-state.js" from "test/avatar-live-state.test.ts". Does the file exist?
```

**GREEN** tras la implementación:

```
✓ test/avatar-state-contract.test.ts   (7 tests)
✓ test/avatar-live-state.test.ts       (15 tests)
✓ test/avatar-warning-engine.test.ts    (4 tests)
✓ test/avatar-studio-roundtrip.test.ts  (4 tests)
 Test Files  4 passed (4)
      Tests  32 passed (32)
```

### 5.2 El test de integración con el motor (punto 3 del brief)

`test/avatar-warning-engine.test.ts` monta un `<ego-avatar>` real y comprueba **el DOM renderizado** (no el texto de una implementación):

- `state="warning"` → el tinte `.tint` lleva el ámbar del motor (`hsl(48 92% 55%)`, opacidad `0.400`) y la insignia `.badge-warn` está **visible** (y la de "bang" —error/aprobación— **no**).
- `state="idle"` → sin tinte ámbar y con la insignia de aviso oculta.
- `warning` e `idle` se distinguen en el DOM.
- El motor **rechaza** un estado desconocido (`assertState` lanza) → fail-closed, no fallback silencioso.

---

## 6. Ficheros tocados

| Fichero | Cambio |
|---|---|
| `renderer/components/character/avatar-live-state.ts` | **NUEVO** — la resolución del estado vivo como **función pura** (+ el tipo `AvatarToolEventKind`, el acotado al turno). |
| `renderer/components/character/CharacterBadge.tsx` | `case "warning": return "warning";` en el mapa. |
| `renderer/components/ego-chat.tsx` | El `useMemo` delega en la función pura; nuevo `turnStartToolSeqRef` (corte de turno) + su asignación en `executeTurn`. |
| `renderer/src/avatar-studio.d.ts` | **NUEVO** — declaración ambiental del sub-path `@ego/avatar/studio` (el paquete es JS sin tipos para ese sub-path; mismo patrón que `src/lodash.d.ts`). |
| `renderer/test/avatar-state-contract.test.ts` | **NUEVO** — el guard de contrato chat ↔ motor (7 tests). |
| `renderer/test/avatar-live-state.test.ts` | **NUEVO** — precedencia y acotado al turno (15 tests). |
| `renderer/test/avatar-warning-engine.test.ts` | **NUEVO** — integración con el motor (4 tests). |
| `renderer/test/avatar-studio-roundtrip.test.ts` | **NUEVO** — round-trip por el studio (4 tests). |

**No tocado:** `packages/avatar/**` (A6) · `docs/**` (A1) · `.github/**` · `scripts/**` · `package.json` raíz · `.oxlintrc.json` (A7) · `tests/e2e/**`.

---

## 7. Verificación

| Comprobación | Resultado |
|---|---|
| `pnpm --filter @ego/renderer exec tsc --noEmit` | **exit 0** |
| `pnpm --filter @ego/renderer test` | **70 ficheros / 489 tests, TODOS en verde** (antes de esta ola: 65 / 436; mi aportación: +4 ficheros / +32 tests) |
| `pnpm --filter @ego/desktop test` | **56 ficheros / 345 tests OK** (+5 skipped) |
| `pnpm --filter @ego/desktop typecheck` | **exit 0** |
| `pnpm --filter @ego/desktop build` + `verify-dist.cjs` | **exit 0** — *TODOS LOS CHEQUEOS EN VERDE* |
| `pnpm -r typecheck` | **exit 0** |
| `pnpm lint` | **exit 0** |

### 7.1 Tests del renderer que fallan bajo carga (y por qué NO es este diff)

En una ejecución intermedia de la suite completa, con la máquina saturada (49–92 procesos `node` de varios agentes), 3 ficheros de heavyweight fallaron **por timeout** (`Test timed out in 5000ms`), no por aserción:

| Fichero | Aislado | En la suite completa (máquina saturada) |
|---|---|---|
| `test/App.test.tsx` | **4/4 OK** (56 s) | timeout (9,9 s) |
| `test/a11y.test.tsx` | **26/26 OK** (109 s) | timeout (22,8 s) |
| `test/input-to-paint-cfg11.test.tsx` | **4/4 OK** (88 s) | timeout (5,5 s) |

Los tres **pasan en aislamiento**. La causa es la saturación de CPU de la máquina, no el cambio: el diff no añade trabajo al render de esos componentes (la función pura se llama **una vez por cambio de dependencia** del `useMemo`, igual que antes).

**La ejecución final de la suite completa dio 70/70 ficheros y 489/489 tests en verde** (con la máquina ya más calmada).

> **Nota sobre `design-lint`:** en la primera pasada de esta ola fallaba (`EGO-DL-010 no suprime nada`: la lista blanca del linter se indexa por ID de hallazgo y las ediciones concurrentes de otro agente desplazaron los IDs). En la ejecución final **pasa**: el otro agente recalibró la lista mientras yo trabajaba. Queda **sin efecto en mi diff** (el linter no lo toco).

---

## 8. Deuda que dejo

| Deuda | Tamaño | Nota |
|---|---|---|
| El bloque del **tray** (~190 líneas) sigue en `main.ts` | 190 | De E6 (§10 del handoff de E6). |
| `getOrCreateDefaultProject` (83) + `scheduleMemoryCleanup` (47) + `modelPoolProviderFactory` (37) | ~170 | De E6. |
| El round-trip pierde la identidad de `thinking`, `approval`, `question` y `ratelimit` | 4 estados | **Puente del studio** (`packages/avatar/**`, zona de A6). Nombrado y vigilado por `test/avatar-studio-roundtrip.test.ts`; NO lo arreglo (zona ajena). |
| El estado `warning` del chat no tiene todavía un **emote** ni un sonido propio en el motor | — | A6 lo pintó con pose `warn` + insignia `warn` + sonido `tick`. Suficiente para el hueco; si el owner quiere un sonido de aviso propio, es A6. |
| `@ego/avatar/studio` sin tipos | 1 d.ts | Declarado en `renderer/src/avatar-studio.d.ts` (mismo patrón que `lodash.d.ts`). El paquete podría exponerlo en su `exports` (A6). |

---

## 9. Checklist del DoD

- [x] Punto 1: `avatarLiveState` produce `warning` con un tool que falló y el turno continúa (+ acotado al turno).
- [x] Punto 2: `mapCharacterStateToAvatarState("warning") === "warning"`.
- [x] Punto 3: round-trip verificado y **documentado** (no silencioso).
- [x] Test de comportamiento del chat: `warning` / `approval_required` / `error` / `searching` / `using_tool` / `thinking` / `generating` / `listening` / `idle` (15 tests).
- [x] Test del mapa + **guard que enumera TODOS los estados del tipo contra los que existen en el motor**.
- [x] Test de integración del motor: `<ego-avatar state="warning">` pinta el tinte ámbar y la insignia de aviso.
- [x] `pnpm --filter @ego/renderer test` verde (**70/489**) · `pnpm --filter @ego/desktop test` verde (345).
- [x] `pnpm --filter @ego/desktop build` + `verify-dist` verde · `pnpm -r typecheck` exit 0 · `pnpm lint` exit 0.
- [x] TDD real: **RED demostrado** (2 asserts del guard + módulo inexistente) y GREEN con su output.
- [x] Sin commits · sin `git checkout/reset/stash/clean` · sin `pnpm install`.
- [x] No tocado: `packages/avatar/**` · `docs/**` · `.github/**` · `scripts/**` · `package.json` raíz · `.oxlintrc.json` · `tests/e2e/**`.
