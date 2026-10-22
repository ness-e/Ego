import { create } from "zustand";

export interface UiKitState {
  modelPickerOpen: boolean;
  sessionPickerOpen: boolean;
  activeModelId: string;
  /**
   * Ola 11 · A4 (EGO-FIND-119): el estado de atención REAL del proceso main
   * (la `AttentionStateMachine`).
   *
   * Llega por el relay `ipc.event` (el mismo canal que los pushes de la
   * isla y del terminal) → **no hay ningún canal IPC nuevo**. El canvas lo
   * usa para que el `CharacterPresence` refleje la presencia y no un
   * `idle` fijo.
   */
  attentionState: string;
  setAttentionState: (state: string) => void;
  /** Sesión activa real o null (2026-10-15: sin default falso). */
  activeSessionId: string | null;
  /** Error global visible (estado P22 `error` a nivel app). */
  uiError: string | null;
  /** Aviso de vacío global (estado P22 `empty` a nivel app). */
  uiEmpty: string | null;
  openModelPicker: () => void;
  closeModelPicker: () => void;
  openSessionPicker: () => void;
  closeSessionPicker: () => void;
  setActiveModelId: (id: string) => void;
  setActiveSessionId: (id: string | null) => void;
  setUiError: (message: string) => void;
  clearUiError: () => void;
  setUiEmpty: (message: string) => void;
  clearUiEmpty: () => void;
  reset: () => void;
}

const initialState = {
  modelPickerOpen: false,
  sessionPickerOpen: false,
  activeModelId: "claude-3-7-sonnet",
  attentionState: "idle",
  activeSessionId: null as string | null,
  uiError: null as string | null,
  uiEmpty: null as string | null,
};

/** Clave de persistencia del hilo activo (continuidad entre arranques). */
export const ACTIVE_SESSION_KEY = "ego:active-session-id";

/** Id de hilo fresco (`sess-<base36>`), compatible con `sessions.*` del main. */
export function mintSessionId(): string {
  return `sess-${Date.now().toString(36)}`;
}

/** Restaura el hilo activo persistido, o null si nunca hubo uno. */
export function loadPersistedSessionId(): string | null {
  try {
    const saved = localStorage.getItem(ACTIVE_SESSION_KEY);
    return saved && saved.trim().length > 0 ? saved : null;
  } catch {
    return null;
  }
}

/**
 * T06 UI-03 — store global del kit (Zustand). Los pickers dejan de vivir
 * solo en tests: header y sidebar leen/escriben este estado.
 */
export const useUiStore = create<UiKitState>()((set) => ({
  ...initialState,
  openModelPicker: () => set({ modelPickerOpen: true }),
  closeModelPicker: () => set({ modelPickerOpen: false }),
  openSessionPicker: () => set({ sessionPickerOpen: true }),
  closeSessionPicker: () => set({ sessionPickerOpen: false }),
  setActiveModelId: (id) => set({ activeModelId: id }),
  setAttentionState: (state) => set({ attentionState: state }),
  setActiveSessionId: (id: string | null) => {
    set({ activeSessionId: id });
    // La sesión activa sobrevive recargas (hilo continuo entre arranques).
    // "Nuevo" la reemplaza por un id fresco; null = sin hilo (honesto).
    try {
      if (id) localStorage.setItem(ACTIVE_SESSION_KEY, id);
      else localStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch {
      // Sin storage: vive solo en memoria.
    }
  },
  setUiError: (message) => set({ uiError: message }),
  clearUiError: () => set({ uiError: null }),
  setUiEmpty: (message) => set({ uiEmpty: message }),
  clearUiEmpty: () => set({ uiEmpty: null }),
  reset: () => set({ ...initialState }),
}));
