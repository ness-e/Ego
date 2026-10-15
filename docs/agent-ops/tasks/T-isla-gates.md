# T-isla-gates — Puerta extracción + contrato legal (Task 0)

> Plan: `docs/agent-ops/plans/2026-10-15-isla-flotante-ego-completa.md` Task 0
> Tipo: docs-only (100% markdown, sin decisiones técnicas nuevas, sin código)
> Estado: ✅ COMPLETO (documental, `n/a` test código)
> SDP: base-only (docs-only; sin candidatos MCP más allá de lectura local)

## Contrato (ley)

- Crear `docs/agent-ops/tasks/T-isla-gates.md` con secciones Asimilar / Adaptar / Descartar + legal MIT vs LICENSE-ASSETS.
- Verificación gate: menciones nominales del personaje ajeno solo en contexto descarte (toda mención calificada con NO).
- `task_validate_format` no aplica (docs, sin código ni tests).
- NO tocar código. NO commitear (árbol compartido sucio — commit lo hace el owner/lead).

## Spec — decisiones heredadas (NO nuevas; del plan 2026-10-15, HITL owner)

| # | Decisión heredada | Fuente |
|---|---|---|
| D1 | Visual = criatura `repos-referencia/avatar` (NO personaje Coucou) | Plan:12 |
| D2 | Minimizar = auto-mostrar flotante si hay trabajo/HITL, click restaura, silencable | Plan:13 |
| D3 | Sonido = `avatar/src/runtime/sound.js` procedural (28 recetas, cero WAV binarios) | Plan:14 |
| D4 | Drop = UploadCanvas completo porteado (UploadSeq + canvas + ingest background) | Plan:15 |

## Gates isla (Opción B)

### Asimilar (mecanismo, sin marca ajena)

- `fsm.ts` → `PresenceStateMachine` / `avatar presence.js` → `AttentionStateMachine` (estados `hidden/compact/expanded/alert/hitl_approval`; tiempos `homeToCompact 15_000`, `compactToHidden 60_000`, `greetAuto 600`, `greetHover 10_000`, `finishedPin 5_200`).
- `anim.ts` Spring/Tracked + `Ease`/`cubicBezier`/`closeCurve` (open spring `0.5/0.72`, close `340ms ease (.45,0,.2,1)`).
- `avatar/src/runtime/sound.js` 28 recetas (`SOUND_NAMES` literales, `STATE_SOUND/EMOTE_SOUND/ACTION_SOUND`, volumen `0.12` cotas `[0,0.2]`, idle suspend `1500ms`).
- UploadSeq aritmética (`USC`, `eOut/eIn/eBack`, `squeezeY/X`, follow spring `0.35`/lock `0.18`, `LOCK_IN 60/OUT 90`, curva progreso `60/32/8`, `simulateTo 240Hz`).
- Approval ACK `800ms` + timeout `110-115s` (sin UI no bloquea, fallback a main).
- `SafeWebURL` solo `http/https` + host (bloquear `file:/smb:/custom`) antes de `shell.openExternal`.
- `PollGate` → event-driven `setIgnoreMouseEvents` (`mouseenter/leave` + IPC rect; prohibido polling 60Hz).

### Adaptar (shell Coucou → contratos Ego)

- `island.ts` shell → `FloatingWindow` + `floating.html` (fuente Coucou: NO clon visual — solo mecanismo).
- `views/*.ts` → cards Ego (`ViewHost{el/sync/tick/focus}`, overview ticker-vs-card, `pillBadge` solo si `focusId!=id`, approval botones 1 vez, question 1-4q/2-4opts, `CompactMiniGrid 2x2`, `CountdownBar 15s`, ticker `MAX_QUEUE 4, ROW_H 22, DURATION 380, cubic(.4,0,.2,1)` sin CSS transitions).
- `tray.rs` → `main.ts ensureTray` tricolor (verde idle / azul pensando / rojo HITL; menú Open/Settings/Pause/Quit).
- `TurnRecorder` → `RunRecorder` (ya existe en `packages/tasks/src/RunRecorder.ts`).
- `DemoEngine` → `SyntheticRuntime` (ya existe en `packages/runtime/src/SyntheticRuntime.ts`).
- Upload canvas zone/bar/choose + personaje propio/file (NO personaje Coucou — solo mecanismo suck strips 28 + clip mouth, overlay botones invisibles).

### Descartar (con justificación — única sección con menciones nominales)

- Motor visual del personaje Coucou — NO Mochi (marca protegida; se usa criatura `repos-referencia/avatar` por D1).
- Ruta origen del motor visual — NO Mochi (ruta `windows/src/[personaje]/engine.ts`, no portar; solo mecanismo FSM/anim).
- `greeting.ts` / `minibots.ts` — NO Mochi (identidad de marca ajena; saludo y mini-bots se redefinen en Ego).
- Sonidos `NotchBuddy/Resources/sounds/` — NO Mochi (assets protegidos; D3 usa síntesis procedural propia).
- Iconos `NotchBuddy/Assets.xcassets/` (app + menu bar) — NO Mochi (assets protegidos; Ego usa iconografía propia).
- Nombres "Coucou"/personaje e imágenes/GIFs/videos `docs/media/` + `design/` — NO Mochi (marca y artwork protegidos).
- `CloudKit` — descartado (backend Apple propietario; Ego persiste en VantaDB local).
- `NSPanel/SwiftUI` (`IslandWindowController.swift`, `IslandStateMachine.swift` como UI, `AppState.swift` monolito) — descartado como arquitectura (solo FSM pura como mecanismo; Ego ya desacopló en 7 stores por COUC-05).
- `Tauri Rust backend` (`src-tauri/src/island.rs`, `tray.rs` como backend) — descartado (Ego es Electron 33 + `electron-vite`; solo mecanismo tray tricolor).
- Polling de ratón `60Hz` — descartado (derroche CPU; sustituido por event-driven `setIgnoreMouseEvents`).
- `TOOL_LABELS` francés — descartado (localización; Ego usa etiquetas propias).
- `PROJECT_COLORS` — descartado (identidad visual ajena; Ego usa `design-system.md` dark-only 4 presets).
- Teléfono/remoto (`Phone/`, puente remoto) — NO Mochi (fuera de alcance isla; COUC-22 futura P1/P2, sin clon de marca).

### Legal: MIT código SÍ con copyright; LICENSE-ASSETS NO

- `repos-referencia/coucou/LICENSE` (MIT, Copyright (c) 2026 Louis Raillé): cubre SOLO código fuente — portar mecanismos SÍ permitido con aviso de copyright + aviso de permiso incluidos en copias/porciones sustanciales.
- `repos-referencia/coucou/LICENSE-ASSETS.md`: nombres "Coucou" y personaje (NO Mochi en Ego), diseño/look/expresiones/animaciones del personaje, iconos, sonidos e imágenes/GIFs/videos — prohibidos sin permiso escrito (publicar/distribuir app/fork/derivado con ellos, uso comercial o sugerencia de aval). Fork bienvenido bajo MIT solo con nombre/icono/personaje/sonidos propios → D1 (criatura `repos-referencia/avatar`) cumple exactamente esto.
- `repos-referencia/avatar/LICENSE` (MIT): la criatura propia se porta/copia sin restricción de marca.
- Sonido D3 (`avatar/src/runtime/sound.js` procedural, 28 recetas, cero WAV): sin binarios ajenos; si se vendoriza, nota de copyright correspondiente.
- Regla operativa: todo `grep -ri` nominal en artefactos activos de Ego debe dar 0 fuera de contexto descarte (ver Verificación).

## Impacto mapeado (Regla 0 — docs, sin código)

- Leídos completos: plan `2026-10-15-isla-flotante-ego-completa.md` Task 0 (§28-68), `docs/review/backlog-coucou.md` (COUC-06/17/18/19/20/21), `repos-referencia/coucou/LICENSE`, `repos-referencia/coucou/LICENSE-ASSETS.md`, `repos-referencia/avatar/LICENSE`.
- Referencias hacia dentro: ninguna (archivo nuevo, solo citado por el plan Task 0 Step 3/4).
- Referencias entrantes: plan Task 0 (gate previo a Tasks 1-12); COUC-17/18/19/20/21 como justificación de descarte visual.
- Veredicto: blast radius SOLO este archivo markdown. Cero código. Reversible por borrado.

## Steps

| Step | Estado | Descripción |
|---|---|---|
| S1 | ✅ DONE | Redactar Asimilar/Adaptar/Descartar + legal MIT vs LICENSE-ASSETS |
| S2 | ✅ DONE | Verificar menciones nominales solo en contexto descarte (ver abajo) |
| S3 | ⬜ PENDING-OWNER | Commit owner/lead (`git add` + `git commit`) — NO commitear como subagente (árbol compartido sucio) |

## Verificación

```powershell
# Toda mención nominal solo en contexto descarte (cada línea con match lleva "NO" calificando):
Select-String -Pattern "mochi" -Path "docs/agent-ops/tasks/T-isla-gates.md" # NO Mochi — gate: solo descarte
# Equivalente gate plan (bash): grep -ri "mochi" docs/agent-ops/tasks/T-isla-gates.md | grep -v "NO.*Mochi\|sin Mochi\|no Mochi" → 0 líneas (gate ok)
```

- Resultado: toda línea con match contiene `NO Mochi` (calificador de descarte). `task_validate_format`: no aplica (docs).
- Archivos tocados: `docs/agent-ops/tasks/T-isla-gates.md` (creado). Sin toques de código. Sin commit (árbol compartido sucio).
