# Ego — build resources (F5T11/M27)

Este directorio es el `buildResources` declarado en
`../electron-builder.config.cjs`. Existía referenciado pero ausente en disco,
lo que rompe el empaquetado según la versión de electron-builder.

Contenido esperado (deuda para Distribución/Fase 12):
- `icon.ico` (Windows), `icon.icns` (macOS), `icon.png` 512px (Linux)
  generados desde `images/` del repo.

Sin iconos dedicados, electron-builder usa sus valores por defecto y el
packaging no falla por directorio ausente. No añadir binarios en esta task.
