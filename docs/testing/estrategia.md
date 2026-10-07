# Estrategia de tests — fuente vigente

| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de estrategia desktop y contratos |
| Owner | ness-e |
| Fecha | 2026-10-05 |
| Fuente histórica | `../prd/18-17-roadmap-con-hitos-y-criterios-de-salida.md` gates + `investigacion-de-diseño/` |
| VantaDB verificado | 0.8.0 base dev; `EgoMemoryAdapter.ts` implementado; contratos tipados en Vitest |
| Regla | Este archivo se edita; `../prd/18*` queda congelado como referencia histórica |

## Pirámide de Calidad Desktop P0

1. **Contratos del Adapter:**
   - Verificación de métodos nucleares: `putMulti`, `searchMulti`, `recall`, `quarantine`, `promote`, `supersedeFact`.
   - Normalización de metadatos (`org_id`, `ts`, `agent_id`, `confidence`, `state`).
   - Pin estricto `vantadb==0.8.0`.
2. **Contratos de Sub-Egos y Aislamiento:**
   - Validación unitaria de [`validateSubEgoAccess()`](file:///c:/Users/Eros/VantaDB%20Proyect/Ego/packages/memory/sub-egos.ts#L40): denegación de lectura/escritura a namespaces ajenos a `egos/<id>/*` y `quarantine/pending`.
   - Control de límites de presupuesto y emisión de eventos en `gov/audit`.
3. **Contratos de Datos y Esquemas:**
   - Validación del archivo `ego.namespaces.json` v2.
   - Verificación de TTL en `quarantine/pending` (14d) y depuración limpia con `purgeExpired()`.
   - Sustitución atómica de hechos mediante aristas `SUPERSEDED_BY`.
4. **Capa Electron e IPC:**
   - Tipado de canales `ipc.*` sin exposición de Node en el renderer (`contextIsolation: true`).
   - Carga resiliente de `index.html` mediante `app.getAppPath()`.
   - Integración fluida de `@assistant-ui/react` con el puente `window.ego`.
5. **E2E y Validación de Producto:**
   - Flujo de creación de Sub-Egos desde la UI con actualización en tiempo real del estado.
   - Respaldo y restauración de `.vdbdump` en base de datos temporal con conteos idénticos.

## Gates P0 (Criterios de Lanzamiento Comercial)

- Recall ≥85% en 7 días sobre eventos con `agent_id`.
- Latencia p99 híbrida <50ms sobre 100k entidades en VantaDB.
- Cero fugas de información entre Sub-Egos en pruebas de penetración cruzada.
- Turno total de diálogo entre 800 y 1500ms; alarma acústica/visual si supera 2000ms.
- Instalador empaquetado y verificado en Windows (.exe / .msix).
