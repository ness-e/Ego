# Quickstart — Ego Desktop

> Estado: beta **unsigned** (DIST-04 firma bloqueada por owner). Los instaladores
> muestran avisos SmartScreen/Gatekeeper esperables; verificar siempre el hash
> con `SHASUMS.txt` (`docs/deployment/distribution.md` §6).

## Requisitos

- Node.js ≥ 22, pnpm ≥ 9.

## Correr en 5 pasos

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @ego/desktop dist   # artefactos en release/
node scripts/generate-checksums.cjs release   # SHASUMS.txt junto a artefactos
```

## Vistas

- Shell: ![shell](/screenshots/shell.svg)
- Chat: ![chat](/screenshots/chat.svg)
- Canvas: ![canvas](/screenshots/canvas.svg)

> Placeholders SVG hasta captura real con display (CFG-14). Secuencia
> quickstart: `public/quickstart/frame-01.png` → `frame-04.png`
> (placeholder; GIF real pendiente de captura).

## Docs como sitio

```bash
npx vitepress dev docs     # preview local
npx vitepress build docs   # build estático
```

Config: `docs/.vitepress/config.mts` (nav + sidebar + búsqueda local).
