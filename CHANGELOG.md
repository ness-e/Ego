# Changelog

Todos los cambios notables de este proyecto se documentarán en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

> **Precedencia:** este fichero es la **fuente canónica**. `docs/changelog.md` es
> su espejo para el sitio VitePress y `docs/user/changelog.md` su versión
> amigable; si alguno de los tres discrepa, **manda este**.

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
  paquete y la copia vendorizada.
- `apps/desktop/src/main.ts` baja de 5 401 a 2 857 líneas al descomponerse en
  módulos de main.
- `AGENTS.md` refleja el árbol real (18 paquetes, 286 documentos) y documenta
  el principio de usar siempre las primitives de librería.

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

## [0.1.0] - 2026-10-14

### Added

- Versión inicial del workspace Ego (SOC desktop): monorepo pnpm con
  `apps/desktop` (Electron 33) y renderer React 19 + Vite.
- Cognitive Runtime central, memoria local VantaDB 0.8.0 (BM25 léxico
  in-process + capas L0-L3 en subprocess `vantadb-mcp`) y Model Router propio.
- CI base (`ci.yml`): lint, typecheck, test y build; workflow
  `smoke-native.yml` para verificación nativa.

[Unreleased]: https://github.com/ness-e/Ego/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ness-e/Ego/releases/tag/v0.1.0
