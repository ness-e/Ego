# Task Files — Agent-Ops

| Campo | Valor |
| --- | --- |
| Estado | Activo — índice de las task files del área `docs/agent-ops/` |
| Owner | ness-e |
| Fecha | 2026-10-19 |

---

## Propósito

Cada task file de `docs/agent-ops/tasks/` es la **unidad de trabajo verificable**
de un agente: contrato, pasos atómicos, evidencia de verificación y estado.
El inventario canónico de *tareas del producto* (fases, severidad, prioridad,
`Archivo:línea`) vive en [`docs/roadmap/Backlog.md`](../../roadmap/Backlog.md);
esta tabla es el índice de los artefactos de ejecución.

> Las task files son **worklogs internos de agentes** (ver
> [`docs/index.md`](../../index.md)): no son documentación de producto y el
> sitio VitePress las excluye (`srcExclude: ['agent-ops/**']` en
> `docs/.vitepress/config.mts`).

## Tareas vivas (83)

| ID | Título | Estado |
|---|---|---|
| `ACT-06` | Sistema de Aprobación de Acciones Sensibles (HITL… | ✅ Completada |
| `ACT-07` | Componente interactivo de Aprobación en Chat UI (… | ✅ Completada |
| `ACT-08` | Manejo de errores y reintentos con contexto causa… | ✅ Completada |
| `ACT-09` | Cliente MCP universal sobre stdio (Nivel B Integr… | ✅ Completada |
| `ACT-10` | Validación E2E del Golden Path Alpha (Pasos 8 al … | ✅ Completada |
| `ACT-11` | Gestor y Marketplace Local de MCP Servers y Skill… | ✅ Completada |
| `ACT-12` | Integrar EventBus en ToolExecutionLoop y Desktop … | ✅ Completada |
| `CHAR-03` | Prototipos de siluetas originales no humanoides y… | ✅ Completada |
| `CHAR-04` | CHAR-04 — Contrato CharacterProfile y vínculo con… | — |
| `CHAR-06` | CHAR-06 — Estados, expresiones, interpolación y a… | — |
| `CHAR-07` | CHAR-07 — Presets y `TraitRegistry` de rasgos com… | — |
| `CHAR-08` | CHAR-08 — Integración en iconos, botones, chat y … | — |
| `CORE-15` | Suite de contrato EgoMemoryAdapter ↔ NativeVantaD… | ✅ Completada |
| `DIST-02` | DIST-02 — Configuración `asarUnpack: ["**/*.node"]` | ✅ COMPLETED (T09 sync: Backlog manda — fi… |
| `DIST-03` | DIST-03 — Instaladores multiplataforma (+ iconos … | ✅ Verificada 2026-10-13 (continuación `eg… |
| `DIST-05` | DIST-05 — Auto-Updater (detección + aviso discret… | ✅ Verificada 2026-10-13 (continuación `eg… |
| `DIST-07` | DIST-07 — Docs usuario final (guía + BYOK + troub… | ✅ Verificada 2026-10-13 (continuación `eg… |
| `DIST-08` | DIST-08 — Golden Path Beta multi-día (sello relea… | ✅ Verificada 2026-10-13 (continuación `eg… |
| `DIST-09` | Task DIST-09 — Pin de VantaDB develop y política … | — |
| `DIST-10` | DIST-10 — Smoke headless asar en CI | ✅ COMPLETED (esta invocación; sin commit … |
| `DIST-11` | DIST-11 — Lint real o retirar claim | ✅ COMPLETED (esta invocación; sin commit … |
| `DIST-12` | DIST-12 — Dev concurrente desktop+renderer | ✅ COMPLETED (esta invocación; sin commit … |
| `E2E-ELECTRON-PROBE` | E2E-ELECTRON-PROBE — Sonda display + spec Electro… | — |
| `E2E-GUI-FULL` | E2E-GUI-FULL — Validación exhaustiva flotante + s… | — |
| `E2E-GUI-RUN` | E2E-GUI-RUN — Ejecución real Playwright `tests/gu… | — |
| `FIND-11-01-mock` | FIND-11-01 — Mock FloatingWindow.test.ts desactua… | — |
| `FIND-11-02-escape` | FIND-11-02 — Escape colapsa en la flotante (gap T… | — |
| `FIND-12-01-avatar` | FIND-12-01 — Avatar inerte: vendorizar motor `<eg… | — |
| `FIND-12-02-mount` | FIND-12-02 — Montar ViewHost/ticker/upload en Flo… | — |
| `HIG-01` | HIG-01 — Normalizar `tsc` en `tests/` | — |
| `HIG-02` | HIG-02 — Gate automático contra `dist/` obsoleto | — |
| `HIG-03` | HIG-03 — Eliminar `any` en `apps/desktop/src/main… | — |
| `HIG-04` | HIG-04 — Lectura quarantine-aware en `system/snap… | — |
| `HIG-05` | HIG-05 — Verificar residuales M16 (path edge Wind… | — |
| `INT-01` | INT-01 — Cableado del Fast-Path ToolExecutionLoop… | — |
| `INT-02` | INT-02 — Conexión de Proveedores Reales y BYOK en… | — |
| `INT-03` | INT-03 — Entidad Project y Aislamiento de Context… | — |
| `INT-04` | INT-04 — Integración UI de Sub-Egos (SubEgosView … | — |
| `INT-05` | INT-05 — Tarjetas de Aprobación HITL Interactivas… | — |
| `INT-06` | INT-06 — Validación E2E del Bucle Completo de MVP… | — |
| `SUB-01` | Contrato y esquema formal SubEgoManifest tipado c… | ✅ Completada |
| `SUB-02` | Fábrica Inteligente de Sub-Egos (3 modalidades) | completed # T09 sync: Backlog manda (fila… |
| `SUB-03` | Sub-Ego Runtime y ciclo de vida (Lazy Activation) | completed # T09 sync: Backlog manda (fila… |
| `SUB-04` | Aislamiento de estado privado egos/<id>/* en VantaDB | completed # T09 sync: Backlog manda (fila… |
| `SUB-05` | Shared Memory y protocolo de intercambio de contexto | ✅ Completada |
| `SUB-06` | SUB-06 — Comunicación y delegación inter-Sub-Ego … | — |
| `SUB-07` | Registro y catálogo de Sub-Egos en namespace gov/… | ✅ Completada |
| `SUB-08` | SUB-08 — Vista y Panel de Gestión de Sub-Egos en … | — |
| `SUB-09` | SUB-09 — Límites de presupuesto y cuotas de consu… | — |
| `SUB-10` | SUB-10 — Validación E2E del Golden Path Alpha (Pa… | — |
| `SUB-11` | Sub-Ego Soul / Alma: Definición de Personalidad y… | ✅ Completada |
| `SUB-12` | SUB-12 — Superación Personal & Closed Learning Lo… | — |
| `T-isla-04-autoshow` | T-isla-04-autoshow: Auto-mostrar flotante al mini… | — |
| `T-isla-05-fisica` | T-isla-05 — Física springs + geometría (COUC-18 r… | — |
| `T-isla-06-vistas` | T-isla-06-vistas — Vistas flotante (overview/pill… | — |
| `T-isla-07-hitl` | T-isla-07-hitl — HITL completo flotante↔main (WID… | — |
| `T-isla-09-upload` | T-isla-09-upload: UploadCanvas completo + drop + … | — |
| `T-isla-10-tray` | T-isla-10-tray — Tray completo + persistencia flo… | — |
| `T-isla-11-e2e` | T-isla-11-e2e — Tests + validación + verificación… | — |
| `T-isla-12-docs` | T-isla-12-docs — Cierre formal isla flotante (doc… | — |
| `T-isla-gates` | T-isla-gates — Puerta extracción + contrato legal… | — |
| `T01` | T01: Unificar contrato llmStream + window.ego único | — |
| `T02` | T02: Streaming real del chat + HITL unificado + R… | — |
| `T03` | T03: Cablear @ego/tasks al main (BackgroundEngine… | — |
| `T04` | T04: Canvas persistente + Chat↔Canvas bidireccion… | — |
| `T05` | T05: UI-01 + UI-02 — Tokens reales + chat al desi… | — |
| `T06` | T06 — UI-03: Kit Radix+Zustand + borrar muertos (… | — |
| `T07` | T07 — UI-04: A11y WCAG AA (EGO-FIND-07/08) | — |
| `T08` | T08 — UI-05: Sidebar viva + omnibar + BYOK + Dail… | — |
| `T09` | T09: UI-06 + docs sync (D1-D12, roadmap, stack, B… | — |
| `T10` | T10: Verificación integral arranque → UI (Steps 1… | — |
| `T11` | T11 — Arquitectura decidida: electron-vite + Q9 +… | — |
| `T12` | T12 — Honestidad UI: cero datos inventados, cero … | — |
| `T13` | T13: Canales IPC faltantes + probe-before-save | — |
| `T14` | T14: Conectar UI a puentes T13 (call sites vivos,… | — |
| `T15` | T15: Catálogo live de modelos por proveedor | — |
| `T16` | T16: Cerrar EGO-FIND-04/12/13 (Fase A) | — |
| `T17` | T17 — Cerrar EGO-FIND-16 + CHAR-05/10/11 + R3 (Fa… | — |
| `T18` | T18: Resume real de sesión desde VantaDB (T16-RES… | — |
| `T19` | T19 — T16-COSTS: visor tokens/USD por turno (HERM… | — |
| `T20` | T20 — T16-R10: verificación de firma MCP real | — |
| `T21` | T21 — T16-OAUTH: pool multi-key por proveedor con… | — |
| `T22` | T22: E2 — suite Playwright `tests/gui/` (13 ítems… | — |

## Archivadas (54)

Task files cerradas y movidas a `archive/` al terminar su ciclo.

| `archive/C02-blast-radius` |
| `archive/C03-list-blast-radius` |
| `archive/CFG-01` |
| `archive/CFG-02` |
| `archive/CFG-07` |
| `archive/CFG-09` |
| `archive/CFG-10` |
| `archive/CFG-11` |
| `archive/CFG-12` |
| `archive/CFG-13` |
| `archive/CFG-14` |
| `archive/DIST-01` |
| `archive/F1T1-safestorage-backend` |
| `archive/F1T2-wiring-mcp` |
| `archive/F2T3-bitemporal-hybrid` |
| `archive/F2T4-domains-rehydrate` |
| `archive/F2T5-graph-lifecycle-export` |
| `archive/F2T6-memory-gateway` |
| `archive/F3T6-decision-contracts` |
| `archive/F3T7-models-hygiene` |
| `archive/F4T8-task-engine` |
| `archive/F4T9-daily-recovery-ui` |
| `archive/F5T10-desktop-deps-ipc` |
| `archive/F5T11-desktop-hygiene` |
| `archive/F6T12-repo-docs` |
| `archive/F6T13-lows-sweep` |
| `archive/H28-gates` |
| `archive/SEC-01` |
| `archive/SEC-02` |
| `archive/SEC-03` |
| `archive/SEC-04` |
| `archive/SEC-05` |
| `archive/SEC-06` |
| `archive/SEC-07` |
| `archive/SEC-08` |
| `archive/SEC-09` |
| `archive/STAB-00` |
| `archive/STAB-01` |
| `archive/STAB-02` |
| `archive/STAB-03` |
| `archive/STAB-04` |
| `archive/STAB-05` |
| `archive/STAB-06` |
| `archive/STAB-07` |
| `archive/STAB-08` |
| `archive/STAB-09` |
| `archive/STAB-10` |
| `archive/STAB-11` |
| `archive/STAB-12` |
| `archive/STAB-13` |
| `archive/STAB-14` |
| `archive/STAB-15` |
| `archive/STAB-16` |
| `archive/VOICE-01` |

## Convenciones

- **ID**: prefijo de dominio (`T`, `ACT`, `SUB`, `INT`, `CHAR`, `DIST`,
  `HIG`, `FIND`, `E2E`, `STAB`, `T-isla`) + número.
- **Estado**: el campo `| Estado |` de la tabla de metadatos de la task file.
  Los estados canónicos son `🆕 Pendiente`, `🟡 En curso`, `✅ Verificada`,
  `🚫 Descartada: <fundamento>` (ver `.agents/references/definition-of-done.md`,
  sección "Protocolo de Veredicto de Descarte Justificado").
- Un descarte **debe** llevar su fundamento técnico en el propio estado; nunca
  se deja una compuerta en el limbo (`AGENTS.md` §4).
- Al cerrar una tarea se actualiza atómicamente el estado en la task file, en
  [`docs/roadmap/Backlog.md`](../../roadmap/Backlog.md) y en el reporte de
  verificación correspondiente (`docs/agent-ops/reports/`).
