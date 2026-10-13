# SEC-08 — Suite penetración e inyección

> Contrato: `tests/security/injection-boundaries.test.ts` creado (hoy inexistente) y en verde.
> Docs: `docs/testing/estrategia.md` (cita verificada 2026-10-13: Fase 11
> Seguridad = "IPC estricto, sandbox, auditoría inmutable en `gov/audit`,
> gestión cifrada de secretos y límites de ejecución"; gate Aislamiento:
> "Cero fugas de información entre espacios privados" en pruebas de
> penetración; suite MCP 8/8 §"Pruebas de Integración MCP").

## Compuertas / ADR

- N/A nuevas (plan §Task 8).
- Base citada como verificada: SEC-01..SEC-05 (sandbox/CSP, IPC Zod,
  CredentialManager, SecretsFilter, ToolPermissions) + SEC-06/SEC-07.
- Referencias leídas: `.agents/references/testing-patterns.md`
  (AAA, naming `[unidad] [conducta] [condición]`, anti-patterns),
  `.agents/references/definition-of-done.md` (Correctness: test que falla
  sin el cambio y pasa con él; sin regresiones),
  `.agents/references/security-checklist.md` (threat modeling STRIDE,
  AI/LLM Security: output como untrusted, permisos en código no en el
  prompt, LLM01/LLM02/LLM05/LLM06/LLM10; OWASP Top 10: inyección, SSRF).

## Implementación (solo esto; prohibidos datos reales, `src/`, `.agents/**`)

- [x] `tests/security/injection-boundaries.test.ts` (nuevo, 29 tests,
      ~650ms): importa desde FUENTE (`packages/*/src/*.js`, no `dist/`),
      cero dependencias nuevas en `@ego/e2e-tests` (el script existente
      `vitest run` ya cubre el nuevo directorio; `tests/package.json`
      intacto). Solo canarios `sk-test-*` y tokens inventados.
  - A (5): prompt injection = datos, nunca permiso. Terminal nunca escala
    a `allow` ante 8 payloads (LLM01); destructivo+inyección → deny
    `blocked_command`; MCP no allowlistado → deny; canario en prosa de
    inyección → `scanEgoPut` bloquea+redacta; cero eco en errores/razones.
  - B (5): traversal `../`, absoluto externo, `%2e`, doble-codificado
    `%252e`, null byte, UNC → deny; reservadas → deny; interior → allow;
    canónico `PathValidator` (traversal/reservadas lanzan, interior
    resuelve); symlink/junction externa → lanza (`ctx.skip()` honesto sin
    privilegio de symlink, no falso verde).
  - C (6): `process`/`require`/`module` undefined; console neutralizada;
    `allowedTools` fail-closed sin despachar; cuota `maxToolCalls` aborta
    al 3er call (2 registrados); `while(true){}` muere por timeout
    acotado; **tripwire `it.fails` VULN-SEC-08-01** (ver Hallazgo).
  - D (7): lectura fuera de scope → deny; sin workspace → deny;
    sensibles (`.ego/`, `gov/`, `quarantine/`, credenciales) → approval;
    desconocido → deny; MCP (deny/approval/allow); anti-SSRF (9 URLs
    bloqueadas incl. `file://`, pública `https` permitida); McpClient H31
    (comando no allowlistado y `shell:true` rechazan sin spawnear;
    sin `trustLevel` → no firmado).
  - E (4): base64 a un nivel → `base64_wrapped_secret`; `scanEgoPut`
    barre payload+metadata sin mutar; redacción global+idempotente;
    `maxInputChars` trunca y lo declara (límite honesto: lo que excede
    el cap NO se escanea — trade-off anti-DoS declarado).
  - F (2): puerta de regresión (las 4 suites unitarias SEC-03/04/05/07
    existen; estrategia cita Fase 11 + sandbox).

## Hallazgo crítico (regla del owner: BLOQUEO + FIX_PROPUESTO, no aplicar)

- **VULN-SEC-08-01 (BLOQUEO, real, probada):** `this.constructor.constructor(
  "return typeof process")()` ejecutado vía `ZeroContextKernel.executeScript`
  retorna el objeto `process` del host con `success=true` (verificado
  2026-10-13 contra la clase real: probe `kernel-probe.mjs` + test C).
  `node:vm` NO es frontera de seguridad (docs Node): un script generado
  por modelo (untrusted, LLM01) con inyección puede alcanzar `process.env`
  (secretos) y `require` (RCE). Lo documentado como bloqueado (process/
  require directos undefined) es solo ofuscación, no contención.
- **FIX_PROPUESTO (preguntar, no aplicar):** aislar la ejecución fuera del
  main process (worker dedicado con IPC + allowlist serializable, o motor
  sin acceso al host), y/o congelar intrínsecos antes de `createContext`
  (`Object.freeze` + eliminar `constructor` de la cadena visible) con test
  de escape como gate; nunca pasar secretos por `process.env` del main
  (ya cubierto por SEC-03/SEC-04). Requiere decisión del owner: toca
  `packages/execution/src/ZeroContextKernel.ts` (fuera de alcance SEC-08).
- Tripwire: `it.fails` en suite C — verde hoy, rojo-forzoso cuando el fix
  aterrice (vitest falla en "expected failure but passed"); convertir a
  assertion normal entonces. No se explotó más allá del `typeof`.

## Límites honestos (no se promete)

- Aislamiento de namespaces `egos/<id>/*` (gate Aislamiento estrategia):
  fuera de alcance — las 5 defensas listadas no incluyen ACL de namespaces;
  notar para futura task, no afirmar cobertura.
- `vm` timeout/cuota = límites de consumo (LLM10), no contención (ver hallazgo).
- `maxInputChars`: secretos más allá del cap no se escanean (flag obliga a decidir).

## Verify (§6 plan + comandos exactos task)

- `pnpm --filter @ego/e2e-tests exec vitest run security/injection-boundaries.test.ts` → PASS (29/29: 28 + 1 `it.fails` tripwire)
- `pnpm test:e2e` (runner de `tests/`, F6T12 `@ego/e2e-tests`) → PASS sin regresión (8 files / 43 tests: 14 previos + 29 nuevos)
- Sin commit (ego-chaos + lente ego-audit; solo esta task).

## Rollback

Un archivo nuevo + este taskfile. Revert por borrado
(`tests/security/injection-boundaries.test.ts`, `docs/agent-ops/tasks/SEC-08.md`).
`tests/package.json` intacto. Cero cambios en `src/`, comportamiento inalterado.

## Registro de Cumplimiento (2026-10-13)
- **Estado:** ⏳ EN PROGRESO
- **Timestamp:** 2026-10-13T07:33:15.752Z
- **Evidencia:** Suite 29/29 con tripwire VULN-SEC-08-01. Owner aprobó aislamiento total.
- **Commit:** Transacción local