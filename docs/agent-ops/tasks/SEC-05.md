# SEC-05 — Matriz de permisos de herramientas y Sandbox

| Campo | Valor |
|---|---|
| ID | SEC-05 |
| Plan | `docs/agent-ops/plans/2026-10-12-plan-backlog-10.md` Task 5 |
| Estado | COMPLETED (matriz + tests + barrel; wiring al runtime reservado a ACT/execution, fuera de alcance) |
| Worker | ego-worker (solo esta task; sin commit, sin push) |
| Fecha | 2026-10-13 |
| Divergencia de ruta | Plan cita `packages/security/ToolPermissions.ts`; el real es `packages/security/src/ToolPermissions.ts` (scope validator, igual que SEC-03/SEC-04). Se usa el real. |

## Spec (contrato)

Paths fuera del workspace denegados + comandos prohibidos bloqueados + tests.

## Impacto Regla 0

Matriz pura y sin dependencias en `@ego/security` (main process). Cero cambios en `renderer/**`, `.agents/**`, motores de tools y VantaDB. No se toca `packages/tools` ni runtime/execution: el wiring (`evaluateToolCall` como policy hook previo a `execute`) pertenece a Fase 02 (ACT/execution), fuera del contrato SEC-05; aquí queda el hook testeable + spec de wiring (§Hallazgos). Sin lógica de negocio nueva fuera del paquete de seguridad.

## Threat model (5 min, security-and-hardening)

- **Fronteras:** (1) args de path (fs/git/cwd) → filesystem; (2) `command` (terminal) → shell; (3) `url` (web) → red; (4) `mcpServerId` → superficie de terceros.
- **Activos:** filesystem del usuario fuera del workspace, integridad del SO (rutas reservadas), red interna/metadata cloud, perímetro MCP.
- **STRIDE:** Elevación (escape de sandbox vía traversal/codificado) = riesgo principal; Manipulación (comandos destructivos/ofuscados); Divulgación (SSRF a metadata/internal); DoS (regex sobre comandos gigantes — patrones sin backtracking anidado; entradas acotadas por los schemas Zod de cada tool).
- **Abuso:** "`../../etc/passwd` en fs_read_file" → deny `path_outside_workspace`; "`powershell -EncodedCommand …`" → deny `blocked_command`; "`http://169.254.169.254/` en web_fetch" → deny `unsafe_url`; "registro un servidor MCP maligno" → deny `mcp_not_allowlisted`.

## Steps

- [x] DISCOVERY: `packages/tools/src/native/{fs/PathValidator,terminal/NativeTerminalTool,security/{ResourcePolicy,NetPolicy}}`, `ToolRegistry.resolveApprovalRequirement` (HITL), `src/index.ts`, compuertas CARP-03/HERM-19/COUC-10
- [x] Compuertas CARP-03 + HERM-19 + COUC-10 (Opción B): veredictos abajo
- [x] TDD RED: `test/ToolPermissions.test.ts` falla sin el módulo (Failed to load url) → GREEN con `src/ToolPermissions.ts`
- [x] Barrel `src/index.ts` + cobertura de exportación en `test/package-index.test.ts`
- [x] Verify §6: `pnpm --filter @ego/security test` PASS (4 files, 63/63) + `pnpm --filter @ego/security typecheck` exit 0
- [x] Revisión adversarial (doubt-driven, modo degradado anunciado): traversal/comandos/red abajo

## Compuertas — veredictos

- **CARP-03 (validación estricta de cobertura de rutas, `docs/review/backlog-career-ops.md:36`): ✅ Completada — REUTILIZADA.** El enforcement canónico (fs real + symlinks) sigue en `PathValidator.validatePath`; SEC-05 aporta la réplica LÉXICA (sin fs: normalización de `\`, decodificación `%2e/%2f` a dos niveles, byte nulo, reserva de sistema, contención `..`) para el veredicto previo en la matriz. Sin duplicar el motor: la matriz decide, el nativo ejecuta.
- **HERM-19 (auditoría AST / linter de skills, `docs/review/backlog-hermes.md:54`): ✅ Completada — ADAPTADA.** El patrón (inspeccionar antes de registrar/ejecutar) se adapta como gate previo a la ejecución: `evaluateToolCall` es el "lint" de cada invocación (herramienta desconocida/categoría desconocida → deny fail-closed). Sin AST: las tools de Ego son TS estático, no código generado dinámico; el chequeo de permiso en el despacho es el equivalente honesto.
- **COUC-10 (mutación segura de configuración, `docs/review/backlog-coucou.md:46`): ✅ Completada — ASIMILADA.** La matriz alimenta el pipeline de 12 pasos sin duplicarlo: paths sensibles (`.ego/`, `gov/`, `quarantine/`, `*.key/*.pem`, `credentials`, `secrets`) devuelven `requireApproval`, veredicto que el flujo HITL existente (`resolveApprovalRequirement` + `SafeConfigMutation`) ya consume. Backup/diff/fingerprint/atómica siguen en execution/tools.
- Ninguna compuerta exige decisión de producto → sin BLOQUEO.

## Hallazgos (cambios)

1. **NUEVO `packages/security/src/ToolPermissions.ts`** (~330 líneas, cero deps): `evaluateToolCall` (orden fail-closed: herramienta → comando → path → red → MCP → matriz categoría/riesgo), 16 patrones de comandos bloqueados (superconjunto de los 6 de `NativeTerminalTool` + ofuscación/persistencia/apagado), réplica léxica de reserva de sistema y anti-SSRF (sin DNS), allowlist MCP vía opciones, `isDenied/needsApproval`, `DEFAULT_ALLOWED_MCP_SERVERS`. Cero eco (reglas, nunca comandos/URLs).
2. **EDIT `packages/security/src/index.ts`**: exporta la matriz + tipos (`ToolDecision`, `ToolDecisionResult`, `ToolCallRequest`, `ToolPermissionsOptions`, `ToolRiskLevelLike`, `ToolOriginLike`).
3. **EDIT `packages/security/test/package-index.test.ts`**: test de exportación SEC-05.
4. **NUEVO `packages/security/test/ToolPermissions.test.ts`**: 29 tests (8 sandbox paths, 8 comandos, 6 red, 6 matriz, 1 helpers + riesgo desconocido).
5. **NO tocado `packages/tools` ni runtime/execution** (decisión consciente): añadir el hook previo a `execute` es wiring con implicaciones de flujo HITL, contrato de Fase 02. Spec de wiring: en cada `create*Tool().execute` (o en un wrapper del `ExecutionManager`), antes de validar el workspace, `const v = evaluateToolCall({toolName, category, riskLevel, origin, mcpServerId, path: input.path ?? input.cwd, command: input.command, url: input.url, workspacePath: context.workspacePath}, {workspacePath: defaultWorkspacePath, allowedMcpServers: F1T2_ALLOWLIST})`; si `isDenied(v)` → lanzar `Error([ToolPermissions] ${v.rule})`; si `needsApproval(v)` → enrutar a aprobación HITL existente.

## Adversarial (doubt-driven, modo degradado: sin subagente anidado, auto-revisión explícita)

1. **Traversal 1/3 — `a/../../x`, `%2e%2e/`, `C:\Windows\…`, byte nulo, sin workspace:** DENEGADOS (contención léxica con profundidad, doble-decodificación acotada, reserva insensible a caso, `missing_workspace` fail-closed).
2. **Comandos 2/3 — `rm -rf /`, fork bomb, `format C:`, `-EncodedCommand`, `IEX(…)`, `schtasks`:** DENEGADOS; `pnpm test` benigno → `requireApproval` (terminal siempre HITL); `reason` no filtra el comando (verificado con canario).
3. **Red 3/3 — `file://`, metadata `169.254.169.254`, `localhost`/`127.0.0.1`, `192.168.x.x`:** DENEGADOS; `https://example.com` → allow.
- **Endurecimiento aplicado:** `riskLevel` desconocido (string fuera del trío, p. ej. desde tool custom mal tipada) → `requireApproval` (`unknown_risk`) en vez de caer a `default_allow`.
- **Limitaciones honestas:** sin resolución de symlinks (requiere fs; enforcement en `PathValidator`); sin DNS (rebinding TOCTOU; `NetPolicy` + candidato a SEC-08 chaos); la matriz no sustituye al enforcement en los nativos, solo lo anticipa como veredicto.
- **Trade-offs aceptados:** MCP sin allowlist configurada → `requireApproval` (no deny) para no romper dev sin F1T2 cableado; en producción la allowlist F1T2 convierte esto en deny para no-listados. `system` sin riesgo destructivo → approval (no deny) porque hay tools legítimas de inspección futura.

## FIX_PROPUESTO (regla del owner — NO aplicado)

- Ninguno. El wiring a `packages/tools` + execution se documenta como spec (§Hallazgos.5) para Fase 02 en vez de `FIX_PROPUESTO` porque es trabajo planificado explícitamente fuera del contrato, no un bug hallado.

## Verify

- `pnpm --filter @ego/security test` → PASS (4 files, 63/63: 20 CredentialManager + 11 SecretsFilter + 29 ToolPermissions + 3 index).
- `pnpm --filter @ego/security typecheck` → exit 0 (strict, sin `any`).
- Sin secretos en código/tests (ningún comando/URL real sensible; solo fixtures sintéticas).
- Sin commit, sin push (worker).

## Referencias

- `AGENTS.md` §Seguridad (acciones sensibles requieren aprobación); `.agents/rules/gobernanza-desktop.md` (aprobación explícita + kill switch); `.agents/references/definition-of-done.md`; `.agents/references/security-checklist.md` (autorización por recurso, allowlists sobre denylists, SSRF); `docs/product/principios-innegociables.md` §6 (cita verificada: "Gobernanza, permisos y aprobación de acciones sensibles: Controles estrictos para cualquier acción destructiva, irreversible o de alto impacto." — línea 19); plan Task 5; `docs/agent-ops/tasks/SEC-04.md` (patrón taskfile + fail-closed + cero eco).
