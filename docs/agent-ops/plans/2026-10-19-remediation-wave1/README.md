# Contrato de ejecución — Ola 1 de remediación (2026-10-19)

> **Este fichero es la ley de la ola.** Los 8 subagentes trabajan en el MISMO árbol de trabajo, en paralelo. La tabla de propiedad es la que evita colisiones: si un fichero no es tuyo, **no lo tocas**; si necesitas un cambio fuera de tu zona, lo **solicitas por handoff** (ver §4).

## 1. Origen

Auditoría de 8 agentes sobre el repo completo: `docs/agent-ops/reports/reviews/review-full-2026-10-19.md`
(16 críticos · 46 altos · 75 medios · 31 bajos). Hallazgos canónicos: `EGO-FIND-18..79` en `docs/roadmap/Backlog.md`.

**Decisiones ya tomadas por el owner (2026-10-19):**
- Se ejecutan **todos los bloques, uno por uno** → esta es la Ola 1 (Bloques 0 + A + B + C + D). El Bloque E (motor y deuda P2) queda para la Ola 2.
- El avatar **mantiene las tres copias** por ahora (upstream `repos-referencia/avatar`, paquete `packages/avatar`, vendorizada `apps/desktop/renderer/floating/vendor/avatar/`). **No se consolida** en esta ola. Se cierra solo: licencia, tests, docs, Script de sincronización.

## 2. Persona activa

Cada subagente **debe** leer su persona canónica antes de actuar y adoptarla:

| Agente | Persona a leer | Dominio |
|---|---|---|
| A1 | `.opencode/agents/ego-docs.md` | documentación canónica, ADRs, Backlog |
| A2 | `.opencode/agents/ego-worker.md` | núcleo cognitivo (`packages/*`) |
| A3 | `.opencode/agents/ego-worker.md` | capas de ejecución y producto (`packages/*`) |
| A4 | `.opencode/agents/ego-desktop.md` | `apps/desktop/**` |
| A5 | `.opencode/agents/ego-docs.md` | extracción de repos de referencia |
| A6 | `.opencode/agents/ego-worker.md` | subsistema avatar |
| A7 | `.opencode/agents/ego-harness.md` | CI/CD, calidad, seguridad, dependencias |
| A8 | `.opencode/agents/ego-arch.md` | contraste con el documento maestro (22 secciones) |

Complemento obligatorio: `.agents/references/definition-of-done.md` (DoD), `.agents/rules/` (reglas del repo),
`.agents/skills/documentation-skill/SKILL.md` (si tocas `docs/`).

## 3. Propiedad de ficheros (EXCLUSIVA)

| Agente | ESCRIBE (exclusivo) | PROHIBIDO escribir |
|---|---|---|
| **A1** | `docs/index.md`, `docs/adr/**`, `docs/roadmap/roadmap.md`, `docs/roadmap/Backlog.md`, `docs/PLAN-EGO.md`, `AGENTS.md`, `docs/engineering/stack-tecnico.md`, `docs/product/**` (salvo `mascota.md` y `character-art-direction.md`), `docs/architecture/**` (salvo `character-system.md`), `docs/getting-started.md`, `docs/user/**`, `docs/deployment/**`, `docs/operations/**`, `docs/testing/**`, `docs/design/**`, `docs/references/**`, `docs/changelog.md`, `docs/.vitepress/**` | `packages/**`, `apps/**`, `tests/**`, `.github/**`, `docs/extractions/**`, `docs/review/**`, `docs/research/**` |
| **A2** | `packages/memory/**`, `packages/knowledge/**`, `packages/runtime/**`, `packages/models/**`, `packages/decision/**`, `packages/execution/**`, `packages/events/**`, `packages/security/**`, `packages/tool-call-repair/**` | `apps/**`, `tests/gui/**`, `docs/**`, `.github/**`, `packages/{tools,subegos,tasks,domains,dailystate,recovery,ui-runtime,integrations,avatar}/**` |
| **A3** | `packages/tools/**`, `packages/subegos/**`, `packages/tasks/**`, `packages/domains/**`, `packages/dailystate/**`, `packages/recovery/**`, `packages/ui-runtime/**`, `packages/integrations/**` | `apps/**`, `docs/**`, `.github/**`, `packages/{memory,knowledge,runtime,models,decision,execution,events,security,tool-call-repair,avatar}/**` |
| **A4** | `apps/desktop/**` (EXCEPTO `apps/desktop/renderer/floating/vendor/avatar/**` → A6) | `packages/**`, `docs/**`, `.github/**`, `tests/**` |
| **A5** | `docs/extractions/**`, `docs/review/**`, `docs/research/coucou-deep-dive.md`, `docs/research/hermes-agent-deep-dive.md`, `docs/research/openclaw-deep-dive.md` | `packages/**`, `apps/**`, `tests/**`, `docs/{index.md,adr,roadmap,product,architecture,engineering,user,design,operations,deployment,testing,references}/**` |
| **A6** | `packages/avatar/**`, `apps/desktop/renderer/floating/vendor/avatar/**`, `docs/product/mascota.md`, `docs/product/character-art-direction.md`, `docs/architecture/character-system.md`, `docs/research/character-audit-and-coucou-inventory.md` | resto de `packages/**`, resto de `apps/desktop/**`, resto de `docs/**`, `tests/gui/**` |
| **A7** | `.github/workflows/**`, `package.json` (raíz), `.oxlintrc.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tests/gui/**`, `tests/e2e/**`, `scripts/**`, `.husky/**`, `.markdownlint.json`, `.github/dependabot.yml` | `packages/*/src/**`, `apps/desktop/src/**`, `apps/desktop/renderer/**`, `docs/**` |
| **A8** | `docs/research/arquitectura-master-matrix.md` (nuevo), `docs/research/Arquitectura y Diseño de Sistemas para Plataformas y Agentes de IA.md`, `Arquitectura y Diseño de Sistemas para Plataformas y Agentes de IA.md` (raíz → eliminar), `docs/agent-ops/plans/2026-10-19-remediation-wave1/**` | `packages/**`, `apps/**`, `tests/**`, resto de `docs/**` |

### 3.1 Reglas de desempate

1. **Un fichero, un dueño.** Si dos agentes lo necesitan, el que no lo tiene **no lo edita**: escribe una solicitud en su handoff (§4) y sigue con el resto.
2. **El orquestador (yo) aplica los handoffs** que cruzan propiedad, después de que la ola termine. No se edita nada fuera de la zona asignada "porque es rápido".
3. **`main.ts` es de A4 exclusivamente.** A2 y A3 necesitan cablear cosas ahí → lo describen en su handoff con el diff exacto; A4 lo aplica. Si A4 no puede, lo aplica el orquestador.
4. **`pnpm-lock.yaml` y las dependencias son de A7.** Cualquier agente que necesite una dependencia nueva la **solicita** en su handoff; no la instala. Excepción: puedes editar el `package.json` de TU zona, pero **nunca** `pnpm-lock.yaml` ni ejecutar `pnpm install` — anota la dependencia exacta (nombre + versión) en tu handoff y A7 la instala y cierra el lockfile. Si añades una dependencia que A7 no puede resolver sin red, **no la añadas**: reescribe el código para no necesitarla.
5. **`docs/roadmap/Backlog.md` es de A1.** A5 actualiza sus propios `docs/review/backlog-*.md`; A1 consolida el maestro. A1 puede leer los ficheros de A5, no escribirlos.
6. **No ejecutes `pnpm install` salvo que seas A7.** Reinstala dependencias en un monorepo mientras otros agentes trabajan puede corromper `node_modules` y romper sus tests.

## 4. Handoff (obligatorio)

Cada agente escribe `docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/<AGENTE>.md` con este formato:

```markdown
# Handoff <AGENTE> — <fecha>

## Cambios aplicados (ficheros propios)
- `ruta:línea` — qué y por qué

## Solicitudes fuera de zona (NO aplicadas)
| # | Fichero | Cambio pedido | Motivo | Bloqueante |
|---|---|---|---|---|

## Verificación
| Comando | Exit | Resumen |
|---|---|---|

## Deuda / no resuelto
- …
```

**Toda** solicitud fuera de zona debe incluir el diff o el pseudocódigo exacto, para que el orquestador pueda aplicarla sin volver a investigar.

## 5. Método obligatorio (TDD real)

1. **Test rojo primero.** Para cada corrección de comportamiento, escribe el test que falla con el código actual y **verifica que falla** (pega el output del fallo). Sin test rojo demostrado, la corrección no cuenta.
2. **Verificación por paquete** después de cada cambio: `pnpm --filter <paquete> test` y `pnpm --filter <paquete> typecheck`.
3. **DoD de `AGENTS.md` §4 + `.agents/references/definition-of-done.md`**: typecheck exit 0, tests sin regresiones, sin `any` injustificado, sin stubs ciegos, docs actualizadas si cambia una API/IPC pública.
4. **Registro de fricción VantaDB**: si tocas `packages/memory` y encuentras una deficiencia del motor, **obligatorio** registrarla en `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` con taxonomía `VDB-BUG/INC/REQ` y referenciar el ID en el código (`// Workaround: VDB-XXX-NN`). Un workaround silencioso hace que la tarea no sea aprobable.
5. **Nada de commits.** El orquestador commitea. working tree sucio es lo esperado.
6. **Nada de `git checkout`, `git reset`, `git stash`, `git clean` ni ninguna operación que toque el estado del repo.**

## 6. Utilidades disponibles

- **MCP `codebase-memory-mcp`**: proyecto `C-Users-Eros-VantaDB-Proyect-Ego` (33 516 nodos). `search_graph`, `trace_path`, `get_code_snippet`, `query_graph`, `check_index_coverage`. Úsalo para callers, blast radius y código muerto — **no** para leer lo que ya sabes leer con `grep`.
- **MCP `codegraph`**: NO disponible para Ego (no hay índice `.codegraph/`). No lo intentes.
- **MCP `playwright` / `chrome-devtools`**: para el renderer real y verificación visual (A4, A7).
- **Skills**: `test-driven-development`, `systematic-debugging`, `documentation-skill`, `documentation-and-adrs`, `security-and-hardening`, `observability-and-instrumentation`, `performance-optimization`, `code-review-and-quality`, `code-simplification`, `doubt-driven-development`, `ci-cd-and-automation`, `writing-guidelines`.
- **Dev-tools**: `.agents/dev-tools/verify.ps1` (fast gate), `floor-guard.ps1`, `check-agents-refs.ps1`, `sync-opencode-agents.ps1`.
- **Ejecución autorizada** (`AGENTS.md` §3): `pnpm install`, `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint` sin pedir confirmación.

## 7. Formato de salida (obligatorio)

Cada agente termina su turno con un bloque `RESULTADO`:

```
RESULTADO: {
  agente: A1-docs,
  status: COMPLETED | PARTIAL | FAILED,
  archivos_modificados: [rutas],
  hallazgos_resueltos: [EGO-FIND-xx, …],
  verify: { typecheck: "exit 0", tests: "N passed", lint: "exit 0" },
  solicitudes_handoff: [nº],
  deuda_abierta: [ … ],
  SKILLS_CARGADAS: [ … ]
}
```

`status: PARTIAL` es legítimo si bloqueaste por una dependencia externa: **dilo explícitamente con el bloqueo exacto**. No declares COMPLETED si algo no está verificado.

## 8. Orden de dentro de cada agente

1. Leer tu plan (`docs/agent-ops/plans/2026-10-19-remediation-wave1/<TU-PLAN>.md`).
2. Leer tu persona (`.opencode/agents/<persona>.md`).
3. Leer el informe fuente (`docs/agent-ops/reports/reviews/review-full-2026-10-19.md`) — sección de tu ámbito.
4. Leer la DoD (`.agents/references/definition-of-done.md`).
5. Ejecutar tu plan, TDD, verificación por paquete.
6. Escribir tu handoff.
7. Emitir `RESULTADO`.

## 9. Decisiones del owner (2026-10-19) — vinculantes

### D1 · Dependencias: subir Electron **y** transitivas, sin esperar verificación del binding
Actualiza `electron` a la rama estable soportada **y** `tinypool`, `node-tar`, `vite`, `vitest`, `electron-updater`, `extract-zip`. **No** apliques `pnpm.overrides` para congelar Electron.
**Mitigación obligatoria** (A7): el binding napi-rs real **existe en local** en `C:\Users\Eros\VantaDB Proyect\VantaDB\vantadb-node`. A7 debe ejecutar el smoke real (`apps/desktop/scripts/smoke-native-packaged.cjs`, carga del `.node` con `ELECTRON_RUN_AS_NODE` + `connect()` + roundtrip put/get) **contra el binding real en local** y reportar el resultado del ABI. Si el smoke local falla → **revierte el upgrade de Electron** y repórtalo. Si el smoke local pasa pero no se puede verificar en CI → **déjalo registrado como pendiente de verificación en CI** (Ola 2, ligado a DIST-09).

### D2 · Secret proxy: marcador + resolución en el cliente MCP
El subproceso MCP recibe `EGO_SECRET_<NOMBRE>={{SECRET:<clave>}}` en vez del valor real. El **cliente MCP** (en el proceso main, que sí tiene acceso al keychain vía `CredentialManager`) resuelve el marcador en la petición saliente. El servidor MCP **nunca ve el token**.
Excepción admitida y **registrada**: servidores que exigen el token en la env **al arrancar** (health-check) conservan la env real, pero quedan listados explícitamente en el handoff y en el informe.

### D3 · Select: migrar a Radix. Principio general
`@radix-ui/react-select` **debe** usarse: migra `Select.tsx` a Radix y elimina los 7 `<select>` nativos.
**Principio general del owner (aplica a todo el repo):** *los componentes de librerías y framework se utilizan siempre; no se recrean desde cero si ya existe una primitive de librería o del framework.* Aplica esto a las primitives del `ui-kit` cuando exista equivalente en Radix/React Aria; si mantienes un componente propio, debe justificarse por un motivo concreto (no por comodidad) y documentarse.

### D4 · Avatar: sustituir los puertos verbatim de Mochi por geometría propia
`packages/avatar/src/studio/render/{body,ears,eyes,mouth,accessories}.js` se reescriben con **geometría propia** que mantenga el comportamiento visual. Se elimina el preset `'coucou-mochi'` de `avatar-element.js:2052`. Las cabeceras de atribución se normalizan a `Adapted from <upstream> (MIT), <ruta>`.
**Validación**: capturas antes/después (`scripts/` o `vision-skills`) para comprobar que no hay regresión visual. Si un fichero no se puede sustituir sin regresión → **hándalo con el diff propuesto y la captura**, no lo abandones en silencio.

### D5 · Avatar: mantener las tres copias
`repos-referencia/avatar` (upstream) · `packages/avatar` (paquete) · `apps/desktop/renderer/floating/vendor/avatar/` (vendorizada). **No se consolidan en esta ola.** Lo que sí se cierra: licencia MIT, 265 tests portados, `build`/`typecheck` reales, docs canónicos reescritos y un **script de sincronización verificable por SHA-256** que falle si divergen.

### D6 · Alcance de la ola
Ola 1 (esta) = Bloques **0 + A + B + C + D**. Bloque **E** (motor y deuda P2: embeddings reales, RRF, `cache_control` ya está en A2, MCP server ya está en A3, descomposición restante de `main.ts`, OKLCH completo, CRDT, exportadores, voz, daemon) = **Ola 2**, planificada por A8 en `VERDICT.md`.
