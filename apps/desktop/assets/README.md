# Ego — build resources (F5T11/M27, iconos DIST-03)

Este directorio es el `buildResources` declarado en
`../electron-builder.config.cjs` (claves `win.icon`, `mac.icon`, `linux.icon`).

Contenido (placeholders reproducibles, NO diseño final):
- `icon.svg` — fuente vectorial (marca "E" abstracta sobre tinta).
- `icon.png` — 512px (Linux).
- `icon.ico` — multi-tamaño PNG-in-ICO 16/32/48/256 (Windows).
- `icon.icns` — contenedor icns con payloads PNG ic07/ic08/ic09 (macOS).
- `generate-placeholder-icons.cjs` — generador solo-stdlib (Node `zlib`):
  `node generate-placeholder-icons.cjs` regenera los 4 ficheros.

BLOQUEO al owner (diseño final): los shipped son placeholders geométricos.
Se requiere diseño profesional `.ico`/`.icns`/`.png` antes de DIST-04
(firmado/notarización) y DIST-08 (Golden Path Beta). El render del `.icns`
en Finder/Dock además debe validarse en máquina macOS.
