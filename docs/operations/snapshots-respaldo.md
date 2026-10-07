# Snapshots y respaldo — fuente vigente

| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de snapshots desktop y respaldos soberanos |
| Owner | ness-e |
| Fecha | 2026-10-05 |
| Fuente histórica | `../prd/09-8-esquema-de-datos-namespaces-grafo-y-ttl.md` §8.4 + `../architecture/namespaces.md` |
| VantaDB verificado | 0.8.0 base dev; `export_all`/`bulk_import` `.vdbdump`; adapter implementado |
| Regla | Este archivo se edita; `../prd/09*` queda congelado como referencia histórica |

## Rutina local soberana (Electron)

- Respaldo diario automático ejecutado por el proceso principal (`EgoMemoryAdapter.snapshot()`) guardando en la carpeta `userData` del usuario.
- Respaldo manual en 1 clic disponible en la interfaz de usuario antes de operaciones críticas.
- Formato portable `.vdbdump` con magic `VDBJSON\n`; exporta todos los namespaces incluyendo el registro de Sub-Egos (`gov/sub_egos`), sus memorias aisladas (`egos/*`), la Base de Conocimiento (`kb/docs`) y las relaciones del grafo.

## Retención y Capacidad Soberana

- Sin borrado forzado de memoria. Advertencia proactiva si la base de datos supera 10GB en disco.
- Exportación externa completa para migración de equipo o sincronización personal cifrada.

## Verificación de Integridad

- Rutina mensual de verificación en directorio temporal: restaura el dump, compara conteos de registros por namespace y valida que las búsquedas BM25/vectoriales reproduzcan los mismos resultados.
