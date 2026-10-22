// PERF (Ola 13): el store del UI no debe notificar cuando el valor no cambia.
//
// `set({ attentionState })` crea un objeto de estado NUEVO => Zustand avisa a
// TODOS los suscriptores aunque el valor sea idéntico. El relay de atención
// puede llegar con mucha frecuencia => la app entera se re-renderiza en bucle
// y los `<ego-avatar>` se quedan sin CPU.
//
// El contrato: **solo se notifica cuando el valor cambia de verdad**.
import { describe, it, expect, vi } from "vitest";
import { useUiStore } from "../components/ui-kit/store.js";

describe("PERF — el store del UI notifica solo los cambios de verdad", () => {
  it("setAttentionState con el MISMO valor no notifica a los suscriptores", () => {
    const spy = vi.fn();
    const unsubscribe = useUiStore.subscribe(spy);
    const before = useUiStore.getState().attentionState;

    useUiStore.getState().setAttentionState(before);
    expect(spy).not.toHaveBeenCalled();

    useUiStore.getState().setAttentionState(before);
    expect(spy).not.toHaveBeenCalled();

    unsubscribe();
  });

  it("setAttentionState con un valor DISTINTO notifica una vez", () => {
    const spy = vi.fn();
    const unsubscribe = useUiStore.subscribe(spy);
    const before = useUiStore.getState().attentionState;
    const other = before === "compact" ? "expanded" : "compact";

    useUiStore.getState().setAttentionState(other);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().attentionState).toBe(other);

    unsubscribe();
  });
});
