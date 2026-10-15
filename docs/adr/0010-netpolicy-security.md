# ADR 0010: Frontera SSRF en @ego/security (paridad con NetPolicy) #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-16 |
| Estado | Aceptado |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |

## Contexto ##

El `NetPolicy` canónico anti-SSRF (OCLW-09, patrón openclaw) vive en
`@ego/tools` (`packages/tools/src/native/security/NetPolicy.ts`) y bloquea
loopback, RFC1918, link-local 169.254/16 y metadata cloud. El contrato
STAB-14 exige la frontera en `packages/security` (paquete que gobierna
`evaluateToolCall`/permisos STAB-02). Añadir dependencia `security → tools`
crearía acoplamiento inverso y riesgo de ciclo.

## Decisión ##

`packages/security/src/netPolicy.ts` standalone (cero deps nuevas), paridad
de vectores con el canónico:

- Bloquea: `localhost/127/8/0/8`, RFC1918 (`10/8`, `172.16/12`, `192.168/16`),
  `169.254/16`, CGNAT `100.64/10`, multicast/reservado `224+/4`, IPv6
  (`::1`, `fe80/10`, `fc00/7`), hosts metadata
  (`metadata.google.internal`, `169.254.169.254`, `100.100.100.200`),
  sufijos `.localhost/.local/.internal`; además rechaza protocolo no
  http/https, credenciales embebidas y URL malformada.
- `allowLocalhost` opt-in explícito solo para `localhost/127.0.0.1`
  (nunca abre RFC1918).
- Divergencia futura entre ambas implementaciones = bug (los tests pinean
  los mismos vectores; extracción a paquete compartido queda como follow-up
  si el drift aparece).

## Consecuencias ##

- Positivas: skill `security-and-hardening` aplicada (SSRF allowlist +
  validación en frontera); 6 tests (`netPolicy.test.ts`), suite security
  95/95; `ResourcePolicy` (URLs web) y `netPolicy` (IPs/hosts) no se pisan:
  el primero gobierna esquema web, el segundo red interna.
- Negativas: duplicación lógica contenida (~100 líneas) hasta extracción
  compartida; doble mantenimiento temporal.
- Riesgos: sin resolución DNS + pin de IP persiste el gap TOCTOU clásico
  (documentado en la skill); para superficies de alto riesgo, resolver una
  vez y conectar a IP pineada o filtrar vía agent (fuera de alcance STAB-14).

## Referencias ##

- `packages/security/src/netPolicy.ts`, `packages/security/test/netPolicy.test.ts`.
- `packages/tools/src/native/security/NetPolicy.ts:15-67` (canónico OCLW-09).
- `docs/agent-ops/tasks/STAB-14.md` (Spec SDD, Gate D-4).
