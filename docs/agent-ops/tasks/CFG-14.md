# CFG-14 — Sitio docs + release beta end-to-end

| Campo | Valor |
|---|---|
| Estado | ✅ COMPLETED |
| Ruta | subagente CFG-14 (solo docs; NO commit, NO tag, NO push) |
| Contrato | VitePress mínimo + 3 screenshots + secuencia quickstart + release beta unsigned con SHASUMS real + notes desde CHANGELOG. Sin tocar `src/*`, tests, CI, schemas. DIST-04 no implementado (bloqueo owner). |
| Plan | `docs/agent-ops/plans/2026-10-16-plan-configs-revision-total.md` fila `CFG-14` |

## DISCOVERY

- `scripts/generate-checksums.cjs` (l.1-100): verificado completo. Node puro
  (`crypto/fs/path`), `dist/`→`release/`→arg, `--help` ok, excluido de refactor.
- `docs/deployment/distribution.md` §6-7 + `release-notes-template.md`: checklist
  unsigned y plantilla seguidos al pie (secciones `None` → contenido real).
- `apps/desktop/electron-builder.config.cjs`: leído (output `release/`,
  `publish` comentado por DIST-04). Solo lectura, sin edición.
- `CHANGELOG.md` (46 líneas): `[Unreleased]` + `[0.1.0]` volcados a notes y mirror.
- Sin `dist/` ni `release/` en el repo, sin display, sin `vitepress` instalado:
  decisión usuario previa lo cubre (VitePress mínimo, placeholders marcados,
  secuencia PNG en vez de GIF, beta unsigned, DIST-04 fuera).

## Steps

1. ✅ VitePress mínimo: `docs/.vitepress/config.mts` (nav+sidebar+búsqueda local),
   `docs/getting-started.md`, `docs/changelog.md` (mirror `CHANGELOG.md`).
2. ✅ 3 screenshots placeholder SVG marcados: `docs/public/screenshots/{shell,chat,canvas}.svg`.
3. ✅ Secuencia quickstart: `docs/public/quickstart/frame-01..04.png` (PNG reales,
   firma mágica verificada, stdlib `node:zlib`) + `README.md` (GIF real pendiente).
4. ✅ Release beta unsigned: `docs/deployment/releases/v0.1.0-beta.1/release-notes.md`
   (desde CHANGELOG + plantilla) + `SHASUMS.txt` generado con el script real.
5. ✅ Enlace en `docs/index.md` + sincronización plan file.

## Review

- Tier: Fast (solo `docs/`; sin código, sin firmados, sin CI).
- Verify mecánico: `node scripts/generate-checksums.cjs --help` ✅;
  corrida real sobre release dir → `SHASUMS.txt` con 1 artefacto ✅;
  PNGs con firma `137,80,78,71,13,10,26,10` ✅. Sin `pnpm build` (fuera de
  alcance docs-only; sin regresiones posibles: ningún `src/*` tocado).

## Evidencia

- `docs/.vitepress/config.mts`, `docs/getting-started.md`, `docs/changelog.md`
- `docs/public/screenshots/shell.svg|chat.svg|canvas.svg`
- `docs/public/quickstart/frame-01.png..frame-04.png` (617/723/679/611 bytes) + `README.md`
- `docs/deployment/releases/v0.1.0-beta.1/release-notes.md` + `SHASUMS.txt`
  (`3cfcbd3f…154e16d  release-notes.md`)

## RESULTADO

✅ COMPLETO — contrato cumplido en alcance docs-only. Deuda: capturas reales
con display (3 PNG + GIF) y `SHASUMS.txt` sobre instaladores tras `pnpm dist`.
