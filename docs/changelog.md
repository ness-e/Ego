# Changelog (mirror web)

> Espejo de `CHANGELOG.md` raíz para el sitio VitePress. Fuente canónica:
> `CHANGELOG.md` (raíz del repo). Al cortar release, actualizar ambos.
>
> **Estado 2026-10-20:** la entrada de la Ola 1 **y la de la Ola 2** están
> **sincronizadas** en los tres ficheros (`CHANGELOG.md` raíz, este espejo y
> `docs/user/changelog.md`). La regla de precedencia es explícita en los tres:
> **manda la raíz**.

## [Unreleased]

### Added

- **Canal dual (P-LLM/Q-LLM) con taint tracking** en el runtime: la
  procedencia del contenido se marca explícitamente (`trust: "untrusted"`), el
  contenido externo viaja delimitado en un canal de datos que nunca se mezcla
  con las instrucciones, y una tool destructiva con historial no confiable
  **escala a aprobación humana** aunque su política no lo exigiera. Ver
  `docs/adr/0019-canal-dual-taint-tracking.md`.
- **Motor de personaje documentado como decisión**: `@ego/avatar` es el motor
  vigente; `CharacterEngine` queda como legado. Ver
  `docs/adr/0018-motor-de-personaje.md`.
- **Compactación de contexto con resumen real**: el módulo de compactación
  admite un resumidor LLM inyectable (con fallback heurístico determinista) y
  archiva el tramo podado en la memoria del proyecto. La decisión sobre el
  motor (TypeScript propio vs. `contextAssemble()` nativo) queda en
  `docs/adr/0020-compactacion-motor-ts-vs-nativo.md`.
- **MCP Server de Ego**: el producto puede exponerse como servidor MCP
  (herramientas, recursos y prompts) y no solo consumirlo.
- **Herramientas de tareas en background**: el agente ya puede lanzar, listar,
  pausar, cancelar y reanudar tareas en segundo plano.
- **Frontera de ruta y SSRF**: los handlers IPC que leen disco validan que la
  ruta esté dentro del workspace, y las peticiones de red bloquean rangos
  privados y direcciones de metadatos de nube.
- **Paletas del tema en OKLCH** con un contrato de contraste **verificable por
  test** sobre las paletas reales: `docs/design/DESIGN.md`.
- **E2E Electron skeleton**: andamiaje base para pruebas end-to-end sobre el
  bundle desktop (`apps/desktop/out/main/main.js`) con runner Playwright
  standalone en `tests/gui` y job `e2e-electron` en CI (modo fail-soft con
  Xvfb si no hay bundle).
- Accesibilidad WCAG 2.2: base de criterios y cobertura de auditoría para el
  renderer (foco visible, navegación por teclado, contraste, nombres
  accesibles).
- Shiki / Motion / PM mínimo: base mínima de resaltado de código (Shiki),
  motion y package manager para el renderer sin ampliar el grafo de
  dependencias del producto.
- Hardening de navegación / CSP: base de política de seguridad de contenido y
  endurecimiento de navegación en la ventana desktop (sin cambios de
  comportamiento funcional en esta etapa).
- **Estado `warning` del motor de personaje**: el avatar por fin distingue la
  **degradación tolerable** (una tool falló pero el turno continúa) del fallo
  duro. Antes se quedaba en «pensando» —es decir, mentía—. En el motor es
  ámbar con triángulo `⚠`, vaivén leve y pose `warn`.
- **Guard de contrato de los estados del personaje**: un test enumera todos los
  estados del chat y comprueba que cada uno existe en el motor y que ninguno
  cae en el estado de reserva. Impide que el próximo estado nuevo se pierda en
  el silencio.
- **Trazabilidad por turno**: cada tool call lleva su identificador de
  correlación, derivado del turno, y los eventos lo propagan. Se puede
  reconstruir la traza de un turno entero.
- **Ida y vuelta al modo estudio**: los 15 estados del personaje conservan su
  identidad al pasar por el modo canvas y volver (4 de ellos la perdían).

### Changed

- **Documentación**: `docs/index.md` pasa a ser el índice maestro real (ADRs,
  fichas de extracción, backlogs de revisión, research, design system); el
  sitio VitePress deja de exponer 3 enlaces y publica la navegación completa;
  `roadmap.md` se reconcilia con el Backlog (13/13 fases con estado) y el
  Backlog queda declarado como **fuente canónica del estado**.
- **ADRs**: 20 decisiones numeradas sin colisión (antes 12 con dos `0006`),
  todas con la plantilla común, incluidas cinco decisiones que ya estaban en
  producción sin registrar (CodeMirror 6, virtualización del chat, `Select`
  sobre Radix, resaltado en Web Worker y compactación de contexto).
- **Escala del motor de personaje**: 266 tests portados y `typecheck`/`build`
  reales (antes eran no-op), con puerta de sincronización por SHA-256 entre el
  paquete y la copia vendorizada. Hoy son **274 tests** y la geometría golden
  llega a **174** combinaciones.
- `apps/desktop/src/main.ts` baja de 5 401 a 2 857 líneas al descomponerse en
  módulos de main.
- `AGENTS.md` refleja el árbol real (18 paquetes, 286 documentos) y documenta
  el principio de usar siempre las primitives de librería.
- **Ejecución paralela de herramientas**: varias tool calls del mismo turno se
  ejecutan a la vez y el orden de sus resultados se conserva intacto. Medido:
  220 ms reales frente a 600 ms en serie.
- **`main.ts` baja de 2 857 a 1 287 líneas**: el proceso principal queda como
  compositor, con el estado en un único módulo y **un test de CI que lo
  vigila** (si vuelve a crecer, o si reaparece un global mutable fuera de
  sitio, el CI se pone rojo).
- **MCP Server de Ego**: se expone como servidor MCP **en HTTP loopback
  (`127.0.0.1`) dentro del propio proceso principal**, con token obligatorio en
  el almacén de credenciales del sistema, rechazo antes de tocar el catálogo y
  la misma aprobación humana que el chat. El token no llega nunca a la
  interfaz. Ver `docs/adr/0021-mcp-server-transporte-y-token.md`.
- **Vitest 3 en los 20 manifiestos** que lo declaran, y **eliminado el override
  global**: antes los tests corrían con la versión nueva mientras el manifiesto
  decía la vieja, así que el linter era verde sobre una mentira.
- **Electron deja de estar en fin de vida**: `^41.10.7` en el manifiesto, sin
  parches por override.
- **El corpus legal de terceros** (atribución MIT) deja de linterse como si
  fuera código propio.

### Fixed

- **Caída de la app al enviar un turno con más de 60 mensajes** (el índice del
  hilo se desincronizaba con la lista virtualizada).
- **Los menús `<select>` nativos desaparecen** de la interfaz: el selector es
  ahora accesible por teclado y respeta el tema oscuro.
- **Los botones más pequeños** cumplen el objetivo táctil de 44 px.
- **El historial de la conversación ya se compacta** en vez de crecer sin cota.
- **La suite de tests y el CI dejan de estar en rojo** por triggers de rama
  obsoletos y asserts que codificaban el contrato anterior.
- **Correcciones de honestidad documental**: la compactación de contexto, la
  búsqueda "híbrida RRF" y la dirección de los conectores se describen como
  son en realidad, no como fueron declaradas.
- **Las imágenes Markdown ya no pueden exfiltrar datos**: el contenido del
  chat se sanea con una lista blanca y la política de seguridad de contenido
  restringe las imágenes al propio origen.
- **El contraste de color deja de estar «marcado como fallando»**: los 6 casos
  pendientes de accesibilidad son ahora comprobaciones reales sobre las
  paletas del tema, no tests que se esperaba que fallaran.
- **El aviso ámbar del personaje ya no se queda pegado**: un fallo de
  herramienta del turno anterior ya no deja al avatar en alerta durante los
  turnos siguientes.
- **Los 4 estados que perdían su identidad al pasar por el modo canvas**
  vuelven intactos.

## [0.1.0] - 2026-10-14

### Added

- Versión inicial del workspace Ego (SOC desktop): monorepo pnpm con
  `apps/desktop` (Electron 33) y renderer React 19 + Vite.
- Cognitive Runtime central, memoria local VantaDB 0.8.0 (BM25 léxico
  in-process + capas L0-L3 en subprocess `vantadb-mcp`) y Model Router propio.
- CI base (`ci.yml`): lint, typecheck, test y build; workflow
  `smoke-native.yml` para verificación nativa.
