# FIND-12-01 — Avatar inerte: vendorizar motor `<ego-avatar>` bajo el root servido

> Plan: `docs/agent-ops/plans/2026-10-15-isla-flotante-ego-completa.md` · Worker exclusivo avatar-load (DISJUNTO de FIND-12-02-mount: este worker SOLO specifier+vendor; `floating.tsx` y views-glue son del otro worker — NO tocar).
> Evidencia origen: E2E-GUI-FULL — `<ego-avatar>` inerte 0x0, `floating-avatar.tsx:31` apunta fuera del root, 404 `.../repos-referencia/avatar/src/index.js?import`, `AVATAR-DIAG registered:false` 6/6.

## Contrato

(a) Vendorizar BAJO `apps/desktop/renderer/floating/vendor/avatar/` SOLO los módulos estrictamente necesarios para `<ego-avatar>` + `createSoundEngine` (cadena de imports demostrada en DISCOVERY, ni un archivo de más).
(b) Reescribir imports de `floating-avatar.tsx` y `floating-sound.ts` al vendor local (rutas relativas, sin salir del root servido; sin `@vite-ignore` para que el bundler los emita en dev Y prod `out/renderer/floating/`).
(c) Nota de atribución MIT en `vendor/README.md` (5 líneas: autoría Louis Raillart donde corresponda + `repos-referencia/avatar` propio; copyright citado).
(d) Verificación browser REAL con dev-server vivo: `/floating/floating.html` 200, 0 404 de avatar, `<ego-avatar>` tamaño >0, `customElements.get('ego-avatar')` definido.
Acceptance: 0 404 avatar + avatar visible + suites unitarias verdes + tsc 0.

## Spec (por evidencia — Spec = evidencia)

| Ítem | Decisión por evidencia |
|---|---|
| Root servido | `electron.vite.config.ts:31` → `root = apps/desktop/renderer`. Todo `../` que salga de `renderer/` es 404 en browser. |
| Specifier roto avatar | `floating-avatar.tsx:31` = `../../repos-referencia/avatar/src/index.js` → desde `renderer/floating/` sube a `apps/desktop/repos-referencia/...` (inexistente; el repo real está 3 niveles más arriba). Fuera del root en dev y prod. |
| Specifier roto sonido | `floating-sound.ts:364` = `../../../repos-referencia/avatar/src/runtime/sound.js` → sube a `apps/repos-referencia/...` (inexistente). Mismo 404. |
| Entry a vendorizar | `runtime/avatar-element.js` directo (NO el barrel `index.js`: el barrel re-exporta `render/static|projection|body`, `studio/adapter` público y `version` — peso muerto; el elemento se auto-registra al importarse `avatar-element.js:2266-2268`). |
| Cadena mínima (27 .js) | `avatar-element.js:17-90` importa: `core/{genome,palette,prng,morph,anim,config,timeline}` (7) + `render/shell` (+ transitivos `render/{builder,body,eyes,parts,ara-head}` — `shell:7-10`, `eyes:8-11`, `body:9-11`, `parts:3-4`) (6) + `runtime/{states,poses,pointer,fx-eyes,micro,sound,policy,presence,extension-host}` (9, todos sin imports salvo `poses|pointer→morph`, `fx-eyes→morph|timeline`, `micro→anim` — grep verificado) + `studio/{element-host,adapter,config,sound}` (4: `element-host` es import ESTÁTICO de `avatar-element.js:90`; `adapter:5-6` → `studio/sound` + `runtime/micro`; `config` y `studio/sound` sin imports). El `import('./index.js')` dinámico de `element-host.js:84` solo dispara en `mode="studio"` (flotante usa SVG por defecto) → `studio/index.js` + motor canvas NO se vendorizan. `src/studio/` salvo esa cadena: NO. `demo/`, `captures/`, `vendor/`, `render/static|projection`, `version.js`: NO. |
| Atribución | `repos-referencia/avatar/LICENSE.md:48` → `src/runtime/sound.js` MIT © Louis Raillart; `LICENSE.md:30,35-36` → `core/anim`, `core/timeline`, `runtime/presence`, `runtime/micro` MIT © Louis Raillart; resto síntesis Ego/CX ArtLab según tabla. `vendor/README.md` cita copyright + fuente + commit/fuente fija. |
| Sin decisiones abiertas | Mecanismo copiar+reespecificar. Si DISCOVERY hubiera exigido medio repo → BLOQUEO (no ocurrió: 27 archivos, 0 studio pesado). |

## Impacto mapeado (Regla 0)

- **Archivos leídos completos**: `floating/floating-avatar.tsx` (78L), `floating/floating-sound.ts` (390L), `floating/floating.html` (37L), `floating/floating.tsx` (108L, SOLO LECTURA — worker paralelo), `floating/avatar-bridge.ts` (95L), `repos-referencia/avatar/src/index.js` (184L), `repos-referencia/avatar/src/runtime/avatar-element.js` (import block + `customElements.define:2266-2268`), `repos-referencia/avatar/src/runtime/sound.js` (1-80), `repos-referencia/avatar/src/studio/element-host.js` (395L), `studio/adapter.js` (1-60), `studio/config.js` (1-40), `studio/sound.js` (1-30), `LICENSE`, `LICENSE.md` (1-85), `electron.vite.config.ts` (73L), `renderer/package.json`, `renderer/tsconfig.json`, `renderer/test/floating-avatar.test.tsx` (84L), `renderer/test/floating-sound.test.ts` (1-60).
- **Referencias hacia dentro** (lo que el cambio consume): cadena de imports §Spec (27 .js); `LICENSE.md` tabla de atribución; `electron.vite.config.ts:31,44-46` (root + MPA floating).
- **Referencias entrantes** (quién consume lo que toco): `floating.tsx:3` importa `FloatingAvatar` (NO se edita `floating.tsx`); tests `floating-avatar.test.tsx` + `floating-sound.test.ts` importan `../floating/*` (paths estables, sin ajuste necesario); NADIE más importa `AVATAR_ELEMENT_SPEC`/`AVATAR_SOUND_SPEC` (grep: solo sus propios archivos).
- **Veredicto**: impacto SOLO carga del avatar (specifier + 27 copias fieles + README + 1 test nuevo). Riesgo: divergencia vendor-vs-referencia → mitigado con README que fija fuente (`repos-referencia/avatar`, motor `src/` — NO `src/studio/` pesado) + test anti-regresión que falla si el specifier vuelve a salir del root (`repos-referencia` en specifiers) o si falta el entry vendorizado.

## Steps

- [x] S1 DISCOVERY: cadena de imports + root servido + veredicto (este file).
- [x] S2 Vendor: 27 .js fieles byte-idénticos a `floating/vendor/avatar/` (estructura relativa intacta) + 1 shim `studio/index.js` (stubs que lanzan; el transform de Vite exige que TODO import literal resuelva — sin él, 500 en dev y fallo de build) + 2 `.d.ts` mínimos (tsc analiza los literales) = 31 archivos, 0 binarios.
- [x] S3 `vendor/README.md` (atribución MIT + fuente fija + shim documentado).
- [x] S4 Reespecificar imports (SOLO specifier, LITERALES — `import(CONST)` no lo analiza Vite y queda suelto en prod): elemento + sonido → `./vendor/avatar/...`. RED previo: 404 por config+specifier; intermedio: 500 por `studio/index.js` ausente → GREEN con shim.
- [x] S5 Test anti-regresión `renderer/test/floating-avatar-vendor.test.ts` (imports dinámicos dentro del root + entries + shim existen).
- [x] S6 Suites: 3 files 20/20 ✅ + `tsc --noEmit` renderer 0 ✅ + suite renderer COMPLETA 48 files 335/335 ✅ + `pnpm --filter @ego/desktop build` (tsc + electron-vite + verify-dist) ✅ con chunk `assets/avatar-element-*.js` emitido en `out/renderer/`.
- [x] S7 Browser REAL (Chrome headless + CDP, dev-server 5173 propio): `customElements.get('ego-avatar')`=function, 1 elemento 120×120, shadowRoot con `<svg>` (52 nodos, `.badge`), `state=idle`, 0 requests fallidas avatar (solo favicon.ico, irrelevante). Servidor matado (PID verificado vite), puerto 5173 libre, CDP muerto, browser del usuario intacto.
- [x] S8 Cierre: DoD 7 + Review Fast + RESULTADO §7. NO commit (orquestador), NUNCA push.

## DoD 7

- [x] tsc 0 (`@ego/renderer` + build desktop incluye `tsc -p tsconfig.json --noEmit` ✅).
- [x] unit PASS (20/20 scope + 335/335 renderer, sin regresiones; `floating-mount.test.tsx` del worker paralelo también verde — sin interferencia).
- [x] browser 0-404 avatar + avatar 120×120 con SVG (evidencia CDP arriba).
- [x] cero regresiones (suite completa verde; `floating.tsx` del worker paralelo NO tocado — diff confirma).
- [x] atribución escrita (`vendor/README.md`: MIT Louis Raillart + CX ArtLab/Ego + fuente `repos-referencia/avatar`).
- [x] sin secretos/binarios (31 archivos texto: 28 .js + 2 .d.ts + 1 .md; `git status` limpio de binarios).
- [x] n/a VantaDB (renderer presentation-only, sin memoria).

## Review (Fast, scoped)

Veredicto: **approve**. Mecánica propia del ownership: tsc 0 + 335/335 + build+verify-dist verdes + probe browser verde + diffs solo-specifier. No se corre `verify.ps1` repo-wide: hay workers paralelos con el árbol en vuelo (`floating.tsx` +439 de FIND-12-02) fuera de este ownership; el gate repo-wide lo corre el orquestador al integrar. Reviewer: worker FIND-12-01 (self-review mecánico con evidencia ejecutada, no auto-reporte).

## Gates

P:no (sin pregunta; Spec=cero decisiones abiertas confirmado por DISCOVERY) D:no (sin desvío de contrato; vendor mínimo + shim documentado) V:no (verify pasó a la 2ª: literal+d.ts tras warning de análisis) C:no (sin colaterales; `floating.tsx` ajeno intacto)

## SDP

`SDP: systematic-debugging (bug, cadena causal 404), test-driven-development (RED 404 → GREEN vendor), campaign-executor + progreso (base)`
