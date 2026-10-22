// profile.js — el perfil declarativo del personaje (EGO-FIND-116).
//
// IMPLEMENTACIÓN PROPIA DE EGO: este fichero no es un port de ningún upstream.
//
// QUÉ RESUELVE: el renderer persiste un perfil {baseForm, traits[], outfitId} y
// lo pasa al elemento como los atributos `base-form`, `traits` (JSON) y
// `outfit`. Hasta ahora el elemento no los observaba: el perfil persistía,
// hacía round-trip… y el motor seguía pintando el del generador.
//
// QUÉ HACE ESTE MÓDULO: traduce el vocabulario del perfil (que vive en el
// renderer) al que el motor **sí sabe expresar**: la silueta del genoma, su
// apéndice, su marca, su aura y el accesorio del studio.
//
// LA INTENSIDAD (petición de A4, Ola 12): el atributo `traits` transporta
// dos formas — la de siempre, `["halo"]`, y la canónica con intensidad,
// `[{"kind":"halo","intensity":0.4}]`. El motor la expresa con las palancas
// que YA tiene; la única que admite una intensidad es **el aura** (el resto se
// declara en UNMAPPED_INTENSITIES: mejor un rasgo sin magnitud que una
// magnitud inventada).
//
// NO SE INVENTA GEOMETRÍA: cada rasgo se traduce a una palanca que el motor
// ya tiene. Lo que el motor no puede expresar se declara aquí
// (`UNMAPPED_TRAITS`, `UNMAPPED_OUTFITS`, `UNMAPPED_INTENSITIES`), sin
// amagar: es mejor un rasgo sin efecto que un efecto inventado.
//
// El vocabulario canónico del perfil (el `TraitKind` del renderer y su
// `baseForm`) se trata como **datos externos**: si el renderer añade un valor,
// aquí no se rompe — se ignora y se declara en `unmapped`.

/**
 * Formas base del perfil → la silueta del motor.
 *
 * El motor tiene UNA sola silueta parametrizada: `shape.roundness`
 * (0 = cuadrado, 100 = redondo) y `shape.ratio` (aplastado vertical, ≤ 1).
 * Las cuatro formas base del renderer se traducen a esa pareja:
 *
 *  · `quantum-monolith`   → la más redonda y neutra (es el default del
 *                            renderer) ⇒ casi una esfera.
 *  · `energy-core`        → redonda pero algo más compacta.
 *  · `fractal-polyhedron` → poliedrica: esquinas vivas (roundness bajo).
 *  · `delta-core`         → la forma triangular del motor legacy: la más
 *                            angulosa y la más achatada.
 */
export const BASE_FORMS = Object.freeze({
  'quantum-monolith': Object.freeze({ roundness: 82, ratio: 1.0 }),
  'energy-core': Object.freeze({ roundness: 62, ratio: 0.96 }),
  'fractal-polyhedron': Object.freeze({ roundness: 26, ratio: 0.94 }),
  'delta-core': Object.freeze({ roundness: 34, ratio: 0.9 }),
});

/**
 * Rango del aura del genoma (`core/genome.js`: `aura` ∈ [0.25, 1]).
 * Es la única palanca de intensidad que el motor tiene.
 */
export const AURA_RANGE = Object.freeze([0.25, 1]);

/**
 * Rasgos canónicos (`TraitKind`) → lo que el motor expresa.
 *
 *  · `appendage` : el apéndice del genoma (`antenna` / `ears`).
 *  · `marking`   : la marca de la cabeza (`dots`).
 *  · `aura`      : el resplandor del genoma (admite INTENSIDAD).
 *  · `accessory` : el accesorio del studio (un solo hueco).
 */
export const TRAIT_KINDS = Object.freeze({
  antennae: Object.freeze({ appendage: 'antenna' }),
  'geometric-crest': Object.freeze({ appendage: 'ears' }),
  'energy-cores': Object.freeze({ marking: 'dots' }),
  'aura-field': Object.freeze({ aura: 1 }),
  halo: Object.freeze({ accessory: 'halo' }),
  'orbital-rings': Object.freeze({ accessory: 'halo' }),
  'quantum-crown': Object.freeze({ accessory: 'crown' }),
});

/**
 * Los rasgos que el motor **no** puede expresar (y por qué).
 *
 *  · `floating-shards`: las partículas del motor son del ESTADO (la boca al
 *    hablar, las 'z' al bostezar), no un knob del genoma. No se inventa uno.
 */
export const UNMAPPED_TRAITS = Object.freeze(['floating-shards']);

/**
 * Los rasgos que el motor SÍ expresa pero cuya **intensidad** no tiene
 * palanca (el motor solo tiene el aura). Se aplican, pero a tope: su magnitud
 * se declara en vez de fingirse.
 */
export const UNMAPPED_INTENSITIES = Object.freeze([
  'antennae',
  'geometric-crest',
  'energy-cores',
  'halo',
  'orbital-rings',
  'quantum-crown',
]);

/**
 * Outfits del renderer → accesorio del studio.
 *
 * El motor tiene UN solo hueco de accesorio (16 piezas). El outfit manda sobre
 * los rasgos que también piden accesorio: la ropa explicita gana.
 * Los outfits que el motor no tiene (gorro aderido, bufanda, lazo) se
 * declaran en `UNMAPPED_OUTFITS`: el motor no los inventa.
 */
export const OUTFITS = Object.freeze({
  // El vocabulario LEGACY de ropa del renderer (`CharacterWardrobe.ts`):
  santaHat: 'santa',
  partyHat: 'witch',
  crown: 'crown',
  sunglasses: 'aviator-glasses',
  roundGlasses: 'glasses',

  // El vocabulario ACTUAL de accesorios del renderer (`ACCESSORY_OPTIONS` en
  // `WardrobeSelector.tsx`): el motor YA tiene estas piezas, asi que el mapa es
  // identidad. Antes estos 7 caian en `unmapped` y el accesorio persistido no
  // se aplicaba (peticion de A4, Ola 13).
  none: 'none',
  'cx-full-kit': 'cx-full-kit',
  'cx-antenna': 'cx-antenna',
  headphones: 'headphones',
  'cyber-goggles': 'cyber-goggles',
  halo: 'halo',
  sprout: 'sprout',
});

/**
 * Outfits que el motor no expresa (no hay pieza equivalente): el motor tiene
 * UN hueco de accesorio y 16 piezas, y entre ellas no estan el gorro aderido,
 * la bufanda ni el lazo del vocabulario legacy del renderer.
 *
 * (Un outfit CUALQUIER otro que no este en `OUTFITS` tambien se declara
 * `unmapped` al resolver el perfil: no se ignora en silencio.)
 */
export const UNMAPPED_OUTFITS = Object.freeze(['beanie', 'scarf', 'bow']);

/** Accesorios que el motor tiene y este módulo NO usa (reservados). */
export const ENGINE_ACCESSORIES = Object.freeze([
  'none', 'cx-antenna', 'cx-full-kit', 'headphones', 'glasses', 'aviator-glasses',
  'cyber-goggles', 'santa', 'witch', 'cat-ears', 'bunny-ears', 'fox-ears',
  'bear-ears', 'crown', 'halo', 'sprout',
]);

/**
 * Normaliza una entrada de rasgo a `{kind, intensity, enabled}`.
 * Acepta un nombre suelto o un objeto `{kind, intensity, enabled}`.
 * @param {unknown} raw
 * @returns {{kind: string, intensity: number, enabled: boolean}|null}
 */
function normalizeEntry(raw) {
  if (typeof raw === 'string') {
    const kind = raw.trim();
    if (!kind) return null;
    return { kind, intensity: 1, enabled: true };
  }
  if (raw && typeof raw === 'object') {
    const kind = String(raw.kind ?? raw.name ?? '').trim();
    if (!kind) return null;
    const intensity = Number(raw.intensity);
    return {
      kind,
      intensity: Number.isFinite(intensity) ? Math.min(1, Math.max(0, intensity)) : 1,
      enabled: raw.enabled === undefined ? true : Boolean(raw.enabled),
    };
  }
  return null;
}

/**
 * Parsea el atributo `traits` a entradas normalizadas, CON su intensidad.
 *
 * Acepta las dos formas que viajan por el atributo:
 *   · `["halo","antennae"]`                        (nombres)
 *   · `[{"kind":"halo","intensity":0.4}]`          (la canónica)
 * y las mezclas. Un JSON corrupto es un perfil vacío, no un fallo.
 *
 * @param {string|Array<unknown>|null|undefined} json
 * @returns {Array<{kind: string, intensity: number, enabled: boolean}>}
 */
export function parseTraitEntries(json) {
  let parsed = json;
  if (typeof json === 'string') {
    if (json === '') return [];
    try {
      parsed = JSON.parse(json);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const out = [];
  for (const raw of parsed) {
    const entry = normalizeEntry(raw);
    if (entry) out.push(entry);
  }
  return out;
}

/**
 * Los NOMBRES de los rasgos del atributo `traits`.
 * (La firma que consume el renderer; la intensidad vive en
 * `parseTraitEntries`.)
 * @param {string|Array<unknown>|null|undefined} json
 * @returns {string[]}
 */
export function parseTraits(json) {
  return parseTraitEntries(json).map((e) => e.kind);
}

/**
 * Resuelve el perfil a las palancas del motor.
 *
 * @param {{baseForm?: string|null, traits?: string[]|Array<{kind: string, intensity?: number, enabled?: boolean}>|string|null, outfit?: string|null}} [profile]
 * @returns {{shape: {roundness: number, ratio: number}, appendage?: string, marking?: string,
 *            aura?: number, accessory: string, unmapped: string[], unmappedIntensity: string[]}}
 */
export function resolveProfile(profile = {}) {
  const base = BASE_FORMS[profile.baseForm] ?? BASE_FORMS['quantum-monolith'];
  const entries = parseTraitEntries(profile.traits);

  const genes = { shape: { roundness: base.roundness, ratio: base.ratio } };
  let accessory = 'none';
  const unmapped = [];
  const unmappedIntensity = [];

  for (const entry of entries) {
    const trait = TRAIT_KINDS[entry.kind];
    if (!trait) {
      // O bien es un rasgo que el motor no expresa (documentado en
      // UNMAPPED_TRAITS) o uno que el renderer ha añadido y el motor todavía
      // no conoce: en los dos casos se DECLARA, no se inventa nada.
      unmapped.push(entry.kind);
      continue;
    }
    // Un rasgo desactivado no se aplica (eso sí se puede expresar).
    if (!entry.enabled) continue;

    if (trait.appendage) genes.appendage = trait.appendage;
    if (trait.marking) genes.marking = trait.marking;
    if (trait.accessory) accessory = trait.accessory;
    if (trait.aura !== undefined) {
      // El aura es la ÚNICA palanca de intensidad del motor: el resto de los
      // rasgos se aplican, pero su magnitud no se puede expresar.
      const [lo, hi] = AURA_RANGE;
      genes.aura = lo + (hi - lo) * entry.intensity;
    }
    if (!UNMAPPED_INTENSITIES.includes(entry.kind) === false) {
      unmappedIntensity.push(entry.kind);
    }
  }

  // 2) El outfit manda: la ropa explicita pisa el accesorio de los rasgos.
  // Un outfit que NO esta en el mapa se DECLARA (no se ignora en silencio: un
  // perfil que "parece aplicarse" y no se aplica es peor que uno que lo dice).
  if (profile.outfit) {
    const piece = OUTFITS[profile.outfit];
    if (piece) accessory = piece;
    else unmapped.push(profile.outfit);
  }

  return { ...genes, accessory, unmapped, unmappedIntensity };
}

/**
 * Aplica el perfil resuelto a un genoma (devuelve uno NUEVO: el genoma de la
 * semilla es congelado y no se muta).
 * @param {object} genome
 * @param {{shape: {roundness: number, ratio: number}, appendage?: string, marking?: string, aura?: number}} profile
 */
export function applyProfileToGenome(genome, profile) {
  const out = { ...genome, shape: { ...genome.shape, ...profile.shape } };
  if (profile.appendage) out.appendage = profile.appendage;
  if (profile.marking) out.marking = profile.marking;
  if (profile.aura !== undefined) out.aura = profile.aura;
  return out;
}
