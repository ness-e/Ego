/**
 * E6-res (Ola 3) — La presencia ambiental de la app: el icono del **tray**
 * y la atención de la **isla flotante**.
 *
 * Extracción **verbatim** del god-file `main.ts` (sin cambio de
 * comportamiento). Antesvivían en el compositor junto a 20 cosas más; ahora
 * viven con su responsabilidad, como el resto de `src/main/**`.
 *
 * ## Qué hay dentro
 * - `createTrayIcon` / `refreshTrayStatus` / `ensureTray`: el icono
 *   generado en runtime (16×16 PNG sin assets) y su menú.
 * - `emitTrayId`: el canal `tray:id` al renderer.
 * - `pauseAllBackgroundTasks` / `resumeAllBackgroundTasks`: la pausa del
 *   motor de tareas (la lógica pura vive en `main/tray-status.ts`).
 * - `floatingSnapshot` / `getAttentionFsm` / `recomputeFloatingAttention` /
 *   `syncFloatingFromEngine`: el estado de atención de la isla flotante.
 *   El `AttentionStateMachine` canónica es la del motor (`@ego/runtime`);
 *   aquí solo se le PIDE atención.
 * - `ensureFloatMgr`: el singleton de la ventana flotante.
 *
 * ## El estado
 * `tray`, `trayStatus`, `floatMgr` y `attentionFsm` viven en
 * `state/app-context.ts` (bindings vivos): este módulo los CONSUME y los
 * ESCRIBE por sus setters. No hay segunda copia del estado.
 */
import { app, Tray, Menu, nativeImage } from "electron";
import { deflateSync } from "node:zlib";
import { AttentionStateMachine } from "@ego/runtime";
import {
  FloatingWindowManager,
  syncFromAttention,
  type FloatingWindowManagerOptions,
} from "../../windows/FloatingWindow.js";
import {
  TRAY_COLORS,
  pngChunk,
  trayTooltipFor,
  pauseAllTasks,
  resumeAllTasks,
  type EgoTrayStatus,
} from "../tray-status.js";
import {
  approvalEngine,
  win,
  backgroundEngine,
  tray,
  trayStatus,
  floatMgr,
  attentionFsm,
  llmAbortControllers,
  publishAttentionState,
} from "../state/app-context.js";
import { setTray, setTrayStatus, setFloatMgr, setAttentionFsm } from "../state/app-context.js";

export function ensureFloatMgr(options?: FloatingWindowManagerOptions): FloatingWindowManager {
  // Las options SÓLO se aplican a la primera construcción (memoize); los
  // llamantes posteriores reciben la instancia ya configurada.
  if (!floatMgr) {
    const created = new FloatingWindowManager(options);
    setFloatMgr(created);
    return created;
  }
  return floatMgr;
}

export function createTrayIcon(status: EgoTrayStatus): Electron.NativeImage {
  const [r, g, b] = TRAY_COLORS[status];
  const width = 16;
  const height = 16;
  const row = Buffer.alloc(1 + width * 4);
  row[0] = 0; // filtro PNG: none
  for (let x = 0; x < width; x++) {
    row[1 + x * 4] = r;
    row[1 + x * 4 + 1] = g;
    row[1 + x * 4 + 2] = b;
    row[1 + x * 4 + 3] = 255;
  }
  const raw = Buffer.alloc(row.length * height);
  for (let y = 0; y < height; y++) row.copy(raw, y * row.length);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  return nativeImage.createFromBuffer(png);
}

export function refreshTrayStatus(): void {
  let next: EgoTrayStatus = "idle";
  try {
    if (backgroundEngine) {
      if (backgroundEngine.listTasks({ status: ["paused"] }).length > 0) {
        next = "hitl";
      } else if (backgroundEngine.getActiveCount() > 0) {
        next = "thinking";
      }
    }
  } catch {
    // noop: el tray nunca tumba el main
  }
  setTrayStatus(next);
  try {
    if (tray && !tray.isDestroyed()) {
      tray.setImage(createTrayIcon(next));
      tray.setToolTip(trayTooltipFor(next));
    }
  } catch {
    // noop
  }
}

export function floatingSnapshot(): {
  active: number;
  hitl: number;
  muted: boolean;
  disabled: boolean;
} {
  let active = 0;
  let hitl = 0;
  try {
    if (backgroundEngine) {
      active += backgroundEngine.getActiveCount();
      hitl += backgroundEngine.listTasks({ status: ["paused"] }).length;
    }
    if (approvalEngine) {
      hitl += approvalEngine.listPendingApprovals().length;
    }
    active += llmAbortControllers.size;
  } catch {
    // noop: el flotante nunca tumba el main
  }
  const st = floatMgr ? floatMgr.getState() : null;
  return { active, hitl, muted: st?.muted ?? false, disabled: st?.disabled ?? false };
}

export function getAttentionFsm(): AttentionStateMachine {
  if (!attentionFsm) {
    const created = new AttentionStateMachine({
      onTransition: (ev) => {
        try {
          ensureFloatMgr().updateState({ attentionState: syncFromAttention(ev.currentState) });
          // Ola 11 · A4 (EGO-FIND-119): el canvas tambien necesita el estado
          // real de atencion (no un idle fijo) -> se publica por el relay
          // que ya existe (ipc.event), sin canal nuevo.
          publishAttentionState(syncFromAttention(ev.currentState));
        } catch {
          // noop
        }
      },
    });
    setAttentionFsm(created);
    return created;
  }
  return attentionFsm;
}

export function recomputeFloatingAttention(): void {
  try {
    const snap = floatingSnapshot();
    const fsm = getAttentionFsm();

    if (snap.hitl > 0) {
      fsm.requestAttention({
        id: "hitl-approval",
        priority: 100,
        state: "hitl_approval",
        title: "Aprobación HITL requerida",
        pinned: true,
      });
    } else {
      fsm.releaseAttention("hitl-approval");
    }

    if (snap.active > 0) {
      fsm.requestAttention({
        id: "active-work",
        priority: 50,
        state: "compact",
        title: "Trabajo activo en curso",
        pinned: true,
      });
    } else {
      fsm.releaseAttention("active-work");
    }

    const state = fsm.getState();
    ensureFloatMgr().updateState({ attentionState: syncFromAttention(state) });
    // Ola 11 · A4 (EGO-FIND-119): idem, en el recompute explicito.
    publishAttentionState(syncFromAttention(state));
  } catch {
    // noop: defensivo contra fallos en cálculo de atención
  }
  refreshTrayStatus();
}

export function syncFloatingFromEngine(): void {
  recomputeFloatingAttention();
}

export function emitTrayId(action: string): void {
  try {
    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.event", { event: "tray:id", action, status: trayStatus });
    }
  } catch {
    // noop: el push al renderer nunca tumba el main
  }
}

export function pauseAllBackgroundTasks(): string[] {
  let paused: string[] = [];
  try {
    if (backgroundEngine) {
      paused = pauseAllTasks(backgroundEngine);
    }
  } catch {
    // noop
  }
  try {
    ensureFloatMgr().updateState({ attentionState: "hidden" });
  } catch {
    // noop
  }
  refreshTrayStatus();
  return paused;
}

export function resumeAllBackgroundTasks(): string[] {
  let resumed: string[] = [];
  try {
    if (backgroundEngine) {
      resumed = resumeAllTasks(backgroundEngine);
    }
  } catch {
    // noop
  }
  syncFloatingFromEngine();
  return resumed;
}

/**
 * EGO-FIND-104 — path de RECUPERACIÓN: la única UI de mute/unmute vive EN la
 * isla; si la presencia quedaba bloqueada (muted enterrado en persistencia),
 * no había forma de volver a verla. Desde el tray la isla siempre es
 * alcanzable: mostrar (compact, interactiva) u ocultar.
 */
export function toggleFloatingIslandFromTray(): void {
  try {
    const mgr = ensureFloatMgr();
    const st = mgr.getState();
    if (st.visible && st.attentionState !== "hidden") {
      mgr.updateState({ attentionState: "hidden" });
      mgr.hide();
    } else {
      mgr.show();
      mgr.updateState({ attentionState: "compact" });
    }
  } catch {
    // noop: el tray nunca tumba el main
  }
}

export function ensureTray(): void {
  if (tray) {
    refreshTrayStatus();
    return;
  }
  try {
    const created = new Tray(createTrayIcon(trayStatus));
    setTray(created);
    created.setToolTip(trayTooltipFor(trayStatus));
    const restore = (): void => {
      try {
        if (win && !win.isDestroyed()) {
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        }
        // Task4 (D2): al restaurar la principal, ocultar el flotante.
        if (floatMgr) floatMgr.hide();
        emitTrayId("open");
      } catch {
        // noop
      }
    };
    const openSettings = (): void => {
      try {
        if (win && !win.isDestroyed()) {
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        }
        emitTrayId("open-settings");
      } catch {
        // noop
      }
    };
    created.on("click", restore);
    created.setContextMenu(Menu.buildFromTemplate([
        { label: "Abrir Ego", click: restore },
        { label: "Configuración", click: openSettings },
        {
          // EGO-FIND-104: recovery — toggle manual de la isla desde fuera.
          label: "Isla flotante: mostrar/ocultar",
          click: toggleFloatingIslandFromTray,
        },
        { type: "separator" },
        {
          label: "Pausar tareas",
          click: (): void => {
            const paused = pauseAllBackgroundTasks();
            emitTrayId(`pause:${paused.length}`);
          },
        },
        {
          label: "Reanudar tareas",
          click: (): void => {
            const resumed = resumeAllBackgroundTasks();
            emitTrayId(`resume:${resumed.length}`);
          },
        },
        { type: "separator" },
        {
          label: "Salir",
          click: (): void => {
            app.quit();
          },
        },
      ])
    );
  } catch (err) {
    console.warn("[Ego Desktop] Tray no disponible:", err);
    setTray(null);
  }
}
