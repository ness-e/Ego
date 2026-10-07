# Despliegue — fuente vigente

| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de despliegue desktop |
| Owner | ness-e |
| Fecha | 2026-10-05 |
| Fuente histórica | `../prd/07-6-arquitectura-general-y-pol-tica-de-lenguajes.md` §6.3 + `../prd/22*` + `../engineering/stack.md` + `../engineering/lenguajes.md` desktop |
| VantaDB verificado | 0.8.0 base dev; embebida napi en main; WAL + snapshots fichero (ver `../architecture/memoria-vantadb.md`) |
| Regla | Este archivo se edita; `../prd/07*` queda congelado como referencia histórica |
| Decisión 2026-10-05 | Electron solo desktop: builder + firma + auto-update; datos local; prereqs bloqueantes; sin VPS |

## Instalador P0

electron-builder por OS (NSIS/dmg/AppImage) + firma/notarización + auto-update. Sin VPS/Compose/n8n/E2B en P0. Edición cloud futura fuera de P0. Caveats: AppImage sin auto-update nativo ni firma; firma Windows (cert EV) pendiente de spike instalador.

## Datos y respaldo

VantaDB en carpeta usuario + snapshots fichero (`export_all` diario + manual pre-riesgo) + export/import `.vdbdump` + `verify` al arrancar. Sin volúmenes Docker.

## Arranque

Check bloqueante Node/Python/Go + `electron-rebuild` napi + keychain disponible. Si falta, mensaje explícito, no fallback silencioso. Telemetría local en `metrics/`.

## Sin pin / A medir

Web sin evidencia hoy → diseño propio no validado, no falso. Gates: instalador firmado por OS, auto-update verificado, snapshots restaurados en temporal, arranque offline con Llama local.
