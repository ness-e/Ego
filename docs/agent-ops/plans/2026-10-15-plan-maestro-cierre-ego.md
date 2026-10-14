# Plan Maestro Cierre Ego — 2026-10-15

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> Handoff vigente: `docs/agent-ops/plans/2026-10-14-handoff-ejecucion-paralela.md` (waves, SARL, RESULTADO, prohibiciones).

**Goal:** Cerrar todo lo pendiente auditado (Backlog + planes + tasks + HERMES R + auditoría UI-29) en 5 fases ordenadas, sin re-abrir lo verificado.

**Architecture:** La de cada fase (se indica). **Tech Stack:** Electron 33 + React 19 + Vite + Tailwind v4 + Vitest + Playwright + NativeVantaDB + AI SDK v7.

**Estado fuente (verificado 2026-10-15):** EGO-FIND 12/16 Completada (04/12/13/16 En curso); DIST-04/06/09 Pendiente; UI-01..06 + T01–T15 completadas y commiteadas; `pnpm build` + `pnpm test` raíz en verde; decisiones owner (30+3) en plan 2026-10-14 (NO re-preguntar).

---

## FASE A — Cierre EGO-FIND parciales (P2, ~2d)

| ID | Hallazgo | Cierre concreto | Verify |
|---|---|---|---|
| `EGO-FIND-04` | Router ausente del stack | Decidir: instalar React Router o retirarlo de `stack-tecnico.md` (T09 lo matizó; falta acto final) | grep 0 `react-router` en docs XOR dep instalada + tests verdes |
| `EGO-FIND-12` | 9 estados en contrato, no en kit | Aplicar los 9 estados P22 a los 5 del kit (`ui-kit/`) | test por estado × componente |
| `EGO-FIND-13` | Fullscreen + tipos Canvas | Modelar `fullscreen` en registry Zod o retirarlo del doc (T06 dejó base) | schema + test |
| `EGO-FIND-16` | Mermaid solo sanitiza | Verificar render lazy en código (se declaró pendiente) o montar `mermaid` lazy |bundle medido + test |
| `CHAR-05/10/11` | Tests motor, persistencia UI, benchmarks | Tests `CharacterEngine`, cablear persistencia UI a VantaDB, bench CPU/mem + golden frames | suites + números |
| `R3` | TOTAL 130/151 vs ~148 real | Recalcular contra filas y fijar (T09 no lo pudo verificar) | aritmética auditable |

## FASE B — Conexiones funcionales T16 (P1, ~3d)

| ID | Construcción | Contrato |
|---|---|---|
| `T16-RESUME` | Resume real de sesión desde VantaDB (restaura historial al chat, no solo id) | e2e: guardar turno → reiniciar → reanudar intacto |
| `T16-COSTS` | Visor tokens/USD por turno (HERM-21) reconciliado con MetricsConsole | UI con datos reales de `usage` |
| `T16-R10` | Verificación de firma MCP real (decidida; interino documentado) | test con firma válida/inválida |
| `T16-COUNT` | Conteos Backlog verificados (ver R3) | — |
| `T16-OAUTH` | Pool multi-key por proveedor (hermes P8 parcial) | rotación ante 429 sin leak |

## FASE C — Distribución y upstream (owner + vigilancia)

| ID | Estado | Acción |
|---|---|---|
| `DIST-04` | 🟡 owner | Certificados → firmar + `publish`; sin ellos, documentar unsigned |
| `DIST-06` | 🟡 owner | VM limpia → protocolo `CLEAN_MACHINE_TEST.md` |
| `DIST-09` | 🟡 vigilancia | Pin SHA VantaDB + tabla workaround→FIND viva |
| `REQ-08/FIND-249` | 🟡 vigilancia | Cifrado at-rest; SEC-09 stopgap vigente |
| `R12` | 🟡 owner (1 cmd) | `git worktree remove` del denied |

## FASE D — Futuros P1–P3 (nada descartado)

`COUC-23`/CHAR-12 geometría · `OCLW-17` file-watcher · `HERM-22` gateways · SoundEngine WAV · island/spring completos · `COUC-22` móvil · pricing models.dev · `T16-OAUTH` si no entra en B. Cada uno: task file propio al activarse; `🚫 Descartada` solo con justificación (AGENTS.md).

## FASE E — Automatización GUI (T-GUI)

Hoy el checklist GUI de 13 ítems es manual del owner. Automatizable por mí:
- **E1 (ya)**: DOM + axe + snapshots + consola contra dev-server Vite (puente mock; vale para layout/a11y/visual, NO para backend real). Requisito: `pnpm dev` levantado (hoy DOWN).
- **E2**: suite Playwright en repo (`tests/gui/`) con los 13 ítems como specs skip-until-green.
- **E3 (owner)**: taps con backend real (Electron+CDP con `--remote-debugging-port` o manual): BYOK real, turnos reales, HITL real, bandeja, instalador, tray, multi-ventana, diálogos nativos.
- **E4**: pixel-snapshots (base DOM hecha en T07; falta entorno con browsers).

**Orden de ejecución:** A → B → E1/E2 → C-owner → D bajo demanda. `pnpm build` + `pnpm test` verdes entre fases. Commits locales, nunca push.

## Apéndice — pendiente ya cubierto (no re-abrir)

T00–T15 (campaña 2026-10-14, commits `461c8d3`..`f8a6fae` + fixes `3230c44`/`96f2ce5`/`37b515b`/`4ca337c`/`43684fc`/`55f6b95`); EGO-FIND-01..03/05..11/14/15; UI-01..06; HIG-01/02 verificados; R1/R2/R4–R9/R11–R15; refutados de subagentes (traversal, shell:true, HITL-bypass, TOCTOU, ciclos) con evidencia en plan 2026-10-14 §evidencia.
