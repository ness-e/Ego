#!/usr/bin/env node
'use strict';

/**
 * design-lint.cjs — PUERTA DE CALIDAD del design system de Ego.
 *
 * El design system está documentado en `docs/design/design-system.md`
 * (§1 tokens, §7 las 7 combinaciones prohibidas de contraste) y en
 * `docs/design/DESIGN.md`. Hasta ahora esas reglas eran *prosa*: nadie las
 * ejecutaba y el código divergía (hex literales fuera de token, `style={{}}`
 * ad-hoc, `text-[Npx]` arbitrarios, `<select>` nativo, colores de paleta
 * crudos...). Este script es la puerta que convierte la doc en ley.
 *
 * Uso:
 *   node apps/desktop/scripts/design-lint.cjs            # renderer actual
 *   node apps/desktop/scripts/design-lint.cjs <dir>      # un directorio cualquiera
 *   node apps/desktop/scripts/design-lint.cjs --json     # salida JSON (para CI/test)
 *
 * Sin dependencias: sólo `node:fs` / `node:path`.
 *
 * Contrato de salida:
 *   - 0 → pasa (puede haber advertencias R8, que son métricas, no errores).
 *   - 1 → hay errores (R1–R7, R9–R11).
 *   - 2 → error de uso / fallo interno irrecuperable.
 *
 * Las reglas NO se relajan: la deuda preexistente está *granfathered* en
 * `WHITELIST`, con motivo, fecha e ID de hallazgo. Una violación nueva fuera
 * de la lista blanca rompe la puerta.
 *
 * Reglas:
 *   R1  hex literal fuera de token          R7  color de paleta crudo
 *   R2  `style={{}}` ad-hoc                 R8  métrica de controles nativos
 *   R3  `text-[Npx]` arbitrario             R9  radio fuera de escala
 *   R4  opacidad sobre texto dim/faint      R10 cabecera fuera de chrome (h-11)
 *   R5  `border-hairline` como único borde  R11 superficie derivada con alfa
 *   R6  `<select>` nativo
 *
 * Limitaciones conocidas (deliberadas: el linter es heurístico, no un
 * parser de TypeScript):
 *   - R4/R5/R7/R9/R10/R11 analizan las listas de clases que aparecen tras
 *     `className=`. Las clases construidas en variables auxiliares
 *     (`const cls = "text-white"`) y luego inyectadas no se ven; tampoco
 *     las tablas de clases (`const COLOR_CLASSES = { red: "text-red-400" }`).
 *   - R5 usa la heurística del "tag JSX más cercano por delante" para saber si
 *     la lista de clases pertenece a un elemento input-like.
 *   - R1 solo acepta un hex como fallback si el literal cae dentro de un
 *     `var(...)`; un hex en un contexto no-var (p. ej. dentro de un SVG
 *     externo) se reporta.
 */

const fs = require('node:fs');
const path = require('node:path');

/* ------------------------------------------------------------------ *
 * Constantes de contexto
 * ------------------------------------------------------------------ */

/** Raíz del renderer: `apps/desktop/renderer`. */
const RENDERER_ROOT = path.resolve(__dirname, '..', 'renderer');

/** Directorios analizados por defecto (spec: `components/` y `src/`). */
const DEFAULT_TARGETS = ['components', 'src', 'floating'];

/** Directorios que nunca se analizan (build output, deps, vendor legal). */
const IGNORED_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'out',
  'build',
  'coverage',
  '.git',
  '.turbo',
]);

/**
 * Vendor legal: `floating/vendor/avatar/**` (tercero vendorizado, ver
 * `packages/avatar/scripts/sync-check.mjs` y la cadena MIT).
 *
 * OJO: el literal va con separador POSIX `/` a propósito. La comparación se
 * hace contra `norm`, que normaliza con `path.sep` → `/`; usar
 * `path.join('floating', 'vendor')` producía `floating\vendor` en Windows y
 * el filtro NO casaba nunca (el vendor se analizaba entero).
 */
const IGNORED_PATH_SEGMENTS = ['floating/vendor'];

/** Ficheros de test: no son código de producto, no se analizan. */
const IGNORED_FILE_RE = /\.test\.(tsx|ts)$/;

/**
 * Ficheros de TOKENS: son CSS, no TSX, así que nunca entran en el análisis
 * (se listan aquí solo para dejar constancia de la excepción).
 * `src/index.css` y `src/styles/theme-tokens.css` son la fuente de los
 * tokens; `var(--color-*, fallback)` con hex es la forma canónica.
 */
const TOKEN_FILES = ['src/index.css', 'src/styles/theme-tokens.css'];

/* ------------------------------------------------------------------ *
 * Definición de reglas
 * ------------------------------------------------------------------ */

const RULES = {
  R1: {
    id: 'R1',
    title: 'Hex literal fuera de token',
    severity: 'error',
    doc: 'docs/design/design-system.md §1 — los hex literales viven en `index.css`; en el resto del renderer solo se aceptan como fallback de `var(--color-*, #hex)`.',
  },
  R2: {
    id: 'R2',
    title: 'Estilo inline ad-hoc (style={{}})',
    severity: 'error',
    doc: 'docs/design/design-system.md §1 — `style={{}}` está prohibido en componentes de producto; se usan clases Tailwind sobre tokens.',
  },
  R3: {
    id: 'R3',
    title: 'Tamaño de fuente arbitrario (text-[Npx])',
    severity: 'error',
    doc: 'docs/design/design-system.md §1 — la tipografía va por la escala del sistema, no por valores arbitrarios.',
  },
  R4: {
    id: 'R4',
    title: 'Opacidad sobre texto (contraste AA)',
    severity: 'error',
    doc: 'docs/design/design-system.md §7 — combinaciones prohibidas #1, #2 y #3 (`text-dim`/`text-faint` con opacity, `placeholder:` con opacity o `/N`).',
  },
  R5: {
    id: 'R5',
    title: 'border-hairline como único indicador de input',
    severity: 'error',
    doc: 'docs/design/design-system.md §7 — combinación prohibida #4: el borde necesita un segundo indicador (grosor, foco, icono de error).',
  },
  R6: {
    id: 'R6',
    title: '<select> nativo',
    severity: 'error',
    doc: 'docs/design/design-system.md §8.1 — ADR-0015: el `<select>` nativo ignora el tema dark-only; se usa `Select` de Radix.',
  },
  R7: {
    id: 'R7',
    title: 'Color de paleta crudo fuera de tokens',
    severity: 'error',
    doc:
      'docs/design/design-system.md §1 — cualquier utilidad de la paleta por defecto de Tailwind ' +
      '(`text-emerald-400`, `bg-rose-950/30`, `border-amber-500/40`…) divergen del tema; se usan los ' +
      'tokens `--color-success` / `--color-error` / `--color-warning` / `--color-brand` / `--color-chart-*`.',
  },
  R8: {
    id: 'R8',
    title: 'Control nativo crudo (métrica de adopción del kit)',
    severity: 'warning',
    doc: 'docs/design/design-system.md §3 y §8 — métrica de adopción del kit: cuántos `<button>`/`<input>`/`<textarea>` siguen sin pasar por `ui-kit/`.',
  },
  R9: {
    id: 'R9',
    title: 'Radio fuera de la escala de 3 pasos',
    severity: 'error',
    doc:
      'docs/design/design-system.md §1 — el radio tiene 3 pasos (`rounded-md` 6px · ' +
      '`rounded-[var(--radius-card)]` 8px · `rounded-full`). `rounded` a secas son 4px, ' +
      '`rounded-{lg,xl,2xl,3xl}` y `rounded-[Npx]` arbitrario están fuera de escala.',
  },
  R10: {
    id: 'R10',
    title: 'Cabecera fuera del chrome unificado (h-11)',
    severity: 'error',
    doc:
      'docs/design/design-system.md §6 — todas las cabeceras miden `h-11` (44px). ' +
      '`h-12`/`h-10` en una barra de chrome rompen la alineación entre vistas.',
  },
  R11: {
    id: 'R11',
    title: 'Superficie derivada con alfa (bg-<superficie>/N)',
    severity: 'error',
    doc:
      'docs/design/design-system.md §1 y §6 — las superficies son 3 niveles SÓLIDOS ' +
      '(`bg-paper` · `bg-panel` · `bg-raised`). Una superficie con alfa no es un nivel de la rampa: ' +
      'es un color distinto que no se puede comparar con los otros.',
  },
};

/**
 * Tamaños de fuente arbitrarios permitidos globalmente.
 *
 * Vacía a propósito: la lista blanca de tamaños arbitrarios debe ser
 * EXPLÍCITA y auditable. Si algún día hace falta un tamaño que no está en
 * la escala tipográfica, se añade aquí (una entrada por tamaño) y queda
 * documentado en el mismo commit. La deuda preexistente NO se mete aquí:
 * va en `WHITELIST`, que es un registro distinto (deuda con fecha y motivo).
 */
const ALLOWED_ARBITRARY_TEXT_SIZES = Object.freeze([]);

/**
 * Tags JSX que se consideran "input-like" para R5.
 * Comparación en minúsculas: `Input`, `Search`, `Query`, `input`, `textarea`…
 */
const INPUT_LIKE_TAGS = new Set([
  'input',
  'textarea',
  'textinput',
  'textfield',
  'search',
  'searchinput',
  'searchfield',
  'searchbox',
  'query',
  'queryinput',
  'queryfield',
  'querybox',
]);

/* ------------------------------------------------------------------ *
 * ESCALAS FIJAS del design system (docs/design/design-system.md §1)
 *
 * Estas constantes son la MÁQUINA de las reglas R7/R9/R10/R11: el doc
 * declara escalas fijas, y una escala que no es ejecutable es prosa.
 * Se exportan en el informe JSON para que el test verifique el contrato.
 * ------------------------------------------------------------------ */

/**
 * Familias de la paleta por defecto de Tailwind v4 que el design system
 * sustituye por tokens semánticos (`--color-success`, `--color-error`,
 * `--color-warning`, `--color-brand`, `--color-chart-indigo/violet`).
 *
 * Por qué están TODAS y no sólo `zinc`: `emerald-500`, `cyan-400`,
 * `rose-300`… son colores que existen en el tema oscuro de Tailwind pero
 * que NO participan de la rampa OKLCH de Ego. Un `text-emerald-400` sobre
 * `bg-paper` es un color que no responde a los 4 presets: es exactamente
 * la divergencia que la puerta tiene que ver.
 */
const RAW_PALETTE_FAMILIES = Object.freeze([
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky',
  'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
]);

/**
 * Utilidades de Tailwind que aceptan un valor de color.
 *
 * `shadow` entra porque `shadow-<color>` es una utilidad de color válida
 * (`shadow-emerald-500`); `shadow-{xs..2xl}` son tamaños y no casan con
 * ninguna familia de la paleta.
 */
const COLOR_UTILITIES = Object.freeze([
  'text', 'bg', 'border', 'from', 'to', 'via', 'ring', 'fill', 'stroke',
  'accent', 'outline', 'decoration', 'caret', 'divide', 'placeholder', 'shadow',
]);

/**
 * R7 — utilidad de color que usa la paleta cruda de Tailwind.
 *
 * Se admiten los sufijos de lado (`border-t-red-500`) y el alfa
 * (`bg-rose-950/30`, `bg-white/[0.06]`): son la misma fuga.
 */
const RAW_COLOR_RE = new RegExp(
  `^(?:${COLOR_UTILITIES.join('|')})(?:-[trblxy])?-(?:(?:${RAW_PALETTE_FAMILIES.join('|')})-\\d{2,3}|white|black)` +
    '(?:/(\\d{1,3}|\\[[^\\]]*\\]))?$',
);

/**
 * El SCRIM: la cortina que hay detrás de un modal.
 *
 * Es el ÚNICO uso legítimo que se le concede al negro crudo: `bg-black/60`
 * sobre un overlay a pantalla completa no es un color de superficie ni un
 * color de texto, es una cortina. Y para que la exención no se convierta en
 * un loophole se exige la FIRMA del overlay (posicionamiento fijo/absoluto +
 * `inset-*`): un `bg-black/40` como superficie NO la cumple y salta.
 */
const SCRIM_RE = /^bg-black\/(\d{1,3}|\[[^\]]*\])$/;

/** Posicionamientos que convierten un `bg-black/N` en cortina. */
const OVERLAY_POSITIONS = new Set(['fixed', 'absolute']);

/**
 * Radio — escala de 3 pasos (docs/design/design-system.md §1).
 *
 * `none` no es un cuarto paso: es la ausencia de radio, y por eso se
 * permite. `sm` (2px) NO está en la escala y por tanto se rechaza igual
 * que `lg`.
 */
const RADIUS_ALLOWED_SIZES = Object.freeze(['none', 'md', 'full']);

/** Valores arbitrarios de radio permitidos (sólo el token del sistema). */
const RADIUS_ALLOWED_ARBITRARY = Object.freeze(['var(--radius-card)']);

/** Lados de radio de Tailwind (ordenados: los largos ANTES que los cortos). */
const RADIUS_SIDES = Object.freeze(['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r']);

/**
 * R9 — clase de radio.
 *
 * `rounded` a secas = 0.25rem (4px) en Tailwind → fuera de escala.
 * `rounded-t` (sin lado de tamaño) también: 4px.
 * El orden de `RADIUS_SIDES` importa: `tl` antes que `t`, o `rounded-tl-md`
 * se leería como lado `t` + tamaño `l-md`.
 */
const RADIUS_RE = new RegExp(`^rounded(?:-(?:${RADIUS_SIDES.join('|')}))?(?:-(.+))?$`);

/**
 * Alturas de chrome (docs/design/design-system.md §6).
 *
 * ENFORCED: las que la puerta bloquea hoy (`h-12`, `h-10`).
 * RECOGNIZED: detectadas y documentadas, pero sin bloquear todavía — se
 * mantienen separadas para que activarlas sea un cambio de una línea.
 */
const HEADER_HEIGHTS_ENFORCED = Object.freeze(['h-12', 'h-10']);
const HEADER_HEIGHTS_RECOGNIZED = Object.freeze(['h-9', 'min-h-12', 'min-h-10']);

/**
 * Marcadores de "esto es chrome" (una barra de cabecera, no un botón).
 *
 * Sin este matiz, `h-12 w-12` en una celda-icono saltaría como si fuera una
 * cabecera: sería ruido, y una puerta que grita se deja de escuchar. Un
 * `<header>` no necesita marcador (el tag lo dice); un `<div>` que hace de
 * barra sí (borde inferior/superior, blur de fondo o versalitas).
 */
const HEADER_CHROME_MARKERS = Object.freeze(['border-b', 'border-t', 'backdrop-blur', 'uppercase']);

/** Superficies del sistema: 3 niveles SÓLIDOS. */
const SURFACE_TOKENS = Object.freeze(['paper', 'panel', 'raised']);

/** R11 — superficie derivada con alfa (`bg-panel/95`, `bg-raised/[0.4]`…). */
const DERIVED_SURFACE_RE = /^bg-(paper|panel|raised)\/(\d{1,3}|\[[^\]]*\])$/;

/* ------------------------------------------------------------------ *
 * Lista blanca (deuda granfathered + exenciones estructurales)
 * ------------------------------------------------------------------ */

/**
 * Motivos reutilizables. Cada entrada de `WHITELIST` DEBE apuntar a uno de
 * estos (o a un literal) para que el motivo sea legible y no se duplique.
 *
 * Los motivos `DEBT_*` son el CATÁLOGO de tipos de deuda: sirven de plantilla
 * para dar de alta una excepción nueva cuando aparece deuda real. Una
 * plantilla puede quedarse sin usar (la deuda que la motivó se migró) sin
 * que eso invalide el catálogo: lo que manda es que cada entrada viva de
 * `WHITELIST` apunte a un motivo vigente, y `--prune` lo verifica.
 */
const REASONS = {
  AVATAR_ENGINE:
    'Motor de personaje (Canvas 2D): la paleta de sprites es dato del avatar, no tema de UI; los tokens `--ego-*` no aplican a píxeles dibujados.',
  TOKEN_SOURCE:
    'Fuente canónica de tokens del sistema: aquí viven los valores fijos medidos (`dim`, `border-strong`, `focus-ring`, `text-on-brand`).',
  DEBT_HEX:
    'Deuda heredada: hex literal fuera de token. Pendiente de migrar a `var(--color-*, fallback)` o a clase del sistema.',
  DEBT_INLINE_STYLE:
    'Deuda heredada: estilo inline ad-hoc. Pendiente de migrar a clases Tailwind sobre tokens.',
  DEBT_ARBITRARY_SIZE:
    'Deuda heredada: tamaño de fuente arbitrario (`text-[Npx]`). Pendiente de migrar a la escala tipográfica del sistema.',
  DEBT_OPACITY_TEXT:
    'Deuda heredada: opacidad sobre texto (contraste AA roto). Pendiente de usar `text-dim`/`text-faint` sólidos.',
  DEBT_HAIRLINE_ONLY:
    'Deuda heredada: `border-hairline` como único indicador del input. Pendiente de añadir segundo indicador (grosor/foco/icono).',
  DEBT_RAW_PALETTE:
    'Deuda heredada: color de paleta crudo de Tailwind (`emerald-*`, `rose-*`, `cyan-*`…) fuera de los tokens del sistema. Pendiente de migrar a `--color-success`/`--color-error`/`--color-warning`/`--color-brand`.',
  DEBT_RADIUS_SCALE:
    'Deuda heredada: radio fuera de la escala de 3 pasos (`rounded` a secas = 4px, `rounded-{lg,xl,2xl,3xl}`). Pendiente de migrar a `rounded-md` / `rounded-[var(--radius-card)]` / `rounded-full`.',
  DEBT_HEADER_HEIGHT:
    'Deuda heredada: cabecera con altura fuera del chrome unificado (`h-12`/`h-10` en vez de `h-11`). Pendiente de alinear con `docs/design/design-system.md` §6.',
  DEBT_DERIVED_SURFACE:
    'Deuda heredada: superficie derivada con alfa (`bg-panel/95`, `bg-raised/40`…) en vez de uno de los 3 niveles sólidos. Pendiente de migrar a `bg-paper`/`bg-panel`/`bg-raised`.',
  RUNTIME_POSITIONING:
    'Posicionamiento calculado en runtime (coordenadas de selección): Tailwind no puede expresar un valor dinámico. La supresión la hace esta entrada de la lista blanca, no un comentario en el código.',
  SELECT_UI_KIT:
    'El propio kit de UI: `Button`/`Input` envuelven los controles nativos de la plataforma (Radix no ofrece Button ni Input) — ver `docs/design/design-system.md` §8.1.',
};

/**
 * R8: el kit (`components/ui-kit/`) queda fuera de la métrica de adopción.
 * Sus componentes envuelven los controles nativos de la plataforma a
 * propósito (Radix no ofrece Button ni Input), así que contar sus
 * `<button>`/`<input>` inflaría la métrica sin significado.
 */
const R8_EXCLUSIONS = [{ prefix: 'components/ui-kit/', reason: REASONS.SELECT_UI_KIT }];

/**
 * LISTA BLANCA — el registro auditable de lo que la puerta NO bloquea.
 *
 * Cada entrada:
 *   - `rule`    : regla exentada (R1..R11).
 *   - `files`   : lista EXPLICITA de ficheros exentos (o `file` para uno solo).
 *                 Deliberadamente enumerada: un fichero nuevo con la misma
 *                 infracción NO queda cubierto → la puerta se enciende.
 *   - `lines`   : opcional. Rango(s) de líneas exentos dentro del fichero
 *                 (para ficheros con mezcla de dato de avatar y UI).
 *   - `match`   : opcional. Solo se exenta ese texto exacto.
 *   - `reason`  : MOTIVO (obligatorio). Sin motivo, la puerta no pasa el test.
 *   - `since`   : fecha de alta (YYYY-MM-DD).
 *   - `findingId`: ID del hallazgo/documento que da contexto.
 *   - `kind`    : `estructural` (justificado por diseño) | `deuda` (heredada).
 *
 * POLÍTICA DE ALTA (2026-10-20): las reglas nuevas (R7 ampliada, R9, R10,
 * R11) no nacen para que el histórico desaparezca hoy, sino para que el
 * CÓDIGO NUEVO no pueda reincidir. Por eso la deuda que aflora al
 * arreglar una regla se agrupa en UNA entrada por regla, con la lista
 * explícita de ficheros: en cuanto un fichero se migra, `--prune` lo saca
 * de la lista y la puerta vuelve a estar encendida sobre ese fichero.
 */
  const WHITELIST = [
    {
      rule: 'R1',
      files: ['components/canvas/DesignSystemProvider.tsx'],
      reason: REASONS.TOKEN_SOURCE,
      since: '2026-10-20',
      findingId: 'EGO-DL-001',
      kind: 'estructural',
    },
    {
      rule: 'R1',
      files: ['components/character/core/CharacterEngine.ts','components/character/traits/TraitRegistry.ts','components/character/transitions/CharacterMorph.ts','components/character/wardrobe/CharacterWardrobe.ts'],
      reason: REASONS.AVATAR_ENGINE,
      since: '2026-10-20',
      findingId: 'EGO-DL-002',
      kind: 'estructural',
    },
    {
      rule: 'R1',
      files: ['components/character/wardrobe/WardrobeSelector.tsx'],
      lines: [[60,75]],
      reason: REASONS.AVATAR_ENGINE,
      since: '2026-10-20',
      findingId: 'EGO-DL-003',
      kind: 'estructural',
    },
    {
      rule: 'R2',
      files: ['components/canvas/SelectionToolbar.tsx'],
      reason: REASONS.RUNTIME_POSITIONING,
      since: '2026-10-20',
      findingId: 'EGO-DL-004',
      kind: 'estructural',
    },
    {
      rule: 'R9',
      files: ['components/ui-kit/Menu.tsx','components/ui-kit/Popover.tsx','components/ui-kit/Select.tsx'],
      reason: REASONS.DEBT_RADIUS_SCALE,
      since: '2026-10-20',
      findingId: 'EGO-DL-021',
      kind: 'deuda',
    },
  ];
/* ------------------------------------------------------------------ *
 * Utilidades de bajo nivel
 * ------------------------------------------------------------------ */

/**
 * Sustituye los comentarios (de línea y de bloque) por espacios, respetando
 * la longitud y los saltos de línea del original.
 *
 * Motivo: las reglas no deben contar lo que está comentado. Un hex en un
 * comentario es documentación, no una violación; un `<select>` comentado no
 * renderiza nada. Las cadenas (string/template) NO se tocan: un hex dentro
 * de una cadena SÍ es un color real.
 */
function stripComments(src) {
  const out = src.split('');
  const n = src.length;
  let i = 0;
  let state = 'code'; // code | line | block | sq | dq | tpl
  while (i < n) {
    const c = src[i];
    const c2 = i + 1 < n ? src[i + 1] : '';
    if (state === 'code') {
      if (c === '/' && c2 === '/') {
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 2;
        state = 'line';
        continue;
      }
      if (c === '/' && c2 === '*') {
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 2;
        state = 'block';
        continue;
      }
      if (c === "'") {
        state = 'sq';
        i += 1;
        continue;
      }
      if (c === '"') {
        state = 'dq';
        i += 1;
        continue;
      }
      if (c === '`') {
        state = 'tpl';
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }
    if (state === 'line') {
      if (c === '\n') {
        state = 'code';
        i += 1;
        continue;
      }
      out[i] = ' ';
      i += 1;
      continue;
    }
    if (state === 'block') {
      if (c === '*' && c2 === '/') {
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 2;
        state = 'code';
        continue;
      }
      if (c !== '\n') out[i] = ' ';
      i += 1;
      continue;
    }
    if (state === 'sq' || state === 'dq') {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"')) {
        state = 'code';
        i += 1;
        continue;
      }
      if (c === '\n') {
        // Cadena sin cerrar: no nos comemos el resto del fichero.
        state = 'code';
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }
    // Template literal: se ignoran los `${}` anidados (aproximación
    // suficiente: un comentario dentro de un `${}` es rarísimo y el
    // contenido de un template sí puede llevar hex legítimo a tokenizar).
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '`') {
      state = 'code';
      i += 1;
      continue;
    }
    i += 1;
  }
  return out.join('');
}

/** Devuelve los rangos [ini, fin) de todas las llamadas `var(...)`. */
function computeVarSpans(src) {
  const spans = [];
  const re = /\bvar\s*\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    for (let i = open; i < src.length; i += 1) {
      const ch = src[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') {
        depth -= 1;
        if (depth === 0) {
          spans.push([m.index, i]);
          break;
        }
      }
    }
  }
  return spans;
}

/** ¿El offset cae dentro de alguno de los rangos? */
function inSpans(spans, index) {
  for (const [a, b] of spans) {
    if (index >= a && index <= b) return true;
  }
  return false;
}

/** Índice de líneas: array con el offset de inicio de cada línea. */
function buildLineIndex(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i += 1) {
    if (src[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

/** Número de línea (1-based) de un offset. */
function lineOf(lineStarts, index) {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** Quita los prefijos de variante (`hover:`, `focus-within:`, `dark:`…). */
function stripVariants(token) {
  let t = token;
  let changed = true;
  while (changed) {
    const m = /^([^\s:/]+):/.exec(t);
    if (!m) break;
    t = t.slice(m[0].length);
    changed = true;
  }
  return t;
}

/** Devuelve el nombre del tag JSX más cercano por delante de `offset`. */
function nearestJsxTagName(src, offset) {
  const limit = Math.max(0, offset - 600);
  for (let i = offset - 1; i >= limit; i -= 1) {
    if (src[i] !== '<') continue;
    const prev = i > 0 ? src[i - 1] : '';
    // Descarta comparaciones (`a < b`) y genéricos de TypeScript (`Array<string>`).
    if (prev && /[A-Za-z0-9_$)\]]/.test(prev)) continue;
    const rest = src.slice(i + 1, i + 60);
    const m = /^\/?\s*([A-Za-z][A-Za-z0-9_.-]*)/.exec(rest);
    if (m) return m[1];
  }
  return null;
}

/** Fin (índice exclusivo) de la cadena que empieza en `start`. */
function readStringEnd(src, start) {
  const quote = src[start];
  for (let i = start + 1; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '\\') {
      i += 1;
      continue;
    }
    if (ch === quote) return i + 1;
    if (ch === '\n') return -1;
  }
  return -1;
}

/** Índice de la llave `}` que cierra la `{` de `start` (o -1). */
function matchBrace(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = readStringEnd(src, i);
      if (end > 0) {
        i = end - 1;
        continue;
      }
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Fin (índice exclusivo) de una plantilla literal que empieza en `start`.
 *
 * Gestiona escapes (`\``) y el anidamiento de `${…}` (una llave dentro del
 * interpolado no cierra la plantilla).
 */
function readTemplateEnd(src, start) {
  let i = start + 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '$' && src[i + 1] === '{') {
      const close = matchBrace(src, i + 1);
      if (close < 0) return -1;
      i = close + 1;
      continue;
    }
    if (ch === '`') return i + 1;
    i += 1;
  }
  return -1;
}

/**
 * Trocea una plantilla literal en listas de clases.
 *
 * Por qué trocear y no devolver la plantilla entera: dentro de `${…}` hay
 * CÓDIGO (ternarios, `&&`, llamadas), no clases. Si la plantilla se
 * devolviera como un único blob, sus literales quedarían pegados a comillas
 * y a operadores (`"bg-emerald-500 animate-pulse"`), y ninguna regla
 * —R7, R9, R10, R11— los reconocería. Ese era el motivo por el que la
 * puerta veía 0 de una paleta cruda que estaba en el código.
 *
 * Se emiten:
 *   - los trozos de texto literal (son listas de clases), y
 *   - los literales anidados dentro de cada `${…}` (p. ej. la rama de un
 *     ternario: `"bg-emerald-500 animate-pulse"`).
 */
function collectTemplateFragments(src, start, end, base, out) {
  let chunkStart = start + 1;
  let i = start + 1;
  while (i < end - 1) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '$' && src[i + 1] === '{') {
      const chunk = src.slice(chunkStart, i);
      if (chunk.trim()) out.push({ value: chunk, start: base + chunkStart });
      const close = matchBrace(src, i + 1);
      if (close < 0) return;
      extractClassFragments(src.slice(i + 2, close), base + i + 2, out);
      i = close + 1;
      chunkStart = i;
      continue;
    }
    i += 1;
  }
  const chunk = src.slice(chunkStart, end - 1);
  if (chunk.trim()) out.push({ value: chunk, start: base + chunkStart });
}

/**
 * Extrae todas las listas de clases candidatas de una región de código.
 *
 * Cubre `"a b"`, `'a b'` y `` `a ${x} b` `` (con sus interpolados).
 */
function extractClassFragments(region, base, out) {
  let i = 0;
  while (i < region.length) {
    const ch = region[i];
    if (ch === '"' || ch === "'") {
      const end = readStringEnd(region, i);
      if (end > 0) {
        out.push({ value: region.slice(i + 1, end - 1), start: base + i });
        i = end;
        continue;
      }
    } else if (ch === '`') {
      const end = readTemplateEnd(region, i);
      if (end > 0) {
        collectTemplateFragments(region, i, end, base, out);
        i = end;
        continue;
      }
    }
    i += 1;
  }
}

/**
 * Extrae todas las listas de clases candidatas.
 *
 * Cubre `className="…"`, `className={'…'}`, `` className={`…`} `` y
 * `className={clsx("a", cond && "b")}` (cada literal de la expresión).
 * Devuelve `{ value, start }` donde `start` es el offset del valor.
 */
function extractClassNameValues(src) {
  const out = [];
  const re = /\bclassName\s*=/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    let i = m.index + m[0].length;
    while (i < src.length && /\s/.test(src[i])) i += 1;
    if (i >= src.length) continue;
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      const end = readStringEnd(src, i);
      if (end > 0) {
        out.push({ value: src.slice(i + 1, end - 1), start: i });
        re.lastIndex = end;
      }
      continue;
    }
    if (ch === '`') {
      const end = readTemplateEnd(src, i);
      if (end > 0) {
        collectTemplateFragments(src, i, end, 0, out);
        re.lastIndex = end;
      }
      continue;
    }
    if (ch === '{') {
      const close = matchBrace(src, i);
      if (close < 0) continue;
      extractClassFragments(src.slice(i + 1, close), i + 1, out);
      re.lastIndex = close;
    }
  }
  return out;
}

/** ¿La línea anterior (o la anterior saltando una línea vacía) trae el escape hatch? */
function hasAllowMarkerAbove(lines, lineNo) {
  const marker = 'design-lint: allow';
  for (const back of [1, 2]) {
    const idx = lineNo - 1 - back;
    if (idx < 0) break;
    const text = lines[idx];
    if (text === undefined) break;
    if (back === 2 && text.trim() === '') continue;
    if (text.includes(marker)) return true;
    break;
  }
  return false;
}

/* ------------------------------------------------------------------ *
 * Recorrido de ficheros
 * ------------------------------------------------------------------ */

/** ¿El path está dentro de un segmento ignorado? */
function isIgnoredPath(absPath) {
  const rel = path.relative(RENDERER_ROOT, absPath);
  const norm = rel.split(path.sep).join('/');
  if (norm.startsWith('..')) return false;
  if (IGNORED_PATH_SEGMENTS.some((seg) => norm.includes(seg))) return true;
  return false;
}

/** Lista recursiva de ficheros analizables bajo `dir`. */
function collectFiles(dir, acc) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIR_NAMES.has(entry.name)) continue;
      if (isIgnoredPath(full)) continue;
      collectFiles(full, acc);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(tsx|ts)$/.test(entry.name)) continue;
    if (IGNORED_FILE_RE.test(entry.name)) continue;
    acc.push(full);
  }
  return acc;
}

/* ------------------------------------------------------------------ *
 * Análisis de un fichero
 * ------------------------------------------------------------------ */

function analyzeFile(absPath, relPath) {
  const src = fs.readFileSync(absPath, 'utf8');
  const stripped = stripComments(src);
  const lines = src.split(/\r?\n/);
  const lineStarts = buildLineIndex(src);
  const findings = [];

  const push = (rule, index, match, message) => {
    const line = lineOf(lineStarts, index);
    findings.push({
      rule,
      severity: RULES[rule].severity,
      file: relPath,
      line,
      column: index - lineStarts[line - 1] + 1,
      match,
      message,
    });
  };

  /* --- R1: hex literal fuera de token ---------------------------- */
  const varSpans = computeVarSpans(stripped);
  const hexRe = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
  let m;
  while ((m = hexRe.exec(stripped)) !== null) {
    if (inSpans(varSpans, m.index)) continue; // fallback `var(--color-*, #hex)`: canónico
    push(
      'R1',
      m.index,
      m[0],
      `Hex literal ${m[0]} fuera de token. Úsalo como fallback var(--color-*, ${m[0]}) o como clase del sistema.`,
    );
  }

  /* --- R2: style={{ ... }} ---------------------------------------- */
  const styleRe = /style\s*=\s*\{\s*\{/g;
  while ((m = styleRe.exec(stripped)) !== null) {
    const line = lineOf(lineStarts, m.index);
    if (hasAllowMarkerAbove(lines, line)) continue; // escape hatch explícito
    push('R2', m.index, 'style={{', 'Estilo inline ad-hoc. Usa clases Tailwind sobre tokens del design system.');
  }

  /* --- R3: text-[Npx] -------------------------------------------- */
  const sizeRe = /text-\[(\d+(?:\.\d+)?)px\]/g;
  while ((m = sizeRe.exec(stripped)) !== null) {
    const size = `${m[1]}px`;
    if (ALLOWED_ARBITRARY_TEXT_SIZES.includes(size)) continue;
    push('R3', m.index, m[0], `Tamaño de fuente arbitrario ${m[0]}. Usa la escala tipográfica del sistema.`);
  }

  /* --- R6: <select> nativo ---------------------------------------- */
  // Solo se reporta la etiqueta de APERTURA: un `<select>` nativo es UNA
  // infracción, no dos (la de cierre es la misma etiqueta).
  const selectRe = /<\s*select(?=[\s/>])/g;
  while ((m = selectRe.exec(stripped)) !== null) {
    push('R6', m.index, m[0], 'El <select> nativo ignora el tema dark-only. Usa el `Select` de Radix del kit (ADR-0015).');
  }

  /* --- R4 / R5 / R7: análisis de listas de clases ---------------- */
  const candidates = extractClassNameValues(stripped);
  for (const cand of candidates) {
    const tokens = cand.value.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const bases = tokens.map(stripVariants);

    /* R4 — opacidad sobre texto. */
    const hasDimOrFaint = bases.some((b) => b === 'text-dim' || b === 'text-faint' || /^text-(dim|faint)\/\d{1,3}$/.test(b));
    const hasTextOpacity = bases.some((b) => /^text-[^\s/]+\/\d{1,3}$/.test(b));
    if (hasDimOrFaint && hasTextOpacity) {
      const offset = cand.start + 1 + cand.value.indexOf(tokens.find((t) => /^text-(dim|faint)(\/\d{1,3})?$/.test(stripVariants(t))) ?? tokens[0]);
      push('R4', offset, cand.value.trim(), 'Texto `text-dim`/`text-faint` con opacidad: rompe el AA medido (§7, prohibidas #1 y #3).');
    }
    const placeholderOpacity = tokens.find((t) => /^placeholder:/.test(t) && (/\/\d{1,3}$/.test(t) || /opacity-\d+$/.test(t)));
    if (placeholderOpacity) {
      const offset = cand.start + 1 + cand.value.indexOf(placeholderOpacity);
      push('R4', offset, placeholderOpacity, '`placeholder:` con opacidad: hunde el placeholder bajo AA (§7, prohibida #2). Usa `placeholder:text-faint` sólido.');
    }

    /* R5 — border-hairline como único indicador del input. */
    const hasHairline = bases.some((b) => b === 'border-hairline');
    const hasStrong = bases.some((b) => b === 'border-strong' || b === 'border-border-strong');
    // `focus` se busca en el token CRUDO (no en la base sin variantes): el
    // segundo indicador puede ser `focus:border-ink`, `focus-within:…` o
    // `focus:ring-1`; al quitar el prefijo de variante se perdería.
    const hasFocus = tokens.some((t) => t.includes('focus'));
    if (hasHairline && !hasStrong && !hasFocus) {
      const tag = nearestJsxTagName(stripped, cand.start);
      if (tag && INPUT_LIKE_TAGS.has(tag.toLowerCase())) {
        push('R5', cand.start, cand.value.trim(), `Input (${tag}) con \`border-hairline\` como único indicador: añade un segundo indicador (§7, prohibida #4).`);
      }
    }

    /* R7 — color de paleta crudo.
     *
     * Se eliminó la exención "si la MISMA lista lleva el token equivalente".
     * Por qué: dos utilidades de color que compiten por la MISMA propiedad
     * CSS (`text-white` + `text-ink`) NO se anulan — la cascada de Tailwind
     * resuelve por orden de generación del CSS, no por orden textual de la
     * lista, así que el resultado es indeterminado para quien lee el código.
     * `text-white` + `text-ink` es un CONFLICTO, no una corrección; y
     * `bg-white` + `bg-paper` es un conflicto de superficie. La exención
     * convertía el conflicto en silencio y dejaba la puerta ciega
     * justo en los ficheros que mezclaban color crudo con tokens.
     *
     * Única exención que queda: el SCRIM (`bg-black/N` con firma de overlay).
     * Es una cortina, no un color de tema. */
    const hasOverlaySignature =
      bases.some((b) => b === 'inset-0' || b === 'inset-x-0' || b === 'inset-y-0') &&
      bases.some((b) => OVERLAY_POSITIONS.has(b));
    for (let ti = 0; ti < tokens.length; ti += 1) {
      const raw = RAW_COLOR_RE.exec(stripVariants(tokens[ti]));
      if (!raw) continue;
      if (SCRIM_RE.test(stripVariants(tokens[ti])) && hasOverlaySignature) continue;
      const offset = cand.start + 1 + cand.value.indexOf(tokens[ti]);
      push('R7', offset, tokens[ti], `Color de paleta crudo \`${tokens[ti]}\` fuera de los tokens del sistema. Usa \`text-success\`/\`text-error\`/\`text-warning\`/\`text-brand\`.`);
    }

    /* R9 — radio fuera de la escala de 3 pasos. */
    for (let ti = 0; ti < tokens.length; ti += 1) {
      const base = stripVariants(tokens[ti]);
      const m9 = RADIUS_RE.exec(base);
      if (!m9) continue;
      const size = m9[1];
      if (size === undefined) {
        // `rounded` a secas o `rounded-t` sin lado: 0.25rem = 4px.
        const offset = cand.start + 1 + cand.value.indexOf(tokens[ti]);
        push('R9', offset, tokens[ti], `Radio \`${tokens[ti]}\` fuera de escala (4px). Usa \`rounded-md\` (6px), \`rounded-[var(--radius-card)]\` (8px) o \`rounded-full\`.`);
        continue;
      }
      if (size.startsWith('[') && size.endsWith(']')) {
        const arbitrary = size.slice(1, -1);
        if (RADIUS_ALLOWED_ARBITRARY.includes(arbitrary)) continue;
        const offset = cand.start + 1 + cand.value.indexOf(tokens[ti]);
        push('R9', offset, tokens[ti], `Radio arbitrario \`${tokens[ti]}\` fuera de escala. Usa \`rounded-[var(--radius-card)]\` (8px) o \`rounded-md\` (6px).`);
        continue;
      }
      if (RADIUS_ALLOWED_SIZES.includes(size)) continue;
      const offset = cand.start + 1 + cand.value.indexOf(tokens[ti]);
      push('R9', offset, tokens[ti], `Radio \`${tokens[ti]}\` fuera de la escala de 3 pasos. Usa \`rounded-md\` (6px), \`rounded-[var(--radius-card)]\` (8px) o \`rounded-full\`.`);
    }

    /* R10 — cabecera fuera del chrome unificado (`h-11`).
     *
     * Criterio (documentado a propósito): sólo es error si la clase tiene
     * SIGNOS de chrome. Un `h-12` en una barra de cabecera salta; un
     * `h-12 w-12` en una celda-icono NO salta, porque no es una cabecera.
     * Signs de chrome: el tag es `<header>`, o la lista lleva un marcador
     * de barra (`border-b`, `border-t`, `backdrop-blur`, `uppercase`). */
    const enforcedHeights = HEADER_HEIGHTS_ENFORCED.filter((h) => bases.includes(h));
    if (enforcedHeights.length > 0) {
      const tag = nearestJsxTagName(stripped, cand.start);
      const isHeaderTag = tag !== null && tag.toLowerCase() === 'header';
      const hasChromeMarker = bases.some((b) => HEADER_CHROME_MARKERS.includes(b));
      if (isHeaderTag || hasChromeMarker) {
        for (const h of enforcedHeights) {
          const offset = cand.start + 1 + cand.value.indexOf(h);
          push('R10', offset, h, `Cabecera de ${h}: el chrome unificado mide \`h-11\` (44px) en todas las vistas.`);
        }
      }
    }

    /* R11 — superficie derivada con alfa.
     *
     * Las superficies del sistema son 3 niveles SÓLIDOS. `bg-panel/95` no
     * es "panel un poco transparente": es un color que no existe en la
     * rampa y que no se puede comparar con los otros dos niveles. */
    for (let ti = 0; ti < tokens.length; ti += 1) {
      const m11 = DERIVED_SURFACE_RE.exec(stripVariants(tokens[ti]));
      if (!m11) continue;
      const alpha = m11[2];
      if (alpha === '100') continue;
      const offset = cand.start + 1 + cand.value.indexOf(tokens[ti]);
      push('R11', offset, tokens[ti], `Superficie derivada con alfa \`${tokens[ti]}\`. Las superficies son sólidas: \`bg-paper\` · \`bg-panel\` · \`bg-raised\`.`);
    }
  }

  /* --- R8: métrica de controles nativos crudos -------------------- */
  // El kit (`components/ui-kit/`) queda FUERA de la métrica: ver
  // `R8_EXCLUSIONS`.
  const rawControls = { button: 0, input: 0, textarea: 0 };
  const inUiKit = R8_EXCLUSIONS.some((exclusion) => relPath.startsWith(exclusion.prefix));
  if (!inUiKit) {
    const controlRe = /<\s*(button|input|textarea)(?=[\s/>])/g;
    while ((m = controlRe.exec(stripped)) !== null) {
      const kind = m[1];
      if (kind === 'button') rawControls.button += 1;
      else if (kind === 'input') rawControls.input += 1;
      else rawControls.textarea += 1;
    }
  }
  const total = rawControls.button + rawControls.input + rawControls.textarea;
  if (total > 0) {
    findings.push({
      rule: 'R8',
      severity: RULES.R8.severity,
      file: relPath,
      line: 1,
      column: 1,
      match: `${rawControls.button} button / ${rawControls.input} input / ${rawControls.textarea} textarea`,
      message: 'Controles nativos crudos: migra al kit `ui-kit/` (Button/Input) para ganar los 9 estados y el target táctil.',
    });
  }

  return { findings, rawControls, rawTotal: total };
}

/* ------------------------------------------------------------------ *
 * Lista blanca: aplicación y auditoría
 * ------------------------------------------------------------------ */

/** Los ficheros de una entrada de lista blanca. */
function whitelistFiles(entry) {
  if (Array.isArray(entry.files)) return entry.files;
  if (typeof entry.file === 'string') return [entry.file];
  return [];
}

/** ¿La entrada cubre este hallazgo? */
function whitelistMatches(entry, finding) {
  if (entry.rule !== finding.rule) return false;
  const files = whitelistFiles(entry);
  if (!files.includes(finding.file)) return false;
  if (Array.isArray(entry.lines) && entry.lines.length > 0) {
    const inRange = entry.lines.some((range) => {
      if (Array.isArray(range)) return finding.line >= range[0] && finding.line <= range[1];
      return finding.line === range;
    });
    if (!inRange) return false;
  }
  if (typeof entry.match === 'string' && entry.match.length > 0) {
    if (!finding.match.includes(entry.match)) return false;
  }
  return true;
}

/**
 * Índice inverso: `${rule}|${file}` → entradas de la lista blanca.
 * El separador es `|` (y no un espacio) para que un path o un match con
 * espacios no pueda colisionar con otro par regla/fichero.
 */
function buildWhitelistIndex() {
  const index = new Map();
  for (const entry of WHITELIST) {
    for (const file of whitelistFiles(entry)) {
      const key = `${entry.rule}|${file}`;
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(entry);
    }
  }
  return index;
}

/* ------------------------------------------------------------------ *
 * Orquestación
 * ------------------------------------------------------------------ */

function toPosix(p) {
  return p.split(path.sep).join('/');
}

/**
 * Ejecuta el linter.
 * @param {string[]} targetDirs Directorios a analizar (absolutos).
 * @param {string} baseDir      Base para las rutas relativas del informe.
 */
function runLint(targetDirs, baseDir) {
  const files = [];
  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) continue;
    collectFiles(dir, files);
  }
  files.sort();

  const whitelistIndex = buildWhitelistIndex();
  const findings = [];
  const suppressed = [];
  const staleWhitelist = [];
  const rawControlsByFile = {};
  const rawControlsByKind = { button: 0, input: 0, textarea: 0 };
  let rawControlsTotal = 0;
  const internalErrors = [];

  const usedWhitelistEntries = new Set();
  const scannedFiles = new Set();

  for (const abs of files) {
    let rel = path.relative(RENDERER_ROOT, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      rel = path.relative(baseDir, abs);
    }
    rel = toPosix(rel);
    if (TOKEN_FILES.includes(rel)) continue;
    scannedFiles.add(rel);

    let result;
    try {
      result = analyzeFile(abs, rel);
    } catch (err) {
      // Robustez: un fichero exótico nunca debe tumbar la puerta.
      internalErrors.push({ file: rel, message: err && err.message ? err.message : String(err) });
      continue;
    }

    if (result.rawTotal > 0) {
      rawControlsByFile[rel] = {
        button: result.rawControls.button,
        input: result.rawControls.input,
        textarea: result.rawControls.textarea,
        total: result.rawTotal,
      };
      rawControlsByKind.button += result.rawControls.button;
      rawControlsByKind.input += result.rawControls.input;
      rawControlsByKind.textarea += result.rawControls.textarea;
      rawControlsTotal += result.rawTotal;
    }

    for (const finding of result.findings) {
      const candidates = whitelistIndex.get(`${finding.rule}|${finding.file}`) || [];
      const entry = candidates.find((e) => whitelistMatches(e, finding));
      if (entry) {
        usedWhitelistEntries.add(`${entry.findingId || ''}|${finding.rule}|${finding.file}`);
        suppressed.push({
          ...finding,
          reason: entry.reason,
          since: entry.since,
          findingId: entry.findingId || null,
          kind: entry.kind || 'deuda',
        });
        continue;
      }
      findings.push(finding);
    }
  }

  // Auditoría de la lista blanca: una entrada que ya no suprime nada está
  // rota (la infracción se corrigió) y debe retirarse de la tabla.
  // Solo se auditan los ficheros que están dentro del alcance escaneado:
  // al analizar un directorio ajeno (fixture de test) las entradas del
  // renderer no son "obsoletas", sencillamente no aplican.
  for (const entry of WHITELIST) {
    for (const file of whitelistFiles(entry)) {
      if (!scannedFiles.has(file)) continue;
      const key = `${entry.findingId || ''}|${entry.rule}|${file}`;
      if (!usedWhitelistEntries.has(key)) {
        staleWhitelist.push({
          rule: entry.rule,
          file,
          reason: entry.reason,
          since: entry.since,
          findingId: entry.findingId || null,
        });
      }
    }
  }

  findings.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));
  suppressed.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));

  const byRule = {};
  for (const rule of Object.keys(RULES)) {
    byRule[rule] = {
      severity: RULES[rule].severity,
      title: RULES[rule].title,
      count: findings.filter((f) => f.rule === rule).length,
      suppressed: suppressed.filter((f) => f.rule === rule).length,
    };
  }

  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseDir: toPosix(baseDir),
    filesScanned: files.length,
    rules: byRule,
    findings,
    suppressed,
    staleWhitelist,
    internalErrors,
    rawControls: {
      total: rawControlsTotal,
      byKind: rawControlsByKind,
      byFile: rawControlsByFile,
    },
    whitelist: WHITELIST.map((e) => ({
      rule: e.rule,
      files: whitelistFiles(e),
      lines: e.lines || null,
      match: e.match || null,
      reason: e.reason,
      since: e.since,
      findingId: e.findingId || null,
      kind: e.kind || 'deuda',
    })),
    allowedArbitraryTextSizes: ALLOWED_ARBITRARY_TEXT_SIZES.slice(),
    /**
     * Las ESCALAS FIJAS del design system, en forma machine-readable.
     *
     * Por qué se publican: las escalas (`docs/design/design-system.md` §1)
     * son el contrato que R7/R9/R10/R11 hacen cumplir. Si el contrato
     * vive sólo en el código, un cambio de escala es invisible; publicarlo
     * permite que el test verifique que la puerta y la doc dicen lo mismo.
     */
    scales: {
      palette: {
        rawFamilies: RAW_PALETTE_FAMILIES.slice(),
        colorUtilities: COLOR_UTILITIES.slice(),
        tokens: ['success', 'warning', 'error', 'brand', 'chart-indigo', 'chart-violet'],
        scrim: { pattern: 'bg-black/N', requiresOverlaySignature: true },
      },
      radius: {
        allowedSizes: RADIUS_ALLOWED_SIZES.slice(),
        allowedArbitrary: RADIUS_ALLOWED_ARBITRARY.slice(),
      },
      surfaces: {
        solid: SURFACE_TOKENS.map((t) => `bg-${t}`),
        derivedWithAlpha: 'error',
      },
      headerHeights: {
        enforced: HEADER_HEIGHTS_ENFORCED.slice(),
        recognized: HEADER_HEIGHTS_RECOGNIZED.slice(),
        chromeMarkers: HEADER_CHROME_MARKERS.slice(),
      },
    },
    r8Exclusions: R8_EXCLUSIONS.map((e) => ({ prefix: e.prefix, reason: e.reason })),
    summary: {
      errors,
      warnings,
      total: findings.length,
      suppressed: suppressed.length,
    },
    ok: errors === 0,
  };
}

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

function parseArgs(argv) {
  const opts = { json: false, quiet: false, help: false, prune: false, targets: [] };
  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--quiet') opts.quiet = true;
  else if (arg === '--prune') opts.prune = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('--')) continue; // flags desconocidas: se ignoran
    else opts.targets.push(arg);
  }
  return opts;
}

function printReport(report) {
  const out = [];
  out.push('design-lint — puerta de calidad del design system de Ego');
  out.push(`Raíz: ${report.baseDir}`);
  out.push(`Ficheros analizados: ${report.filesScanned}`);
  out.push('');
  out.push('Reglas');
  for (const rule of Object.keys(RULES)) {
    const r = report.rules[rule];
    const badge = r.severity === 'error' ? 'ERROR' : 'AVISO';
    out.push(`  ${rule} [${badge}] ${r.title} — ${r.count} ${r.severity === 'error' ? 'errores' : 'avisos'}${r.suppressed ? ` (${r.suppressed} granfathered)` : ''}`);
  }
  out.push('');

  const byRule = new Map();
  for (const f of report.findings) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, []);
    byRule.get(f.rule).push(f);
  }
  for (const [rule, list] of byRule) {
    out.push(`── ${rule} · ${RULES[rule].title} ──`);
    for (const f of list) {
      out.push(`  ${f.file}:${f.line}:${f.column}  ${f.match}  — ${f.message}`);
    }
    out.push('');
  }

  if (report.staleWhitelist.length > 0) {
    out.push('── Lista blanca obsoleta (retirar) ──');
    for (const s of report.staleWhitelist) {
      out.push(`  ${s.rule} ${s.file} (${s.findingId || 'sin ID'}) — ya no suprime nada`);
    }
    out.push('');
  }

  out.push('Métrica de adopción del kit (R8)');
  out.push(`  controles nativos crudos: ${report.rawControls.total} ` +
    `(button ${report.rawControls.byKind.button}, input ${report.rawControls.byKind.input}, textarea ${report.rawControls.byKind.textarea})`);
  const files = Object.entries(report.rawControls.byFile).sort((a, b) => b[1].total - a[1].total);
  for (const [file, c] of files) {
    out.push(`    ${file}: ${c.total} (button ${c.button}, input ${c.input}, textarea ${c.textarea})`);
  }
  out.push('');

  out.push(
    `Resumen: ${report.summary.errors} errores · ${report.summary.warnings} advertencias · ` +
      `${report.summary.total} hallazgos · ${report.summary.suppressed} granfathered`,
  );
  out.push(`Estado: ${report.ok ? 'PASA' : 'FALLA'}`);
  return out.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(
      [
        'Uso: node design-lint.cjs [dir...] [--json] [--quiet] [--prune]',
        '',
        'Sin argumentos analiza apps/desktop/renderer/{components,src,floating}.',
        'Con directorios analiza esos directorios (útil para fixtures de test).',
        '',
        'Salida: 0 = pasa · 1 = hay errores (R1-R7, R9-R11) · 2 = error de uso.',
        'R8 es métrica de adopción del kit: avisa, no bloquea.',
      ].join('\n'),
    );
    return 0;
  }

  const targetDirs = opts.targets.length > 0 ? opts.targets.map((t) => path.resolve(t)) : DEFAULT_TARGETS.map((t) => path.join(RENDERER_ROOT, t));
  const baseDir = opts.targets.length > 0 ? path.resolve(opts.targets[0]) : RENDERER_ROOT;

  let report;
  try {
    report = runLint(targetDirs, baseDir);
  } catch (err) {
    console.error('design-lint: fallo interno —', err && err.stack ? err.stack : err);
    return 2;
  }

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (!opts.quiet) {
    console.log(printReport(report));
  }

  if (opts.prune) {
    console.log('');
    console.log('--- WHITELIST podada (pegar en design-lint.cjs) ---');
    console.log(pruneWhitelist(report));
  }

  if (report.internalErrors.length > 0) {
    for (const ie of report.internalErrors) {
      console.error(`design-lint: no se pudo analysing ${ie.file}: ${ie.message}`);
    }
  }

  return report.ok ? 0 : 1;
}

/**
 * Poda la lista blanca: elimina los ficheros de cada entrada que ya NO
 * suprimen ningún hallazgo, y las entradas que quedan vacías.
 *
 * Por qué existe: la lista blanca es un REGISTRO DE DEUDA. Cuando una capa
 * se migra al design system, sus entradas tienen que morir; si no, la
 * puerta "pasa" por exemptions muertas y la deuda real queda invisible.
 * Con `--prune` la poda es mecánica y su diff es auditable.
 *
 * No inventa entradas nuevas: si aparece un hallazgo fuera de la lista
 * blanca, se reporta como ERROR (que es lo correcto) y el podador no lo
 * encubre.
 */
function pruneWhitelist(report) {
  // `findings` = no suprimidas; `suppressed` = las que hoy cubre la lista
  // blanca. Para podar hacen falta AMBAS: una entrada sigue viva si cubre
  // algún hallazgo, esté o no suprimido.
  const findings = [...(report.findings || []), ...(report.suppressed || [])];
  const kept = [];
  const removed = [];
  for (const entry of WHITELIST) {
    const files = whitelistFiles(entry);
    const stillViolating = files.filter((f) =>
      findings.some((finding) => whitelistMatches({ ...entry, files: [f] }, finding)),
    );
    if (stillViolating.length === 0) {
      removed.push({ id: entry.findingId, rule: entry.rule, files });
      continue;
    }
    if (stillViolating.length < files.length) {
      removed.push({
        id: entry.findingId,
        rule: entry.rule,
        files: files.filter((f) => !stillViolating.includes(f)),
      });
    }
    const next = { ...entry, files: stillViolating };
    if (!Array.isArray(next.files) || next.files.length === 0) delete next.files;
    if (typeof next.file === 'string') delete next.file;
    kept.push(next);
  }
  const reasonKeyOf = (reason) => {
    const hit = Object.keys(REASONS).find((k) => REASONS[k] === reason);
    return hit || 'TOKEN_SOURCE';
  };
  const body = kept
    .map((e) => {
      const parts = [
        `      rule: '${e.rule}',`,
        `      files: ${JSON.stringify(e.files || []).replace(/"/g, "'")},`,
      ];
      if (e.lines) parts.push(`      lines: ${JSON.stringify(e.lines)},`);
      if (e.match) parts.push(`      match: '${e.match}',`);
      parts.push(`      reason: REASONS.${reasonKeyOf(e.reason)},`);
      parts.push(`      since: '${e.since}',`);
      parts.push(`      findingId: '${e.findingId}',`);
      parts.push(`      kind: '${e.kind}',`);
      return `    {\n${parts.join('\n')}\n    },`;
    })
    .join('\n');
  if (removed.length > 0) {
    console.error('--- PODADO ---');
    for (const r of removed) {
      console.error(`  ${r.id} (${r.rule}): ${r.files.join(', ')}`);
    }
  }
  // La plantilla genera el bloque listo para pegar; el cuerpo se construye
  // con `body` (una entrada por excepcion viva).
  return `  const WHITELIST = [
${body}
  ];`;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  RULES,
  REASONS,
  WHITELIST,
  ALLOWED_ARBITRARY_TEXT_SIZES,
  TOKEN_FILES,
  RENDERER_ROOT,
  RAW_PALETTE_FAMILIES,
  COLOR_UTILITIES,
  RADIUS_ALLOWED_SIZES,
  RADIUS_ALLOWED_ARBITRARY,
  HEADER_HEIGHTS_ENFORCED,
  HEADER_HEIGHTS_RECOGNIZED,
  HEADER_CHROME_MARKERS,
  SURFACE_TOKENS,
  runLint,
  stripComments,
  computeVarSpans,
  extractClassNameValues,
  analyzeFile,
  main,
};