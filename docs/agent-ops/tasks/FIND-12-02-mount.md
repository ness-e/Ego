# FIND-12-02 — Montar ViewHost/ticker/upload en FloatingApp

> Estado: ✅ COMPLETO (worker FIND-12-02) · Plan: `docs/agent-ops/plans/2026-10-15-isla-flotante-ego-completa.md`
> Evidencia origen: E2E-GUI-FULL `tests/gui/specs/floating-full.spec.ts:224-237`
> (ViewHost/ticker/upload no montados; `floating.tsx:86-87` solo placeholder).
> SDP: base-only + TDD manual (RED mount vacío → GREEN composición).

## Objetivo

Montar en `FloatingApp` (`apps/desktop/renderer/floating/floating.tsx`) lo que
Task6/9 crearon y Task3 previó: `#ticker`, `#approval-card`, `#countdown`,
zona drop y Enter-aprueba. Solo composición sobre exports existentes, sin IPC
nuevo, sin tocar archivos del worker paralelo (avatar/sound/vendor).

## Spec (contrato mecánico — cada mount con contenido ante su estado)

| # | Decisión | Opción elegida (Recomendado primero) |
|---|----------|--------------------------------------|
| S1 | Cómo poblar los mounts estáticos `#ticker/#approval-card/#countdown` de `floating.html` | Portales imperativos (`StaticMount`: append de `host.el` + `hidden=false` + `sync()`) — respeta el shell Task3 sin IDs duplicados |
| S2 | Datos del approval sin payload nuevo en `FloatingStateSnapshot` | Escuchar `window.ego.onApprovalRequest` (preload ya lo expone; `PendingApproval.approvalId/toolName/arguments`) + fallback `floating-preview` etiquetado hasta que llegue el payload real |
| S3 | Línea `command` del approval | Derivada de `arguments` (`command ?? path/filePath/url`, si no resumen `tool k=v…` ≤200ch — regla Task7: nunca solo toolName) |
| S4 | `alert` → qué vista en `#approval-card` | `buildQuestion` con fallback preview (sin preguntas reales aún: bridge de preguntas no existe y crear IPC está prohibido) |
| S5 | `question.onAnswer` real | No-op local (la tarjeta deshabilita sola; el cableado a main queda como deuda, sin IPC nuevo) |
| S6 | Ingest del drop | `DropQueue` con `ingest` adaptado a `window.ego.knowledge.ingest` (existe en preload/main); sin `window.ego` → `{ok:false}` graceful, sin `console.error`; `onStep` → ticker del overview (pasos reales, no demo) |
| S7 | Archivos browser sin `.path` (File web) | Solo `canvas.setFile` + paso local "Recibido <name>"; sin ingest (ingest exige `filePath`) |
| S8 | Enter aprueba | Listener propio solo en `hitl_approval`: si el target NO es button/input/textarea/select → click sintético a `.ego-approve-btn` (idempotente `views.tsx:317` cubre doble disparo); en botones nativos se deja el comportamiento nativo |
| S9 | Countdown visible vs canónico 15s | `collapseAt = ahora+15s` al salir de hidden; la barra solo muestra ancho en la ventana final (`countdownWindowS`) — comportamiento canónico intacto; "contenido" = nodo `.ego-countdown` hijo |
| S10 | `#countdown-bar` inline actual | Se elimina (una sola barra: la del mount `#countdown`); el spec `floating-full` alcance queda obsoleto → lo actualiza el orquestador |
| S11 | MiniGrid | No aplica (0 tareas secundarias; `buildOverview` ya pinta pills; `buildCompactMiniGrid` cubierto por tests Task6) |
| S12 | rAF compartido | Un solo loop (overview.tick + countdown.update + upload.draw si `UploadSeq.isActive`); detenido en hidden (0% CPU idle); cancelado en unmount |

## Impacto mapeado (Regla 0)

- Archivos leídos completos: `floating.tsx` (108L), `views.tsx` (539L),
  `ticker.ts` (191L), `countdown.tsx` (89L), `upload-canvas.ts` (658L),
  `upload-seq.ts` (547L), `preload.ts` (puente `egoFloating` + `knowledge.ingest`
  + `onApprovalRequest`), `floating.html` (mounts estáticos),
  `floating-avatar.tsx` (solo lectura — worker paralelo),
  `WidgetHitlBridge.ts:4-17`, `types.ts:114-125` (`PendingApproval`).
- Qué exporta cada módulo (todo existe — **cero glue necesario**):
  `buildApproval/buildQuestion/buildHeader/buildOverview/buildNote` (views),
  `StepTicker` (ticker), `CountdownController` (countdown),
  `UploadCanvas/DropQueue/isSafeWebUrl` + `UploadSequence/UploadSeq` (upload).
- Qué entrega el bridge: `egoFloating.onState` (solo `FloatingStateSnapshot`:
  visible/muted/activeSubEgoId/attentionState) + `approve/deny/setMuted`;
  `window.ego` (mismo preload en la flotante — `FloatingWindowView.ts:52`):
  `onApprovalRequest` + `knowledge.ingest`. Nada más se necesita.
- Referencias hacia dentro: `FloatingApp` ← `mountFloating` ← `floating.html`;
  hosts imperativos + 1 rAF + 2 listeners (Escape existente intacto + Enter nuevo).
- Referencias entrantes: `floating-keyboard.test.tsx` (FIND-11-02: Escape y
  "Enter no colapsa en expanded" — se preservan), `floating-full.spec.ts`
  (test alcance quedará obsoleto — lo actualiza el orquestador).
- Veredicto: impacto = solo composición en `FloatingApp` (+ tests renderer);
  riesgo = colisión con worker avatar solo si toco sus archivos → prohibido;
  si un export falta/roto → BLOQUEO (ninguno falta — verificado arriba).

## Steps

- [x] S0 DISCOVERY: leer módulos + bridge + spec alcance + crear este task file (Regla 0 + Spec)
- [x] S1 RED: test mount (`test/floating-mount.test.tsx`) → 6/6 FAIL (mount vacío)
- [x] S2 GREEN: componer `floating.tsx` (StaticMount ticker/approval/countdown +
  header + dropzone + Enter + ingest existente + `AvatarSafe`) → unit PASS
- [x] S3 VERIFY: 74/74 PASS (7 archivos floating) + `tsc` 0 en archivos propios
  (`@ego/desktop` limpio; `@ego/renderer` 1 error SOLO en `floating-sound.ts`
  del worker paralelo — no tocado)
- [x] S4 BROWSER: dev-server efímero (matado, puerto 5183 libre) + script temporal
  fuera del repo → `VERIFY-FIND-12-02: PASS` (mounts>0, Enter→approve,
  drop→ticker, Escape sin resolver, countdown 160→0, main vivo; errores solo
  familias pre-existentes avatar/CSP-meta)
- [x] S5 CIERRE: DoD 7 + Review Fast + RESULTADO §7; NO commit (orquestador), NUNCA push

## Deuda / handoff al orquestador

- `floating-full.spec.ts:224-237` (test "alcance: NO montados") queda obsoleto a
  propósito: debe invertirse (monts con contenido) en el re-run.
- Steps reales del ticker: solo llegan vía drops (`DropQueue.onStep`); feed de
  tareas del main (steps por `attentionState`) es deuda futura (requiere payload
  nuevo en el snapshot — fuera de alcance: sin IPC nuevo).
- `question.onAnswer` → main: deuda (sin canal existente).
- Avatar 404 (`repos-referencia/avatar/...`) durante verificación: worker
  paralelo FIND-12-01; tolerado como conocido, no tocado.

## Review

- Review Fast (mecánico): 74/74 unit PASS · `tsc` 0 en archivos propios ·
  browser `VERIFY-FIND-12-02: PASS` · sin regresiones (FIND-11-02 verde) ·
  ownership respetado (cero toques a avatar/sound/vendor) · sin secretos ·
  VantaDB n/a. Veredicto: **approve**.
- Bugs propios encontrados y corregidos: (1) época de reloj mezclada
  (`Date.now` vs rAF → countdown en 0; fix `performance.now()`),
  (2) `overviewHost.tick` opcional (`tick?.`), (3) selector ambiguo en test
  mute (`data-mute` hook sin impacto a11y).

## Hallazgo colateral (deuda al orquestador, NO bloquea)

- El vendor avatar del worker paralelo (a mitad de su tarea: su
  `vendor/avatar/studio/element-host.js` con import `./index.js` roto, visible
  en el log del dev-server) deja `<ego-avatar>` a medio registrar → React 19
  lanza `Cannot set property presence...` al primer cambio de `presence` y SIN
  contención desmonta TODO el árbol (reproducido en código PRÍSTINO: no es
  regresión mía). Contenido con `AvatarSafe` (placeholder estable) en
  `floating.tsx` — dormido cuando el vendor sane. Si el orquestador quiere fila:
  el `pageerror` resultante es fallout FIND-12-01.
- `tsc @ego/renderer`: 1 error solo en `floating-sound.ts:380` (worker
  paralelo, en curso) — no tocado por regla de ownership.
