/**
 * Spec COMPARTIDO de la auditoría de diseño.
 *
 * ## Por qué este fichero existe (Ola 4 · T3)
 * La auditoría tenía un único camino: el runtime de `ego lite` (ego-lite
 * 0.6.0 + skill v2.1.0), cuyo **compositor puede dejar de producir frames**.
 * Cuando eso pasaba, la corrida se perdía entera: 0/6 capturas y un
 * informe que no distinguía "el compositor murió" de "la app está rota".
 *
 * La auditoría ahora tiene DOS caminos que comparten **el mismo spec**:
 *
 *   - `ego-browser-audit.mjs` → el runtime de ego lite (el camino de
 *     referencia: ve la app real, con su ventana real).
 *   - `design-audit-headless.mjs` → Chromium headless vía Playwright (el
 *     camino de RESCATE: no depende del compositor).
 *
 * **Los selectores, el contrato y la medición viven AQUÍ**, no duplicados
 * en cada runner: así el camino de rescate no puede divergir del de
 * referencia (que es justo lo que el brief prohíbe: "no rompas los
 * selectores por defecto ni el fallback por CDP").
 *
 * ## Sintaxis de localizador
 * `loc=role:button[name='Work']` · `loc=css:nav[aria-label='Icon Rail'] …`
 * `loc=text:Continuar` · `loc=label:Correo`
 *
 * El runner de ego lite usa su propio DSL (que acepta la misma sintaxis);
 * el headless la resuelve con `resolveLocator()` de este fichero.
 */

/* ------------------------------------------------------------------ *
 * Contrato de diseño (docs/design/design-system.md §1)
 * ------------------------------------------------------------------ */
export const CONTRACT = {
  fontSizes: [12, 14, 16],
  radii: [0, 6, 8, 9999],
  headerHeight: 44,
  minTarget: 24,
  iconTarget: 44,
};

/* ------------------------------------------------------------------ *
 * Medición dentro de la página.
 *
 * El callback NO puede cerrar variables del script: todo lo que necesita
 * entra por el argumento. Es código de página: se serializa y se ejecuta
 * dentro del navegador.
 * ------------------------------------------------------------------ */
export const MEASURE = (contract) => {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  const path = (el) => {
    const parts = [];
    let n = el;
    while (n && n.nodeType === 1 && parts.length < 4) {
      let s = n.tagName.toLowerCase();
      if (n.id) {
        s += `#${n.id}`;
        parts.unshift(s);
        break;
      }
      const cls = (n.getAttribute?.("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) s += "." + cls.join(".");
      parts.unshift(s);
      n = n.parentElement;
    }
    return parts.join(" > ");
  };
  const round = (n) => Math.round(n * 100) / 100;

  const fonts = new Map();
  const radii = new Map();
  const shadows = new Map();
  const bgs = new Map();
  const violations = [];
  const add = (map, key) => map.set(key, (map.get(key) || 0) + 1);

  const all = Array.from(document.querySelectorAll("*")).filter(visible);
  for (const el of all) {
    const s = getComputedStyle(el);
    const txt = (el.textContent || "").trim();
    const leaf = el.children.length === 0 && txt.length > 0;

    if (leaf) {
      const fs = round(parseFloat(s.fontSize));
      add(fonts, fs);
      if (fs > 0 && !contract.fontSizes.includes(fs)) {
        violations.push({ rule: "TIPOGRAFIA", value: fs, expected: contract.fontSizes, selector: path(el) });
      }
    }
    const br = round(parseFloat(s.borderTopLeftRadius));
    if (br > 0) {
      // Tailwind v4 define `rounded-full` como `border-radius: calc(infinity
      // * 1px)`: el navegador lo resuelve a un valor enorme (33554400 px en
      // Chromium). Sin normalizar, CADA elemento redondeado del app era un
      // falso positivo de la regla RADIO. Se normaliza al radio "full"
      // (9999) que el contrato permite — la regla sigue atrapando los
      // radios fuera de escala (2, 4, 12 px…).
      const norm = br >= 9999 ? 9999 : br;
      add(radii, norm);
      const ok = contract.radii.some((r) => Math.abs(r - norm) < 0.6);
      if (!ok) violations.push({ rule: "RADIO", value: norm, expected: contract.radii, selector: path(el) });
    }
    const sh = s.boxShadow;
    if (sh && sh !== "none") add(shadows, sh);
    const bg = s.backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") add(bgs, bg);

    if (el.tagName === "HEADER" || el.getAttribute?.("role") === "banner") {
      const h = round(el.getBoundingClientRect().height);
      if (h > 0 && Math.abs(h - contract.headerHeight) > 1.5) {
        violations.push({ rule: "CABECERA", value: h, expected: contract.headerHeight, selector: path(el) });
      }
    }
    if (el.tagName === "BUTTON" || el.getAttribute?.("role") === "button") {
      const r = el.getBoundingClientRect();
      const hasText = (el.innerText || "").trim().length > 0;
      const min = hasText ? contract.minTarget : contract.iconTarget;
      if (r.height > 0 && r.height < min - 0.5) {
        violations.push({
          rule: hasText ? "TARGET" : "TARGET_ICONO",
          value: round(r.height),
          expected: min,
          selector: path(el),
        });
      }
    }
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      const s2 = getComputedStyle(el);
      // El texto `sr-only` (visualmente oculto) se recorta A PROPÓSITO: su
      // caja es de 1×1 px y el contenido se desborda por diseño (es la
      // técnica del "clip", no un defecto de layout). Sin esta excepción,
      // cada texto accesible de la app era un falso positivo de DESBORDE.
      const visuallyHidden = !!el.closest?.(".sr-only");

      // El `scrollWidth` también cuenta el desbordamiento de los
      // descendientes ABSOLUTOS (el halo `animate-ping`, un badge, un
      // tooltip): eso no empuja el layout, se pinta encima a propósito.
      // El defecto real es:
      //   (a) que un hijo EN FLUJO se salga de la caja visible, o
      //   (b) que el propio texto se salga y NADIE lo explique (un absoluto).
      const er = el.getBoundingClientRect();
      const borderRight = er.left + el.offsetWidth;
      let inFlowRight = borderRight;
      for (const c of el.children) {
        const cs = getComputedStyle(c);
        if (cs.position === "absolute" || cs.position === "fixed") continue;
        inFlowRight = Math.max(inFlowRight, c.getBoundingClientRect().right);
      }
      let absRight = borderRight;
      for (const d of el.querySelectorAll("*")) {
        const ds = getComputedStyle(d);
        if (ds.position !== "absolute" && ds.position !== "fixed") continue;
        absRight = Math.max(absRight, d.getBoundingClientRect().right);
      }
      const excess = el.scrollWidth - el.clientWidth;
      const inFlowExceeds = inFlowRight > borderRight + 2;
      // ¿Un descendiente ABSOLUTO explica el exceso? La comparación NO usa
      // píxeles exactos: el halo `animate-ping` cambia de tamaño con la
      // animación, así que una comparación exacta hacía la auditoría
      // NO REPRODUCIBLE (a veces 2 infracciones, a veces 0). Basta con que
      // el absoluto llegue MÁS ALLA del contenido en flujo: entonces el
      // exceso es suyo (un adorno que se pinta encima), no del layout.
      const absExplains = absRight > inFlowRight + 2;

      if (
        s2.overflowX === "visible" &&
        s2.overflow === "visible" &&
        !visuallyHidden &&
        (inFlowExceeds || !absExplains)
      ) {
        violations.push({
          rule: "DESBORDE",
          value: round(excess),
          expected: 0,
          selector: path(el),
        });
      }
    }
  }

  const toObj = (m) => Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
  const byRule = {};
  for (const v of violations) (byRule[v.rule] ||= []).push(v);
  return {
    counts: { elements: all.length, violations: violations.length },
    fonts: toObj(fonts),
    radii: toObj(radii),
    shadows: toObj(shadows),
    backgrounds: toObj(bgs),
    byRule,
    sample: Object.fromEntries(Object.entries(byRule).map(([k, v]) => [k, v.slice(0, 12)])),
  };
};

/* ------------------------------------------------------------------ *
 * COLOR: la auditoría visual medía geometría, no color (Ola 5 · T4)
 * ------------------------------------------------------------------ */

/**
 * Pares de tokens que deben ser **distinguibles** entre sí.
 *
 * El hueco que dejó pasar la colisión `brand ≡ warning`: los dos tokens
 * eran el MISMO RGB, así que ninguna medición geométrica podía notarlo y
 * un icono de dominio `brand` salía idéntico a uno de `warning`.
 */
export const DISTINGUISHABLE_TOKEN_PAIRS = Object.freeze([
  ["brand", "warning"],
  ["brand", "error"],
  ["brand", "success"],
  ["warning", "error"],
  ["success", "error"],
  ["text", "dim"],
  ["dim", "faint"],
]);

/** Convierte un color (OKLCH o HEX) a RGB 0..255. */
export function colorToRgb(value) {
  if (value.startsWith("#")) {
    const h = value.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  const m = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!m) return null;
  const L = Number(m[1]);
  const C = Number(m[2]);
  const H = Number(m[3]);
  const rad = (H * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const mm = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  const enc = (c) => {
    const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(v * 255)));
  };
  return lin.map(enc);
}

/** Lee los tokens de un preset del `DesignSystemProvider` (fuente única). */
export function readDesignTokens(providerSource, presetName) {
  const at = providerSource.indexOf(`"${presetName}"`);
  if (at < 0) return {};
  const colorsAt = providerSource.indexOf("colors:", at);
  if (colorsAt < 0) return {};
  const open = providerSource.indexOf("{", colorsAt);
  const close = providerSource.indexOf("}", open);
  const body = providerSource.slice(open + 1, close);
  const out = {};
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^\s*([a-zA-Z]+)\s*:\s*"([^"]+)"\s*,?\s*$/);
    if (m && m[1] && m[2]) out[m[1]] = m[2];
  }
  return out;
}

/**
 * Colisiones entre tokens que deben ser distinguibles.
 *
 * @returns [{ a, b, rgb }] — un par cuyos tokens tienen el MISMO color.
 */
export function findTokenCollisions(tokens, pairs = DISTINGUISHABLE_TOKEN_PAIRS) {
  const collisions = [];
  for (const [a, b] of pairs) {
    const va = tokens[a];
    const vb = tokens[b];
    if (!va || !vb) continue;
    const ra = colorToRgb(va);
    const rb = colorToRgb(vb);
    if (!ra || !rb) continue;
    if (ra[0] === rb[0] && ra[1] === rb[1] && ra[2] === rb[2]) {
      collisions.push({ a, b, rgb: ra });
    }
  }
  return collisions;
}

/**
 * Muestrea los píxeles REALES de una captura (no los estilos calculados).
 *
 * La captura PNG se dibuja en un canvas dentro del navegador y se leen sus
 * píxeles con `getImageData`: es la salida real del compositor.
 *
 * Devuelve el color DOMINANTE (el fondo de la superficie) y la paleta
 * observada (los colores distintos, con su frecuencia).
 */
export async function sampleScreenshotColors(page, pngBuffer) {
  const dataUrl = `data:image/png;base64,${Buffer.from(pngBuffer).toString("base64")}`;
  return page.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { error: "sin contexto 2d" };
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const counts = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const palette = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([rgb, count]) => ({ rgb, count }));
    // El fondo: el color del pixel (2, 2) (la esquina superior izquierda).
    const corner = `${data[0]},${data[1]},${data[2]}`;
    return {
      width: canvas.width,
      height: canvas.height,
      corner,
      dominant: palette[0]?.rgb ?? corner,
      palette,
    };
  }, dataUrl);
}

/**
 * Compara el color observado con el token esperado (tolerancia por canal).
 */
export function colorsMatch(observedRgb, expectedToken, tolerance = 3) {
  const expected = colorToRgb(expectedToken);
  if (!expected) return false;
  const parts = String(observedRgb).split(",").map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return false;
  return parts.every((c, i) => Math.abs(c - expected[i]) <= tolerance);
}

/* ------------------------------------------------------------------ *
 * Spec por defecto: la app de Ego
 * ------------------------------------------------------------------ */
export const DEFAULT_STEPS = {
  steps: [
    { id: "01-chat-vacio", note: "Chat: empty-state" },
    { id: "02-work", click: "loc=role:button[name='Work']", wait: 1200 },
    {
      id: "03-subegos",
      click: "loc=css:nav[aria-label='Icon Rail'] button[aria-label='Sub-Egos Fábrica']",
      wait: 1200,
    },
    {
      id: "04-personalizacion",
      click: "loc=css:nav[aria-label='Icon Rail'] button[aria-label='Personalización']",
      wait: 1200,
    },
    {
      // Ola 5 · T4: el avatar NUNCA se auditaba en modo canvas: el
      // `WardrobeSelector` sólo se monta en la pestaña "Avatares y Mascota"
      // de Personalización, que la auditoría no abría.
      id: "04b-avatares-canvas",
      click: "loc=role:button[name='Avatares y Mascota']",
      wait: 1800,
      note: "Canvas de avatares (WardrobeSelector)",
    },
    {
      id: "05-perfil",
      click: "loc=css:nav[aria-label='Icon Rail'] button[aria-label='Perfil de usuario y configuración']",
      wait: 1200,
    },
    { id: "06-omnibar", key: "ControlOrMeta+K", wait: 1500 },
  ],
};

/* ------------------------------------------------------------------ *
 * Resolución de localizadores (para el runner headless)
 * ------------------------------------------------------------------ */

/**
 * Convierte la sintaxis `loc=…` en un localizador de Playwright.
 *
 * @param {import("playwright").Page} page
 * @param {string} spec
 * @returns {import("playwright").Locator | null} `null` si la sintaxis no es
 *   `loc=` (el runner entonces usa `page.click(spec)` crudo).
 */
export function resolveLocator(page, spec) {
  if (typeof spec !== "string" || !spec.startsWith("loc=")) return null;
  const body = spec.slice(4);
  const sep = body.indexOf(":");
  if (sep < 0) return page.locator(body);
  const kind = body.slice(0, sep);
  const rest = body.slice(sep + 1);

  if (kind === "css") return page.locator(rest);
  if (kind === "text") return page.getByText(rest);
  if (kind === "label") return page.getByLabel(rest);
  if (kind === "role") {
    // `button[name='Work']` → getByRole("button", { name: "Work" })
    const m = rest.match(/^([a-zA-Z]+)\s*\[(.*)\]$/);
    if (!m) return page.getByRole(rest);
    const role = m[1];
    const attrs = m[2] ?? "";
    const name = attrs.match(/name\s*=\s*['"]([^'"]*)['"]/);
    if (name) return page.getByRole(role, { name: name[1], exact: true });
    return page.getByRole(role);
  }
  return page.locator(rest);
}
