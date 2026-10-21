import { desktopCapturer, screen, type BrowserWindow, type NativeImage } from "electron";

/**
 * EGO-FIND-104b — Sonda de composición de la isla flotante transparente.
 *
 * Contexto del hallazgo (≤18 experimentos, doble pipeline de captura:
 * PowerShell CopyFromScreen + desktopCapturer del propio proceso, ambos
 * concordantes):
 *
 * - La isla con `transparent: true` en Electron 41/Chromium 146 puede NO
 *   componerse jamás al escritorio: `isVisible()=true`, DOM completo, rAF a
 *   60 fps, `visibilityState:"visible"`, ventana topmost y sin tapar (verificado
 *   por z-stack), y aun así **0 píxeles** en pantalla. El contenido existe solo
 *   en la superficie DirectComposition que nunca se presenta.
 * - Es bimodal global de la sesión (no depende de posición, userData, flags:
 *   `--disable-gpu`, `--disable-gpu-compositing`, `--use-warp`,
 *   `--use-angle=gl`, `--disable-direct-composition`,
 *   `--disable-features=CalculateNativeWinOcclusion` — todos no-op).
 * - Con `transparent: false` la misma isla en la misma coordenada compone
 *   SIEMPRE (verificado con el bundle real).
 *
 * Estrategia de detección: pintar el HTML raíz de magenta (`!important`, que
 * gana al `background: transparent !important` del CSS — específicamente
 * `style.setProperty(..., 'important')`, que supera cualquier `!important` de
 * hoja), capturar el escritorio antes/después y medir el delta medio del área
 * de la ventana. Un delta medido SIN inyección (ruido base) anula los cambios
 * ambientales del escritorio tras la ventana (p. ej. ventanas moviéndose).
 *
 * `true`  ⇒ "parece compuesta" (mantener transparencia).
 * `false` ⇒ "no compone" (migrar a modo opaco, que compone siempre).
 */

const PROBE_COLOR = "#ff00ff";

interface WinRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompositingProbeOptions {
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Inyecta el color sonda en html/body con `!important` (conserva estilos inline existentes). */
export async function injectProbeColor(win: BrowserWindow): Promise<void> {
  await win.webContents.executeJavaScript(
    `;(() => {
        const d = document.documentElement, b = document.body;
        d.style.setProperty('background-color', ${JSON.stringify(PROBE_COLOR)}, 'important');
        b.style.setProperty('background-color', ${JSON.stringify(PROBE_COLOR)}, 'important');
        return null;
      })();`,
    true,
  );
}

/** Revierte la inyección (elimina solo la propiedad sonda). */
export async function removeProbeColor(win: BrowserWindow): Promise<void> {
  await win.webContents.executeJavaScript(
    `;(() => {
        const d = document.documentElement, b = document.body;
        d.style.removeProperty('background-color');
        b.style.removeProperty('background-color');
        return null;
      })();`,
    true,
  );
}

/**
 * Captura el escritorio (display primario) y recorta el rect de la ventana.
 * Devuelve `null` si la captura no provee thumbnail utilizable.
 */
export async function captureDesktopRect(rect: WinRect): Promise<NativeImage | null> {
  const display = screen.getPrimaryDisplay();
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: display.size.width, height: display.size.height },
  });
  const thumb = sources[0]?.thumbnail;
  if (!thumb || thumb.isEmpty()) return null;

  const thumbSize = thumb.getSize();
  const scaleX = thumbSize.width / display.size.width;
  const scaleY = thumbSize.height / display.size.height;
  if (!(scaleX > 0) || !(scaleY > 0)) return null;

  const scaled: WinRect = {
    x: Math.round(rect.x * scaleX),
    y: Math.round(rect.y * scaleY),
    width: Math.max(1, Math.round(rect.width * scaleX)),
    height: Math.max(1, Math.round(rect.height * scaleY)),
  };
  return thumb.crop({
    x: scaled.x,
    y: scaled.y,
    width: scaled.width,
    height: scaled.height,
  });
}

/** Delta medio (0..765) por píxel muestreado entre dos imágenes del mismo tamaño. */
export function meanAbsDiff(a: NativeImage, b: NativeImage): number {
  const sa = a.getSize();
  const sb = b.getSize();
  if (sa.width !== sb.width || sa.height !== sb.height) return -1; // inconmensurable

  const bufA = a.toBitmap();
  const bufB = b.toBitmap();
  const { width, height } = sa;
  let sum = 0;
  let n = 0;
  for (let y = 0; y < height; y += 2) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 2) {
      const o = row + x * 4;
      sum +=
        Math.abs(bufA[o]! - bufB[o]!) +
        Math.abs(bufA[o + 1]! - bufB[o + 1]!) +
        Math.abs(bufA[o + 2]! - bufB[o + 2]!);
      n++;
    }
  }
  return n > 0 ? sum / n : -1;
}

/**
 * Sonda completa: ¿la superficie de `win` compone al escritorio?
 * Conservadora: ante cualquier medida inconclusiva devuelve `true`
 * (no migra a opaco por un fallo de la propia sonda).
 */
export async function probeIslandCompositing(
  win: BrowserWindow,
  options: CompositingProbeOptions = {},
): Promise<boolean> {
  const sleep = options.sleep ?? defaultSleep;
  if (win.isDestroyed()) return true;

  const rect: WinRect = win.getBounds();
  if (rect.width <= 0 || rect.height <= 0) return true;

  // 1) Ruido base: dos capturas SIN inyección. Mide cuánto cambia el
  //    escritorio por sí solo (ventanas moviéndose, animaciones ajenas).
  const base0 = await captureDesktopRect(rect);
  if (!base0 || base0.isEmpty()) return true; // inconclusivo → no migrar
  await sleep(300);
  const base1 = await captureDesktopRect(rect);
  if (!base1 || base1.isEmpty()) return true;
  const noise = meanAbsDiff(base0, base1);
  if (noise < 0) return true; // tamaños distintos → inconclusivo

  // 2) Inyección magenta + captura.
  await injectProbeColor(win);
  await sleep(340);
  const probe = await captureDesktopRect(rect);
  await removeProbeColor(win).catch(() => undefined);
  await sleep(120);
  if (!probe || probe.isEmpty()) return true;

  // 3) Delta sonda vs ruido. Magenta rinde deltas altos (~250-500 de media en
  //    el área no cubierta por el contenido); el ruido ambiental raramente
  //    supera una fracción mínima de eso. Umbral: ruido*2.5+8, nunca < 18.
  const delta = meanAbsDiff(base1, probe);
  if (delta < 0) return true;
  return delta >= Math.max(18, noise * 2.5 + 8);
}
