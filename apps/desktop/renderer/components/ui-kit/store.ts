import { create } from "zustand";

export interface UiKitState {
  modelPickerOpen: boolean;
  sessionPickerOpen: boolean;
  activeModelId: string;
  activeSessionId: string;
  /** Error global visible (estado P22 `error` a nivel app). */
  uiError: string | null;
  /** Aviso de vacío global (estado P22 `empty` a nivel app). */
  uiEmpty: string | null;
  openModelPicker: () => void;
  closeModelPicker: () => void;
  openSessionPicker: () => void;
  closeSessionPicker: () => void;
  setActiveModelId: (id: string) => void;
  setActiveSessionId: (id: string) => void;
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
  activeSessionId: "sess-kernel-arch",
  uiError: null as string | null,
  uiEmpty: null as string | null,
};

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
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setUiError: (message) => set({ uiError: message }),
  clearUiError: () => set({ uiError: null }),
  setUiEmpty: (message) => set({ uiEmpty: message }),
  clearUiEmpty: () => set({ uiEmpty: null }),
  reset: () => set({ ...initialState }),
}));
