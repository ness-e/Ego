# Release notes — v0.1.0-beta.1

> Fuente: `CHANGELOG.md` (`[Unreleased]` + `[0.1.0]`). Plantilla:
> `docs/deployment/release-notes-template.md`.

## Versión

- Versión: `v0.1.0-beta.1`
- Fecha: `2026-10-15`
- Commit/tag: pendiente de tag del owner (`v0.1.0-beta.1`)
- Firma: **unsigned** (DIST-04 BLOQUEO owner pendiente)
- Artefactos (nombres canónicos, `apps/desktop/electron-builder.config.cjs`):
  - Windows: `Ego-Setup-0.1.0-beta.1-x64.exe` (+ `zip`)
  - macOS: `Ego-0.1.0-beta.1-<os>-<arch>.dmg` (+ `zip`)
  - Linux: `Ego-0.1.0-beta.1-x64.AppImage` (+ `tar.gz`)
- Checksums: `SHASUMS.txt` (sha256, `scripts/generate-checksums.cjs`). En este
  corte solo cubre `release-notes.md` (staging docs); al empaquetar, el script
  corre sobre `release/` con los instaladores reales.

## Added

- E2E Electron skeleton (`tests/gui`, job `e2e-electron` fail-soft con Xvfb).
- Accesibilidad WCAG 2.2: base de criterios y cobertura de auditoría del renderer.
- Shiki / Motion / PM mínimo sin ampliar el grafo de dependencias.
- Hardening de navegación / CSP en la ventana desktop (sin cambio funcional).
- Workspace Ego inicial: `apps/desktop` (Electron 33) + renderer React 19 + Vite.
- Cognitive Runtime, VantaDB 0.8.0 (BM25 in-process + L0-L3 en `vantadb-mcp`),
  Model Router propio. CI base + `smoke-native.yml`.

## Fixed

- None

## Security

- Build **unsigned**: SmartScreen/Gatekeeper mostrarán avisos esperables.
  Verificar hash con `SHASUMS.txt` (`certutil -hashfile <exe> SHA256` en
  Windows; `shasum -a 256 <artefacto>` en macOS/Linux). Autenticidad
  verificable llega con DIST-04 (no implementado aquí, bloqueo owner).

## Migration

- None (sin cambios de esquema VantaDB en este corte).
