/**
 * NetPolicy — re-export de la política de red anti-SSRF **canónica** de Ego.
 *
 * UNIFICACIÓN (R4 / OCLW-09 / A5-S5 — Ola 1b, T2)
 * ------------------------------------------------
 * Antes de la Ola 1b había **tres** políticas de red divergentes en el repo:
 *
 * 1. `packages/tools/src/native/security/NetPolicy.ts` (este fichero) — la
 *    única con resolución DNS, pero duplicaba la lógica.
 * 2. `packages/security/src/netPolicy.ts` — superficie standalone sin DNS.
 * 3. `packages/security/src/ToolPermissions.ts` — la "réplica léxica"
 *    (comparaba sólo la cadena del host, sin resolver DNS).
 *
 * A2 cerró la 2 y la 3 y creó la canónica:
 * **`packages/security/src/ssrfPolicy.ts`** (en `@ego/security`).
 *
 * Este módulo pasa a ser un **reexport**: una sola implementación de la
 * frontera de red en todo el repo. Dos políticas con la misma semántica son
 * dos fronteras de seguridad, y la que se usa puede no ver lo que la otra
 * bloquea.
 *
 * DIRECCIÓN DE LA DEPENDENCIA
 * ---------------------------
 * `@ego/security` es una **hoja** (0 dependencias `@ego/*`): nunca puede
 * entrar en ciclo. La dirección segura es `tools → security` (las
 * herramientas dependen de las primitivas de seguridad; al revés no).
 *
 * La semántica es la de la canónica (mismos vectores bloqueados, mismo orden
 * de decisiones) MÁS el veto de credenciales embebidas en la URL, que la
 * copia de este paquete no tenía.
 *
 * Handoff A3 → A7: `packages/tools/package.json` declara
 * `"@ego/security": "workspace:*"`; hace falta `pnpm install` para materializar
 * el enlace de workspace y actualizar `pnpm-lock.yaml`.
 */

export {
  NetPolicy,
  type NetPolicyOptions,
  type NetPolicyDnsOptions,
} from "@ego/security";
