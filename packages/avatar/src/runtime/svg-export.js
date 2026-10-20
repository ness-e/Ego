// svg-export.js — exportacion del avatar a SVG.
//
// El motor SVG dibuja dentro del shadow root del elemento, asi que "exportar"
// es serializar ese subarbol. Este modulo lo saca del elemento para que
// `avatar-element.js` no mezcle contrato y serializacion.
//
// Sirve para miniaturas, exportacion a fichero y tests de golden frame.
//
// En modo studio no hay SVG que exportar: el render es canvas, y la
// serializacion de un canvas exigiria `toDataURL` (una imagen, no un SVG).
// Por eso devuelve cadena vacia en ese modo.

/**
 * El elemento con sus campos internos.
 *
 * EXCEPCIÓN DE TIPADO (AGENTS.md §4: "`any` prohibido salvo justificación
 * explícita"). Excepción registrada en `AGENTS.md` por A1 (reasignación R12).
 *
 * - **Dónde**: `packages/avatar/src/runtime/svg-export.js:22` (esta typedef)
 *   y `:27`, `:38` (sus dos usos). La misma excepción, con el mismo motivo,
 *   se repite en `packages/avatar/src/runtime/studio-bridge.js:34`.
 * - **Qué.fields**: `_isStudio` (y, transitivamente, el `shadowRoot` del
 *   elemento).
 * - **Por qué**: la exportación serializa el *shadow root* del elemento, que
 *   es un contrato interno. La superficie pública está declarada en
 *   `index.d.ts` y no se ve afectada.
 * - **Condición de cierre**: al migrar `runtime/avatar-element.js` a
 *   TypeScript, esta typedef se sustituye por el tipo real de la clase
 *   (`EgoAvatar`) y desaparece el `any`.
 * - **Alcance del riesgo**: ninguno en runtime; `any` en un *type* de JSDoc no
 *   genera código ni cambia el comportamiento.
 *
 * @typedef {any} AvatarElementInternals
 */

/**
 * Snapshot SVG del estado actual (exportacion/miniaturas; '' en modo studio).
 * @param {AvatarElementInternals} el
 * @returns {string}
 */
export function toSVGString(el) {
  if (el._isStudio?.()) return '';
  return el.shadowRoot?.querySelector('svg')?.outerHTML ?? '';
}

/**
 * Snapshot SVG del estado actual, con el `xmlns` que exigen algunos
 * consumidores (un SVG suelto no es un documento XML valido).
 * @param {AvatarElementInternals} el
 * @returns {string}
 */
export function toSVGDocument(el) {
  const svg = toSVGString(el);
  if (!svg) return '';
  return svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
}
