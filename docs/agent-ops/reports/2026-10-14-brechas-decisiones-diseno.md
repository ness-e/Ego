# Brechas: decisiones de diseño tomadas vs implementadas — 2026-10-14

Origen: respuestas del owner en sesión (2026-10-13/14) + informe
`docs/agent-ops/reports/2026-10-13-auditoria-diseno-frontend-ego.md` + investigación
fundacional `C:\Users\Eros\Downloads\Preguntas y respuestas.txt` (Q4/Q11–Q13/Q22/Q24/Q25).
Método: cada punto verificado contra código antes de afirmar estado.

## 1. Doctrina fundacional (Q&A) vs construido

| Decisión fundacional (Q&A) | Estado en código | Brecha |
|---|---|---|
| Q4: sin pantallas fijas por agente; agentes construyen Canvas vía UI Runtime con catálogo | Implementado (`CanvasRuntime` + registry Zod + `CanvasBridge`) | Ninguna |
| Q12: Chat + Canvas, selección como contexto | Implementado (`useSelectionContext`, `SelectionToolbar`) | Ninguna |
| Q13: abrir con estado vivo accionable | Implementado (`DailyDashboard`, first-launch) | Ninguna |
| Q22/P22: UI iterativa con presupuesto 15–20% | Auditorías 16.8–18.2% 🟢 | Ninguna |
| Q25-#1: layout rígido eliminado → Chat + Workspace + contextuales | Parcial: App usa 3 columnas fijas sin redimensionado | **GAP-01**: layout fijo contradice "evoluciona según contexto" |
| Q25-#8: Dots deja de ser concepto central → Background Activity | Parcial: Widget + Tray existen sin distinción documentada | **GAP-02**: D8 decidido (documentar), no aplicado |
| Q25-#12: Workspace con schema/registry/renderer/selección/persistencia | Implementado | Ninguna |

## 2. Decisiones de sesión: estado real de implementación

**Ninguna está implementada.** El plan `docs/agent-ops/plans/2026-10-14-plan-diseno-frontend.md`
(UI-01..UI-06) existe pero su ejecución no empezó (todo ⬜ PENDING).
Por tanto cada "decidido pero no aplicado" es literalmente todo lo siguiente:

### Código (verificado pendiente en código el 2026-10-14)
| # | Decisión | Estado | Evidencia de pendiente |
|---|---|---|---|
| F1 | Geist por import | ❌ No aplicado | sin `geist/font` en `main.tsx`, cae a Segoe UI |
| F2 | Accent ámbar #f59e0b | ❌ No aplicado | sin `--color-accent`; 6 usos fantasma siguen |
| F3 | app-region en CSS | ❌ No aplicado | clases muertas; arrastre solo por overlay |
| F4 | ego-chat a tokens | ❌ No aplicado | 13 `style={{}}` intactos |
| F5 | Borrado total muertos | ❌ No aplicado | `union.tsx`/`ui.tsx`/`mock.ts`/streamdown/radius-card/electronAPI/SplitPane-test siguen |
| F6 | clsx en kit | ❌ No aplicado | 0 imports; kit no existe |
| F7 | 4 presets funcionales | ❌ No aplicado | `--ego-*` sin consumidores |
| F8/F9 | Paletas unificadas | ❌ No aplicado | zinc/neutral/hex conviven |
| F10 | Registry Zod-inferido | ❌ No aplicado | `registry.ts:14 props: any` |
| F11 | Boundary global | ❌ No aplicado | solo `MessageRenderBoundary` |
| F12 | Skeletons + error UI | ❌ No aplicado | texto plano + `console.error` |
| F13 | Reservas anti-shift | ❌ No aplicado | composer se desplaza |
| F14 | Lazy charts/dominios | ❌ No aplicado | bundle único 1.48 MB |
| F15 | Virtualización ahora | ❌ No aplicado | sin windowing |
| F16/F17/F18 | Foco global, trap+Escape, dim #8a8a92 | ❌ No aplicado | 0 focus-visible; modales sin trap; dim 2.6:1 |
| Kit/aria/tests/radios | Completos según decisión | ❌ No aplicado | no existen |
| Split sidebar | Dividir en 3 modales | ❌ No aplicado | 862 líneas intactas |

### Docs (verificado pendiente)
| # | Decisión | Estado |
|---|---|---|
| D1 | ux-ui.md acepta sidebar dual | ❌ No aplicado |
| D2 | Monolito silueta por defecto | ❌ No aplicado (art-direction dice delta-core) |
| D3 | character-system → implementado | ⏳ Re-pregunta abajo: verificación real dio 3 PARCIAL |
| D4 | Fila CHAR-03 sin "trajes" | ❌ No aplicado (Backlog:176 intacto) |
| D5 | 6 capas + sombra sub-paso | ❌ No aplicado |
| D6 | "Superficies" vs "niveles" | ❌ No aplicado |
| D7 | 4 elementos en workspace-dinamico | ❌ No aplicado |
| D8 | Widget vs Tray documentados | ❌ No aplicado |
| D9 | Regla B/N formalizada | ❌ No aplicado (cita sigue huérfana) |
| D10 | Dark-first matiza gui-desktop | ❌ No aplicado |
| D11 | roadmap.md sincronizado | ❌ No aplicado |
| D12 | design-system.md | ❌ No creado |

## 3. Verificación CHAR-05..11 (background, solo lectura, 2026-10-14)

| Tarea | Veredicto | Motivo |
|---|---|---|
| CHAR-05 | PARCIAL | Motor real (~2000 líneas) pero 0 tests dedicados |
| CHAR-06 | REAL | FSM + 7 tests verdes |
| CHAR-07 | REAL | TraitRegistry + 5 tests verdes |
| CHAR-09 | REAL | Morph + 5 tests verdes |
| CHAR-10 | PARCIAL | UI y contrato existen pero desconectados; lo guardado no sobrevive reinicio |
| CHAR-11 | PARCIAL | MotionGuard real; faltan benchmarks CPU/memoria y golden frames |

Consecuencia para D3: la premisa "CHAR-05..11 completados" es falsa. No se puede marcar
`character-system.md` como implementado sin más.
