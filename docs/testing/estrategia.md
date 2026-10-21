# Estrategia de tests — fuente vigente

| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de estrategia de pruebas y contratos |
| Owner | ness-e |
| Fecha | 2026-10-06 |
| Fuente histórica | PRD v0 (no versionado en este repo; roadmap con hitos y criterios de salida) + `docs/research/` + Decisiones P1-P24 |
| VantaDB verificado | 0.8.0 base dev; `EgoMemoryAdapter.ts` implementado; contratos tipados en Vitest |
| Regla | Este archivo se edita; PRD v0 (no versionado en este repo) queda congelado como referencia histórica |

## Pirámide de Calidad Desktop P0

1. **Contratos del Adapter (VantaDB):**
   - Verificación de métodos nucleares: `putMulti`, `searchMulti`, `recall`, `quarantine`, `promote`, `supersedeFact`, `flush`, `close`.
   - Normalización de metadatos (`org_id`, `ts`, `agent_id`, `confidence`, `state`).
   - Pin estricto npm `"vantadb/native": "0.8.0"` (napi-rs in-process). Verificación de que `Client` de `"vantadb"` (WASM) está ausente de los bundles.
   - Verificación de Auto-Embed interno (ONNX Runtime, `multilingual-e5-small`, 384d) sin computación de vectores en TypeScript.
   - Verificación de comunicación con el subprocess cognitivo `vantadb-mcp` (88 tools — cifra del proyecto hermano VantaDB, no verificable desde Ego; R2 T09) vía stdio.

2. **Contratos de Sub-Egos y Aislamiento de Memoria:**
   - Modelo de memoria compartida de proyecto: Los Sub-Egos pueden **LEER** namespaces compartidos del proyecto (`kb/*`, `crm/*`, `dev/*`, `analytics/*`, etc.) según los permisos y capacidades definidos en su [`SubEgoManifest`](../architecture/agentes.md).
   - Aislamiento privado estricto: El namespace `egos/<id>/*` es estrictamente privado y exclusivo para el Sub-Ego con dicho identificador. Ningún otro Sub-Ego tiene acceso a él.
   - Escritura gobernada: La escritura sobre namespaces compartidos requiere permisos explícitos en el manifest o pasa por el flujo de procedencia y revisión.
   - Validación unitaria de control de acceso mediante políticas de manifest.
   - Control de límites de presupuesto (tokens/costo) y emisión de eventos de auditoría inmutables en `gov/audit`.

3. **Contratos de Datos y Esquemas:**
   - Validación del archivo `ego.namespaces.json` v2.
   - Verificación de TTL en hechos temporales y depuración limpia con `purgeExpired()`.
   - Sustitución atómica de hechos mediante aristas `SUPERSEDED_BY`.
   - Procedencia, confianza (confidence scoring) y validación de entidades.

4. **Capa Electron e IPC:**
   - Tipado estricto de canales `ipc.*` con aislamiento de contexto (`contextIsolation: true`) sin exposición directa de APIs de Node en el renderer.
   - Carga resiliente de `index.html` mediante `app.getAppPath()`.
   - Integración fluida de `@assistant-ui/react` y el Canvas con el puente seguro `window.ego`.

5. **E2E y Validación de Producto:**
   - Flujo de creación, activación contextual y ciclo de vida de Sub-Egos desde la UI con actualización reactiva de estado.
   - Respaldo y restauración de `.vdbdump` en base de datos temporal con conteos y relaciones idénticos.
   - Validación del *Golden Path Alpha* (20 pasos) y *Golden Path Beta*.

## Puertas de calidad automatizadas (bloqueantes)

La cobertura mide; las **puertas** cortan. El job `verify` de
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) encadena las
siguientes, y cualquiera de ellas rompe el pipeline:

| Puerta | Comando | Qué bloquea |
| --- | --- | --- |
| Lint de código | `pnpm exec oxlint --ignore-path .gitignore apps packages tests scripts eval` | Errores de oxlint en `apps`, `packages`, `tests`, `scripts`, `eval`. |
| Typecheck | `pnpm typecheck` | Cualquier error de tipos (TypeScript estricto en todo el monorepo). |
| Tests | `pnpm test` | Regresiones funcionales. |
| **Design system** | `node apps/desktop/scripts/design-lint.cjs` | Violaciones **R1–R7** del design system. |
| Avatar sync/geometry | `pnpm --filter @ego/avatar sync:check` + `geometry:check` | Drift entre el motor canónico y la copia vendorizada; traza golden de la geometría. |
| Harness del agente | `node scripts/verify-harness.mjs` | Desincronización de `.opencode/` con `.agents/`. |
| Triggers de CI | `node scripts/verify-ci-triggers.mjs` | Workflows inertes (filtros de rama que nunca disparan). |
| Trazabilidad VantaDB | `node scripts/verify-vantadb-ids.mjs` | IDs del registro canónico inexistentes o índice↔detalle incoherentes. |
| Rutas del repositorio | `node scripts/verify-paths.mjs` | Rutas con caracteres no admitidos por Windows o ficheros de 0 bytes. |
| Seguridad | `node scripts/audit-security.mjs` | Advisories CRITICAL/HIGH sin justificación en el ALLOWLIST. |

### Puerta de calidad del design system (`design-lint`)

El design system de Ego ([`docs/design/design-system.md`](../design/design-system.md),
canónico) **ahora se aplica, no solo se declara**. Hasta la Ola 1 sus reglas
eran prosa: nadie las ejecutaba y el código divergía (hex literales fuera de
token, `style={{}}` ad-hoc, `text-[Npx]` arbitrarios, `<select>` nativo,
colores de paleta crudos). Hoy hay un linter sin dependencias que convierte
esas reglas en ley ejecutable.

- **Script**: `apps/desktop/scripts/design-lint.cjs` — sólo `node:fs` y
  `node:path`, sin dependencias que instalar.
- **Alcance por defecto**: `apps/desktop/renderer/{components,src,floating}`
  (ficheros `.ts`/`.tsx`; se excluyen los tests, `node_modules` y el motor de
  avatar vendorizado en `floating/vendor/`).
- **Contrato de salida**: `0` = pasa (puede haber avisos de R8, que son
  métricas) · `1` = hay errores (R1–R7) · `2` = error de uso.

| Regla | Detecta | Severidad |
| --- | --- | --- |
| R1 | Hex literal fuera de `var(--color-*, fallback)` | error |
| R2 | `style={{}}` ad-hoc (escape: `// design-lint: allow`) | error |
| R3 | `text-[Npx]` arbitrario — la escala tipográfica es la única admitida | error |
| R4 | Opacidad sobre texto `dim`/`faint` o en `placeholder:` (contraste AA) | error |
| R5 | `border-hairline` como único indicador de un input | error |
| R6 | `<select>` nativo (ADR-0015) | error |
| R7 | Paleta cruda (`text-white`, `bg-white/*`, `text-zinc-*`, `bg-black/*`…) | error |
| R8 | Recuento de `<button>`/`<input>`/`<textarea>` nativos: métrica de adopción del kit | aviso |

**Cómo ejecutarla:**

```powershell
# Informe legible (por defecto)
node apps/desktop/scripts/design-lint.cjs

# Informe JSON (para CI o para consumo por machines)
node apps/desktop/scripts/design-lint.cjs --json

# Podar la lista blanca: imprime la tabla `WHITELIST` sin las entradas muertas
node apps/desktop/scripts/design-lint.cjs --prune

# Scripts npm equivalentes
pnpm --filter @ego/desktop design:lint
pnpm --filter @ego/desktop design:lint:json
pnpm --filter @ego/renderer design:lint
pnpm --filter @ego/renderer design:lint:json
```

**Excepciones (deuda granfathered).** La tabla `WHITELIST` del script enumera,
por `(regla, fichero)`, la deuda preexistente con **motivo + fecha + ID de
hallazgo** (`EGO-DL-###`). Un fichero nuevo con la misma infracción **no**
queda cubierto: la puerta se enciende sola. `--prune` retira las entradas que
ya no suprimen nada, porque la lista blanca es un registro vivo — cuando una
capa se migra al design system, sus entradas tienen que morir.

**Contrato de test.** `apps/desktop/renderer/test/design-lint.test.tsx`
verifica que (a) el renderer actual tiene 0 errores, (b) el índice de
excepciones del script coincide con el declarado en el test, (c) cada
excepción trae motivo, fecha e ID y apunta a ficheros que existen, (d) las
excepciones no están obsoletas y (e) **la puerta está encendida**: un fixture
temporal con un hex y un `<select>` produce exactamente 2 errores.

**En CI.** El paso `design-lint` del job `verify` corre **antes** del
typecheck, los tests y el build (fail-fast): una violación de diseño no llega
a gastar un pipeline completo. Bloquea ante cualquier violación R1–R7.

> Pendiente conocido (`EGO-FIND-86` en el Backlog): la lista blanca se indexa
> por ID de hallazgo, que hoy se asigna en orden de escaneo. La corrección
> acordada es indexarla por hash del contenido del hallazgo.

## Pruebas de Integración MCP (Model Context Protocol)

Ego incorpora una suite de 8 pruebas de integración para validar la interoperabilidad segura tanto en rol de cliente (MCP Client) como de servidor (MCP Server):

1. **MCP Discovery:** Ego se conecta a un servidor MCP externo y descubre correctamente sus herramientas, recursos y esquemas declarados.
2. **MCP Execution:** Ego invoca una herramienta provista por un servidor MCP externo, transmite parámetros válidos y recibe el resultado procesado en su runtime.
3. **Permission Boundary:** Ante una herramienta MCP clasificada como sensible o con impacto externo, el sistema detiene la ejecución y exige aprobación explícita del usuario antes de continuar.
4. **MCP Failure:** Cuando un servidor MCP no responde, se desconecta abruptamente o devuelve un error, Ego aísla la falla, reporta un error limpio y continúa operando sin degradar el runtime.
5. **GitHub MCP:** Ego se conecta a un servidor MCP de GitHub real/mockeado y lista issues o repositorios de forma exitosa mediante llamadas a herramientas de integración.
6. **Ego MCP Server:** Una aplicación de IA externa consulta el recurso `project_context` expuesto por el servidor MCP embebido de Ego y obtiene el estado del proyecto con permisos verificados.
7. **Generic API:** Ego invoca un endpoint REST externo a través de la capa de integración y procesa adecuadamente la respuesta tipada.
8. **Restart:** La configuración de servidores MCP conectados, permisos asignados y credenciales almacenadas persiste íntegramente tras el reinicio de la aplicación.

## Criterios de Aceptación por Fases (Roadmap)

La verificación de la calidad sigue de forma vinculante los criterios de aceptación de las 12 fases detalladas en [Roadmap de Implementación](../roadmap/roadmap.md):

| Fase | Capacidad | Criterio de Aceptación Clave |
| --- | --- | --- |
| **Fase 01** | Core Cognitivo | Chat con IA funcional localmente sobre Electron + VantaDB nativo (`NativeVantaDB`), streaming, búsqueda léxica BM25 en fast-path (<2ms), persistencia Fjall verificada tras reinicio y export/import (.vdbdump). |
| **Fase 02** | Acción | Tool Registry operativo, ejecución controlada de herramientas del SO y flujo de aprobación de usuario. |
| **Fase 03** | Sub-Egos | Múltiples Sub-Egos cooperan recursivamente compartiendo contexto mediante Shared Memory sin orquestación manual del usuario. |
| **Fase 04** | Dynamic Workspace / Canvas | Generación y manipulación interactiva de artefactos UI reactivos en tiempo real con selección de contexto. |
| **Fase 05** | Decision Intelligence | Clasificación automática de intenciones, scoring, delegación a Sub-Egos y control de presupuesto/fallbacks. |
| **Fase 06** | Knowledge & Data | Ingesta masiva, almacenamiento vectorial en VantaDB, búsqueda híbrida (semántica + texto) y Data Views. |
| **Fase 07** | Tasks & Background | Tareas persistentes asíncronas en segundo plano que no bloquean la UI y notifican proactivamente. |
| **Fase 08** | Daily State | Dashboard dinámico de bienvenida con resumen de sesión, priorización inteligente y métricas operativas. |
| **Fase 09** | Dominios Funcionales | Sub-Egos especializados y workspaces de dominio (Product, Engineering, CRM, etc.) reemplazan herramientas SaaS. |
| **Fase 10** | Recovery & Hardening | Resiliencia ante crashes, recuperación automática de tareas pendientes, exportación/importación completa y migración de esquemas. |
| **Fase 11** | Seguridad | IPC estricto, sandbox, auditoría inmutable en `gov/audit`, gestión cifrada de secretos y límites de ejecución. |
| **Fase 12** | Distribución | Empaquetado multiplataforma (.exe / .msix), auto-updater verificado y prueba "Clean Machine" automatizada. |

## Gates P0 (Criterios de Lanzamiento Comercial)

- **Recall:** ≥85% en 7 días sobre eventos con `agent_id`.
- **Latencia:** p99 híbrida <50ms sobre 100k entidades en VantaDB.
- **Aislamiento:** Cero fugas de información entre espacios privados de Sub-Egos (`egos/<id>/*`) en pruebas de penetración cruzada.
- **Turno de diálogo:** Latencia total entre 800 y 1500ms; alerta de degradación si supera 2000ms.
- **MCP Suite:** 8/8 pruebas de integración MCP superadas satisfactoriamente en CI.
- **Instalador:** Paquete verificado en Windows (.exe / .msix) con arranque limpio en máquina virgen.
