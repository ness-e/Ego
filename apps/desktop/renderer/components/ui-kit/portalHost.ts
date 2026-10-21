import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Contenedor de portal para los overlays del kit (`Select`, `Menu`,
 * `Popover`).
 *
 * ## Por qué no basta con `document.body`
 * `Modal.tsx` marca su `Dialog.Content` con `data-ego-dialog-content`. Un
 * overlay portaleado a `document.body` queda FUERA del subárbol React del
 * diálogo, y Radix lo trata como "fuera": al pulsar dentro del overlay, la
 * capa `DismissableLayer` del diálogo lo interpreta como clic exterior y
 * **cierra el modal** (el usuario pierde lo que estaba editando).
 *
 * Portaleando el overlay DENTRO del `Dialog.Content`:
 * - el clic sigue estando dentro del subárbol del diálogo → no lo cierra;
 * - el `FocusScope` del diálogo sigue viendo el foco dentro de su subárbol
 *   → sin el ping-pong `focusin` que provocaba
 *   `RangeError: Maximum call stack size exceeded` (ver `Select.tsx`).
 *
 * Si el componente NO vive dentro de un diálogo, el host es `null` y el
 * overlay se portaliza a `document.body` (comportamiento normal de Radix).
 *
 * @param triggerRef Referencia al nodo DOM del trigger (debe propagar `ref`).
 * @returns El `Dialog.Content` anfitrión o `null`.
 */
export function usePortalHost(
  triggerRef: RefObject<HTMLElement | null>,
): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const dialogContent = trigger.closest("[data-ego-dialog-content]");
    setHost(dialogContent instanceof HTMLElement ? dialogContent : null);
  }, [triggerRef]);

  return host;
}
