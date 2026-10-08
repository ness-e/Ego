# Design Audit Orchestrator

Pipeline completo y gratuito de validación, revisión, auditoría y análisis de diseño frontend. Integra 7 capas de herramientas open-source en un solo flujo ejecutable desde OpenCode/CLI, cubriendo tokens CSS, estructura HTML, accesibilidad WCAG, rendimiento, regresión visual y más.

## Requisitos

- Node.js 20+
- Playwright browsers instalados (`npx playwright install chromium`)
- Las tools se auto-detectan; si falta alguna, la pipeline salta esa capa con aviso

## Pipeline — 7 Capas

### Capa 1: Tokens & CSS Enforcement (estático, build-time)

**Tools:** `stylelint` + `stylelint-config-standard` + `stylelint-design-token-guard`

```bash
cd web
npx stylelint "src/**/*.css" --fix
```

Valida: border-radius 0px, colores solo del token set, fuentes permitidas, sombras hard (0 blur), borders thick (2-3px), `!important` prohibido, `@media (prefers-reduced-motion: reduce)` requerido.

### Capa 2: HTML Semántico & Estructura (estático)

**Tools:** `HTMLHint` + `markuplint`

```bash
cd web
npx htmlhint "src/**/*.html" "src/**/*.tsx"
```

Valida: doctype HTML5, atributos lowercase, alt en imágenes, anidamiento correcto, IDs duplicados, etiquetas obsoletas.

### Capa 3: Linter Unificado JS/TS/CSS

**Tools:** `Biome`

```bash
cd web
npx @biomejs/biome check --write src/
```

Valida: CSS properties desconocidas, missing `var()` en variables, unidades CSS inválidas, selectores duplicados, formato consistente.

### Capa 4: Accesibilidad WCAG (runtime, Playwright)

**Tools:** `@axe-core/playwright` + Playwright MCP

```bash
cd web
npx playwright test e2e/design-audit-pipeline.spec.ts
```

Valida: WCAG 2.2 A/AA (color contrast, ARIA, labels, heading hierarchy, focus order, etc.).

### Capa 5: CSS Computado desde DOM (runtime)

**Tools:** Playwright MCP (`browser_evaluate`)

El pipeline existente `design-audit.spec.ts` ya extrae CSS real del navegador: border-radius, box-shadow blur, font-family, color, background-color. Se ejecuta como parte de la Capa 4.

### Capa 6: Regresión Visual (runtime)

**Tools:** Playwright `toHaveScreenshot()` + `pixelmatch`

```bash
cd web
npx playwright test e2e/design-audit-pipeline.spec.ts --grep "visual-regression"
```

Compara screenshots actuales vs baseline para detectar cambios visuales no intencionales.

### Capa 7: Reporte Consolidado

**Tools:** Script `web/scripts/audit-report.mjs`

```bash
node scripts/audit-report.mjs
```

Consolida resultados de todas las capas en un reporte HTML único con:
- Resumen ejecutivo (violaciones por severidad)
- Detalle por capa con fragmentos de código
- Estadísticas de cobertura (rutas auditadas vs total)
- Enlaces a documentación de fix

## Comandos Rápidos

```bash
# Pipeline completa (todo en uno)
npm run audit:design

# Capas individuales
npm run audit:tokens       # solo Capa 1
npm run audit:html         # solo Capa 2
npm run audit:biome        # solo Capa 3
npm run audit:a11y         # solo Capa 4+5
npm run audit:visual       # solo Capa 6
npm run audit:report       # solo Capa 7
```

## Arquitectura de Archivos

```
web/
├── stylelint.config.js         # Reglas CSS del Design System
├── .stylelintrc.json           # Token guard + standard config
├── biome.json                  # Config Biome
├── .htmlhintrc                 # Reglas HTMLHint
├── e2e/
│   ├── design-audit.spec.ts    # Auditoría CSS computada (existente)
│   └── design-audit-pipeline.spec.ts  # Pipeline Playwright unificado
├── scripts/
│   └── audit-report.mjs        # Generador de reporte HTML
└── src/
    └── styles/
        └── tokens.css           # Design tokens (source of truth)
```

## Cómo Usar con OpenCode (text-only agent)

Dado que Deepseek es text-only sin visión, el flujo óptimo es:

1. **Ejecutar pipeline completa** → `npm run audit:design`
2. **Leer reporte HTML generado** → el reporte contiene texto estructurado que el agente puede parsear
3. **Para cada violación** → el agente lee el fragmento de código ofensivo y aplica fix
4. **Re-ejecutar** → `npm run audit:design` para verificar que se corrigió

Para inspección visual sin screenshot: usar Playwright MCP `browser_evaluate` para extraer CSS computado de elementos específicos + `browser_snapshot` para el árbol de accesibilidad.

## Mantenimiento

- Los baseline de regresión visual están en `web/e2e/*-snapshots/`
- Actualizar baselines: `npx playwright test --update-snapshots`
- Stylelint y Biome se actualizan vía `npm update`
- Las reglas del design system se definen UNA vez en `tokens.css` y se reflejan en `stylelint.config.js`
