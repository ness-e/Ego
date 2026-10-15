# Changelog (mirror web)

> Espejo de `CHANGELOG.md` raíz para el sitio VitePress. Fuente canónica:
> `CHANGELOG.md`. Al cortar release, actualizar ambos.

## [Unreleased]

### Added

- E2E Electron skeleton: andamiaje base para pruebas end-to-end sobre el
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

- Nada aún.

### Fixed

- Nada aún.

## [0.1.0] - 2026-10-14

### Added

- Versión inicial del workspace Ego (SOC desktop): monorepo pnpm con
  `apps/desktop` (Electron 33) y renderer React 19 + Vite.
- Cognitive Runtime central, memoria local VantaDB 0.8.0 (BM25 léxico
  in-process + capas L0-L3 en subprocess `vantadb-mcp`) y Model Router propio.
- CI base (`ci.yml`): lint, typecheck, test y build; workflow
  `smoke-native.yml` para verificación nativa.
