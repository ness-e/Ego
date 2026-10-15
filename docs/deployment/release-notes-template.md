# Release notes — plantilla

> Copiar este archivo por release (p. ej. `docs/deployment/releases/vX.Y.Z.md`)
> y rellenar solo las secciones con contenido. Secciones vacías: escribir
> `None` explícito, no borrar el encabezado (trazabilidad estable).
> Cada release unsigned debe enlazar sus artefactos + `SHASUMS.txt`.

## Versión

- Versión: `vX.Y.Z`
- Fecha: `YYYY-MM-DD`
- Commit/tag: `<sha o tag>`
- Firma: **unsigned** (DIST-04 BLOQUEO owner pendiente) / firmada (tachar lo que no aplique)
- Artefactos:
  - Windows: `Ego-Setup-<versión>-x64.exe` (+ `zip`)
  - macOS: `Ego-<versión>-<os>-<arch>.dmg` (+ `zip`)
  - Linux: `Ego-<versión>-x64.AppImage` (+ `tar.gz`)
- Checksums: `SHASUMS.txt` (sha256, generado con `scripts/generate-checksums.cjs`)

## Added

- None

## Fixed

- None

## Security

- None (recordatorio: build unsigned — SmartScreen/Gatekeeper mostrarán
  avisos esperables; verificar hash con `SHASUMS.txt`. La autenticidad
  verificable llega con DIST-04.)

## Migration

- None (si hay cambios de esquema VantaDB, snapshots o rutas de datos,
  describir aquí pasos manuales + snapshot pre-riesgo según
  `docs/operations/snapshots-respaldo.md`.)
