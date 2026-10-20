# ADR 0001: Electron + Vite como shell desktop #

> **SUPERSEDED by T11 (`fa58b8c`) — `electron-vite` 5.x es canónico.**
> La decisión original (líneas 17-24, "No se adopta `electron-vite`")
> quedó obsoleta tras la migración T11. Se conserva intacta abajo por
> historia append-only; ver § `Supersede (T11)` al final.
> Verdad actual: `AGENTS.md` §1, `docs/engineering/stack-tecnico.md:17`,
> `apps/desktop/package.json:45` (`electron-vite ^5.0.0`),
> `apps/desktop/electron.vite.config.ts:1-68`.

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-15 |
| Estado | Superseded por T11 (`fa58b8c`) — `electron-vite` 5.x es canónico |
| Nivel jerárquico | 10.Implementation (`docs/jerarquia-canonica.md`) |

## Contexto ##

Ego es una aplicación desktop (Sistema Operativo Cognitivo) que necesita
ventana nativa, proceso principal con acceso a Node y un renderer web
moderno con React 19 y TypeScript estricto.

## Decisión ##

Usar **Electron 33 + `electron-builder`** con pipeline real doble:

- `tsc` compila el proceso principal (`apps/desktop`).
- `vite build` compila el renderer (`@ego/renderer`).

No se usa Next.js en desktop (reservado a Ego Web: landing/auth/billing).
No se adopta `electron-vite` como dependencia (mención aspiracional
descartada; ver `AGENTS.md` §1).

## Consecuencias ##

- Positivas: empaquetado probado (NSIS/DMG/AppImage), toolchain estándar
  (`pnpm build`, `pnpm typecheck`), separación clara main/renderer.
- Negativas: dos pipelines que mantener; el upgrade de Electron exige
  re-verificar el binario napi-rs de VantaDB y el empaquetado.
- Riesgos: derivar hacia un framework web SSR rompería el modelo
  local-first; bloqueado por guardrail.

## Supersede (T11) — append-only, no reescribe historia ##

- **Fecha supersede:** 2026-10-16 (tarea STAB-01).
- **Decisión que supersede:** T11 `fa58b8c` — migración a `electron-vite` 5.x
  (loop unificado `electron-vite build/dev`, layout `out/main` +
  `out/preload` + `out/renderer`, smoke nativo re-verificado).
- **Alcance del supersede:** solo las líneas 23-24 ("No se adopta
  `electron-vite`…") quedan obsoletas. El resto (Electron 33 +
  `electron-builder`, NO Next.js en desktop, consecuencias, riesgos)
  sigue vigente.
- **Evidencia código:** `apps/desktop/package.json:45`
  (`"electron-vite": "^5.0.0"`), scripts `build`/`dev` vía `electron-vite`,
  `apps/desktop/electron.vite.config.ts:1-68`, `AGENTS.md` §1,
  `docs/engineering/stack-tecnico.md:17`, `README.md:51`.
- **Reversión:** solo vía nuevo ADR que supersedee a T11 (nunca editando
  este archivo más allá de añadir notas).

## Referencias ##

- `AGENTS.md` §1 (stack), §4 (guardrails: NO Next.js).
- `docs/roadmap/Backlog.md` — Fase 12 (Distribution: installer, firma,
  auto-update).
- `docs/engineering/stack-tecnico.md`.
