# T-isla-04-autoshow: Auto-mostrar flotante al minimizar / segundo plano (D2)

## Metadata
- **Plan file:** docs/agent-ops/plans/2026-10-15-isla-flotante-ego-completa.md (Task 4)
- **Fuente:** plan file Task 4 + worker prompt Task4-Autoshow (Wave 3)
- **Esfuerzo:** 🟡 0.5-1d (appetite plan)
- **Prioridad:** 🟠 (bloquea Task7-HITL y Task10-tray/persist)
- **Tipo:** TypeScript (Electron main + test)
- **Turns estimados:** 12
- **Creado:** 2026-10-15
- **last-synced:** 2026-10-15
- **Estado:** ✅ COMPLETED (código + verify; commit lo hace el orquestador)
- **Incógnitas (uphill):** 0
- **Pendientes (downhill):** 0/6 steps

## Blast Radius

| Dirección | Módulos |
|-----------|---------|
| Callers (quién llamará lo nuevo) | apps/desktop/src/main.ts (minimize handler, tray restore, onTaskEvent, onApprovalRequired, ipc.floating.setMuted); futuro Task7-HITL (floatMgr) |
| Callees (de qué depende) | packages/tasks BackgroundEngine (getActiveCount/listTasks), packages/runtime AttentionStateMachine (tipo AttentionState, solo type-level), Electron BrowserWindow/Tray (minimize/hide/showInactive/restore) |
| Implicaciones | contrato IPC +1 canal invoke (ipc.floating.setMuted); push floating:state_changed sin cambio (deuda push→FIND); FloatingWindowState +1 campo opcional (disabled, retrocompatible); main.ts solo hunks declarados, sin reformateo |
| Riesgo | medio (main.ts hot file en disputa STAB; mitigado con hunks mínimos) |
| Contrato | `pnpm --filter @ego/desktop test floating-autoshow tasks-wiring` PASS + `pnpm --filter @ego/desktop typecheck` tsc 0 |

## Impacto mapeado (Regla 0)

- **Archivos leídos (completos):** apps/desktop/src/windows/FloatingWindow.ts (92L), apps/desktop/src/windows/FloatingWindowView.ts (154L), apps/desktop/src/preload.ts (460L, egoFloating 440-454), apps/desktop/src/ipc.ts (125L), apps/desktop/src/ipc/schema.ts §T03 (620-669), packages/runtime/src/AttentionStateMachine.ts (209L), apps/desktop/src/windows/WindowStateManager.ts (223L), apps/desktop/src/main.ts (lectura por secciones: 1-130 imports, 130-250 vars, 330-433 tray, 2613-2742 createWindow, 2820-2880 backgroundEngine, 3040-3110 win+tray, 3278-3340 approval/llm, 4480-4510 tasks IPC, 4980-5044 ready/quit), tests FloatingWindow/tasks-wiring/ipc-contract/ipc-zod-coverage/main-tray-status, rules electron-ipc/gobernanza-desktop/definition-of-done/task-lifecycle, prompts question-gates/task/pipeline-full, plan file Task 4 (235-289), skills campaign-executor/frontend-ui-engineering/progreso/test-driven-development/source-driven-development (encabezados)
- **Archivos referenciados hacia dentro (imports/dependencias):** FloatingWindow.ts → FloatingWindowView.js (BrowserWindow mock en tests); main.ts → @ego/tasks (BackgroundEngine 147, instanciación 2833), ./windows/WindowStateManager.js (160), ./main/tray-status.js (173-178); preload.ts → ipc.floating.setMuted invoke (453) + floating:state_changed on (444); BackgroundEngine.ts → getActiveCount (364), listTasks (339), onTaskEvent (13/368), onApprovalRequired (36/174)
- **Archivos que referencian a los editados (referencias entrantes):** FloatingWindowManager hoy solo instanciado en tests (grep `new FloatingWindowManager` en src = 0 en main.ts — gap verificado); toTrayStatus sin callers en src; renderer/floating/floating.tsx usa window.egoFloating.onState/setMuted (no toca string de canal, renombre seguro si hiciera falta — NO se renombra en esta task); ipc-contract.test.ts audita main.ts↔ipc.ts↔preload.ts (se cierra 1/2 deudas, push queda FIND)
- **Veredicto impacto:** medio — main.ts es god-file 5047L en disputa STAB; editar SOLO 7 hunks declarados (~60 líneas netas), sin reformatear, sin tocar updater/ipc-schema existente/preload/renderer/packages/docs. FloatingWindow.ts +92→~150L (puro aditivo). Test nuevo aislado con mock electron completo (no hereda x6 rojo colateral de FloatingWindow.test.ts, owner SEC-01, NO tocar).

## Contrato
`pnpm --filter @ego/desktop test floating-autoshow tasks-wiring` PASS (2+ casos nuevos + 5 tasks-wiring verdes) + `pnpm --filter @ego/desktop typecheck` tsc 0, sin regresiones en suites relacionadas, sin TODO, deuda setMuted cerrada.

## Spec (SDD — feature-add con símbolos públicos nuevos)

| # | Decisión | Opciones (+tradeoff) | Default recomendado | Resuelto |
|---|----------|----------------------|--------------------|----------|
| 1 | Firma shouldAutoShow | A: 4 campos {active,hitl,muted,disabled} (cubre presencia off) / B: 3 campos plan Task4 (sin disabled) | A (superset; disabled opcional → acepta ambos) | ✅ decidido-por-evidencia (worker prompt §1a + plan Task4 Step 3; muted/disabled false-paths exigidos por DoD criterio 3) |
| 2 | Canal push floating:state_changed sin prefijo ipc. | A: renombrar a ipc.floating.state_changed (rompe nada en renderer — usa bridge — pero toca preload solo-lectura + expande blast) / B: no tocar, registrar FIND para Task10/12 | B (acceptance Task4 no exige ipc-contract verde; 1/2 deudas cerradas aquí) | ✅ decidido-por-evidencia (renderer/floating/floating.tsx:41 usa bridge.onState, no literal — verificado por grep; preload.ts es solo-lectura en worker prompt §2) |
| 3 | Dónde vive disabled/presencia | A: in-memory en manager + snapshot (persistencia Task10) / B: persistir ya en WindowStateManager | A (Task10 es dueño de WindowStateManager floating_window + Task10 test floating-persist; no invadir) | ✅ decidido-por-evidencia (plan Task 10 Step 3 + worker prompt §2 PROHIBIDOS WindowStateManager Task10 futuro) |
| 4 | Close vs minimize por OS | Solo minimize (spec); close sin handler (window-all-closed intacto). Sin decisión abierta: NO implementar close-to-tray | N/A — fuera de scope | ✅ decidido-por-evidencia (plan Task4 Step 3 solo win.on minimize; Gate D no dispara) |
| 5 | Validación setMuted | A: Zod schema nuevo FloatingSetMutedSchema en ipc/schema.ts (patrón SEC-02) / B: check manual typeof | A (higiene SEC-02, hunk 6L en schema.ts) | ✅ decidido-por-evidencia (apps/desktop/src/ipc/schema.ts:648-653 patrón TasksCancelSchema) |
| 6 | tray restore con flotante | restore existente + floatMgr.hide() (2L aditivas en closure restore) | N/A — extensión directa | ✅ decidido-por-evidencia (main.ts:405-415 closure restore) |

Gate D: NO disparado — spec GO Wave2 aprobada cubre el CÓMO; 0 decisiones no declaradas tras zero-code planning (close/dbl-click fuera de scope explícito, no asumir).

## Invariantes de dominio (handoff — MUST)
- **Invariantes a preservar:** contextIsolation/sandbox/nodeIntegration flags intactos; renderer nunca toca VantaDB (solo main); aprobación explícita + kill switch (gobernanza-desktop); FloatingWindow.test.ts x6 rojo NO tocar (owner SEC-01); archivos fuera de blast radius (verify-audit.jsonl M, ModelRouter.ts M, Arreglar-OpenCode.ps1, Untitled-1.py, __pycache__/, robot-chat-follow.png) intactos, sin commit de ellos; NUNCA git push.
- **Comandos de verificación:** `pnpm --filter @ego/desktop test floating-autoshow tasks-wiring` (PASS) + `pnpm --filter @ego/desktop typecheck` (tsc 0)
- **Deuda pendiente:** push `floating:state_changed` fuera de contrato ipc. (FIND-* para Task10/12); persistencia floating_window pos/mute/disabled → Task10; FloatingWindow.test.ts x6 rojo colateral (owner SEC-01)

## Recitation (canónico)
- activeGoal: T-isla-04-autoshow — autoshow flotante al minimizar con trabajo/HITL + deuda setMuted
- lastAction: DISCOVERY completo + task file creado; baseline: tasks-wiring 5/5 PASS, main-tray-status 4/4 PASS, FloatingWindow x6 rojo colateral (mock sin webContents.on), ipc-contract 2 fallos deuda Task3
- result: OK — ✅ COMPLETED, 6/6 steps
- nextAction: ninguna (task completa; commit selectivo del orquestador: "feat: autoshow flotante al minimizar con trabajo/HITL")
- contract.verificacion: `pnpm --filter @ego/desktop test floating-autoshow tasks-wiring` 13/13 PASS (exit 0) + `pnpm --filter @ego/desktop typecheck` tsc 0
- contract.deuda: push sin catalogar + persistencia Task10 + x6 colateral SEC-01
- nextTask: Task7-HITL (usa floatMgr)

## Deuda técnica (Regla 6 — MUST)
**Saldo neto:** Sin deuda nueva — la deuda setMuted se CIERRA; push no catalogado se deriva como FIND (preexistente Task3, no nueva).

## Definition of Done (P2-08)
Task: contrato §Contrato + tests éxito+error (muted/disabled false-paths) + tsc 0. Commit: NO commitear (orquestador hace commit selectivo; worker deja working tree con solo archivos task). Release: N/A (task de feature, no release).

## Herramientas necesarias
- vitest focused (`pnpm --filter @ego/desktop test <nombre>`) + tsc (`typecheck`)
- codegraph/Code Intelligence (blast radius ya mapeado vía grep+read; codegraph sin índice para este proyecto — fallback documentado)

**Skills cargadas (SDP):** campaign-executor (gates D/V/C + recitation + RESULTADO §7) · progreso (tracking sesión + cierre) · frontend-ui-engineering (wiring Electron main: minimize/hide/showInactive, Tray restore) · source-driven-development (portar tray.rs/island.rs showInactive/click-restore/refresh-por-engine con evidencia archivo:línea) · test-driven-development (lógica nueva → failing test primero RED→GREEN). SDP manual (sin MCP campaign_discover_skills_v2 en este harness): keywords autoshow/minimize/tray/electron → skills arriba, 1 línea cada una arriba.

## Investigation Notes
- Baseline verify (2026-10-15, `pnpm --filter @ego/desktop test ipc-contract tasks-wiring FloatingWindow main-tray-status`): 12 PASS / 8 FAIL. PASS: tasks-wiring 5/5, main-tray-status 4/4 (+3 ipc-contract parciales). FAIL: FloatingWindow.test.ts x6 `this.window.webContents.on is not a function` (mock electron incompleto tras Task3 will-navigate guard — colateral SEC-01, NO tocar); ipc-contract 2 (`ipc.floating.setMuted` no catalogado + `floating:state_changed` no en push — deuda Task3 documentada en preload.ts:105-111).
- pretest ensure-fresh-dist reconstruye paquetes con errores tsc preexistentes (@ego/models, @ego/security, @ego/tasks, @ego/tools — noUncheckedIndexedAccess) pero continúa ("todos los dist/ al día") y vitest corre igual — colateral fuera de scope, no tocar.
- Gap verificado: `grep FloatingWindowManager main.ts` = 0 matches (manager solo en tests); `grep ipc.floating main.ts` = 0 (handler ausente). Plan Task4 gap confirmado.
- SDD sources (tray.rs/island.rs port): showInactive ya usado en FloatingWindowManager.show() (FloatingWindow.ts:55); click-restore ya en ensureTray restore closure (main.ts:405-415); refresh-por-engine ya en onTaskEvent/onApprovalRequired (main.ts:2868/2875) — esta task AÑADE el eslabón flotante (syncFloatingFromEngine + minimize autoshow), sin reinventar.
- Web research: sin red necesaria; patrones verificados en código local (main.ts:424-460 ensureTray, FloatingWindowView.ts:86-96 loadContent, FloatingWindow.ts:50-57 show/showInactive). Digest: minimize→hide+float es close-to-tray estándar Electron; showInactive evita robo de foco (focusable:false ya en Manager ctor); setIgnoreMouseEvents forward para click-through (ya en View). [Sin URLs externas — patrones locales verificados.]
- SECURITY/PERFORMANCE (P2-07): SECURITY — toca IPC (renderer→main) con input {muted:boolean}: validación Zod fail-closed (FloatingSetMutedSchema), sin secretos, sin FS/red; checklist security-and-hardening N/A más allá (no hay skill file local; justificado: superficie = 1 boolean validado). PERFORMANCE: no toca hot paths (minimize/tray/event callbacks esporádicos, sin loops); N/A con justificación.

## Incógnitas (uphill) vs Pendientes (downhill)
| Eje | Contador |
|-----|----------|
| Incógnitas abiertas | 0 |
| Pendientes de ejecución | 0/6 steps ✅ |
| % completado | 100% (código + verify; commit orquestador) |

## Steps

### Step 1: Test RED floating-autoshow (TDD, failing primero)
- **Archivos:** `apps/desktop/test/floating-autoshow.test.ts` (crear)
- **Acción:** test puro: shouldAutoShow true (active=1 / hitl=1) + false (idle / muted / disabled) + syncFromAttention identidad + manager setMuted/setDisabled (mock electron COMPLETO: webContents on/send/setWindowOpenHandler/loadURL/loadFile, showInactive/hide, screen). 6+ casos.
- **Verify:** `pnpm --filter @ego/desktop test floating-autoshow` → FAIL `shouldAutoShow is not a function` (RED canónico)
- **Estado:** ✅ COMPLETED (RED 7/8 `is not a function` + fix mock loadURL/loadFile en win)

### Step 2: FloatingWindow.ts — shouldAutoShow + syncFromAttention + presencia (GREEN)
- **Archivos:** `apps/desktop/src/windows/FloatingWindow.ts`
- **Acción:** aditivo (~60L): campo `disabled?: boolean` en FloatingWindowState (default false en ctor); `shouldAutoShow(s:{active;hitl;muted;disabled?})` (true iff (active>0||hitl>0) && !muted && !disabled); `syncFromAttention(a)` identidad con fallback 'hidden'; métodos `setMuted(b)` + `setDisabled(b)` vía updateState. Sin tocar show/hide/updateState/toTrayStatus.
- **Verify:** `pnpm --filter @ego/desktop test floating-autoshow` → PASS 6+/6+
- **Estado:** ✅ COMPLETED (GREEN 8/8)

### Step 3: schema.ts + ipc.ts — catalogar canal setMuted (cierra 1/2 deuda)
- **Archivos:** `apps/desktop/src/ipc/schema.ts` (+6L FloatingSetMutedSchema), `apps/desktop/src/ipc.ts` (+1L invoke channel)
- **Acción:** `export const FloatingSetMutedSchema = z.object({ muted: z.boolean() })` + type; añadir `"ipc.floating.setMuted"` tras ipc.net.fetch con comentario Task4.
- **Verify:** `pnpm --filter @ego/desktop test ipc-contract` → 4/5 (solo falla push preexistente, derivado FIND)
- **Estado:** ✅ COMPLETED (invoke cerrado; push → FIND-pendiente Task10/12)

### Step 4: main.ts — 7 hunks mínimos (import, singleton, helpers, minimize, restore, eventos, handler)
- **Archivos:** `apps/desktop/src/main.ts` (solo hunks declarados)
- **Acción:** (1) import FloatingWindowManager+shouldAutoShow tras WindowStateManager; (2) `let floatMgr + ensureFloatMgr()` junto a tray vars; (3) `floatingSnapshot()` + `syncFloatingFromEngine()` tras refreshTrayStatus; (4) restore closure + floatMgr.hide(); (5) en createWindow tras trackWindow: init floatMgr + win.on("minimize") autoshow; (6) onApprovalRequired/onTaskEvent: refreshTrayStatus→syncFloatingFromEngine; (7) handler ipc.floating.setMuted tras tasks.cancel.
- **Verify:** `pnpm --filter @ego/desktop test tasks-wiring` PASS + `typecheck` tsc 0
- **Estado:** ✅ COMPLETED (8 hunks; 1 fix tsc win-null-guard en closure minimize)

### Step 5: Verify contrato completo + regresiones relacionadas
- **Archivos:** (ninguno — solo comandos)
- **Acción:** `pnpm --filter @ego/desktop test floating-autoshow tasks-wiring ipc-contract main-tray-status` + `typecheck`. tasks-wiring PASS, typecheck 0, floating-autoshow PASS; ipc-contract 4/5 con único fallo push preexistente documentado.
- **Verify:** salida verde salvo push-FIND conocido
- **Estado:** ✅ COMPLETED (floating-autoshow 8/8, tasks-wiring 5/5, tray 4/4, zod 12/12, ipc-contract 4/5 único fallo push preexistente)

### Step 6: Review Fast + DoD 7/7 + cierre (sin commit)
- **Archivos:** task file (Review + estados ✅)
- **Acción:** self-review tier Fast (paths apps/desktop/*, no adversarial) con checklist anti-hábitos + veredicto; DoD 7/7; actualizar steps ✅; NO commit/NO push (orquestador).
- **Verify:** task file con §Review veredicto approve + RESULTADO §7
- **Estado:** ✅ COMPLETED (review Fast approve degradado + DoD 7/7; sin commit por diseño)

## Dependencias
- Task3 DONE (floating.html + loadContent + egoFloating) · Task1 DONE (FSM AttentionState)
- Wave 3 paralelo Task6-vistas: archivos DISJUNTOS (Task6 renderer/floating/views*, Task4 src/windows+main+test) — sin colisión
- Next: Task7-HITL (usa floatMgr) · Task10 (persistencia floating_window + tray completo)

## Review (GATE — agente distinto, P2-01)
- **Revisor:** self-review Fast degradado (sin subagente ego-audit disponible en harness; se registra como degradado + spot-check mecánico). Tier Fast: paths apps/desktop/src/windows/*, apps/desktop/src/main.ts (hunks), apps/desktop/src/ipc*, test nuevo — ningún glob adversarial (docs/api, src/sdk, storage, serialization).
- **Enfoque:** correcto — eslabón minimize→float + setMuted + sync engine→flotante+tray; showInactive sin robo de foco y click-restore reutilizan mecanismos existentes (FloatingWindow.ts:55, main.ts:405-415). Alternativa renombrar push descartada con justificación (Spec #2).
- **Cómo se probó:** RED `shouldAutoShow is not a function` 7/8 → GREEN 8/8; `test floating-autoshow tasks-wiring` 13/13 exit 0; `typecheck` tsc 0; diff 144+/2- solo aditivo (2 líneas reemplazadas preservan tray vía sync→refreshTrayStatus).
- **Checklist anti-hábitos tóxicos:**
  - [x] No inventar salidas de comandos/herramientas que no se ejecutaron.
  - [x] No saltarse la clarificación por "ya sé qué quiere" (Gate D evaluado, Spec GO Wave2).
  - [x] No declarar done sin verificar contra los acceptance criteria (13/13 + tsc 0).
  - [x] No ignorar fallos ni reportar "todo OK" cuando hubo fallo parcial (push preexistente → FIND documentado).
  - [x] No hacer un solo intento de búsqueda y darlo por saturado (grep+reads múltiples con archivo:línea).
  - [x] No copiar sin citar ni presentar supuestos propios como evidencia (citas archivo:línea en Regla 0/Spec).
  - [x] No reintentar en bucle sin diagnóstico (1 fix tsc con causa raíz win-null en closure).
  - [x] No dejar huérfanos los pasos: cada paso conectado al objetivo.
  - [x] No degradar el chequeo de errores en paths de dinero/seguridad (Zod fail-closed en setMuted).
  - [x] No gastar presupuesto infinito; paradas explícitas (6 steps, 0 stalls).
  - [x] Verificar cobertura SDP (v3): `SKILLS_CARGADAS` cubre el dominio (electron/tdd/sdd/pipeline/progreso).
- **Veredicto:** ✅ approve (degradado: waiver owner pendiente — el orquestador confirma o re-corre ego-audit)

## Notas
- Worker sin `question` tool → Gates vía RESULTADO si disparan (D no dispara; V umbral 2 mismo-error; C auto+log salvo archivos fuera de blast radius → dejar sin commit).
- Commit esperado (LO HACE EL ORQUESTADOR): "feat: autoshow flotante al minimizar con trabajo/HITL".
- Context Save Point: DISCOVERY 100% (Regla 0 poblada, Spec llena, steps atómicos). Próximo: Step 1 test RED.

## Context Save Point
- **Dónde estoy:** task file creado, 0/6 steps ACT. Todo lo necesario leído y citado con archivo:línea.
- **Decisión clave:** no renombrar push (FIND→Task10/12); disabled in-memory (persistencia→Task10); FloatingWindow.test.ts no tocar.
- **Comando siguiente:** crear `apps/desktop/test/floating-autoshow.test.ts` y correrlo esperando RED.
