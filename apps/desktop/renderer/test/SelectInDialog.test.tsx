import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "../components/ui-kit/Select.js";
import { Modal } from "../components/ui-kit/Modal.js";

/**
 * T5 / D3 — El `Select` de Radix dentro de un `Modal` (Dialog de Radix).
 *
 * Regresión real: el `SelectContent` portaleado al `document.body` queda
 * FUERA del `FocusScope` del Dialog. Al abrir el desplegable, el Dialog
 * detecta el foco fuera de su subárbol y lo devuelve al trigger, mientras el
 * Select lo devuelve al ítem → ping-pong infinito →
 * `RangeError: Maximum call stack size exceeded` (el chat de Ajustes se
 * quedaba en blanco al abrir el selector de proveedor).
 *
 * La corrección es portaleal el listbox dentro del `Dialog.Content`
 * anfitrión (`data-ego-dialog-content`).
 */
describe("T5: Select de Radix dentro de un Modal (Dialog) — sin ping-pong de foco", () => {
  afterEach(() => {
    cleanup();
  });

  const options = [
    { value: "a", label: "Opción A" },
    { value: "b", label: "Opción B" },
  ];

  it("abre el desplegable dentro de un diálogo sin RangeError de foco", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <Modal open onOpenChange={vi.fn()} title="Ajustes">
        <Select
          ariaLabel="Proveedor activo"
          value="a"
          options={options}
          onValueChange={handleChange}
        />
      </Modal>
    );

    const trigger = screen.getByRole("combobox", { name: "Proveedor activo" });
    expect(trigger).toBeTruthy();

    // Abrir el desplegable: si el listbox cae fuera del subárbol del
    // diálogo, el ping-pong de `FocusScope` revienta con `RangeError`.
    await user.click(trigger);

    const option = await screen.findByRole("option", { name: "Opción B" });
    expect(option).toBeTruthy();

    await user.click(option);
    expect(handleChange).toHaveBeenCalledWith("b");
  });

  it("el listbox se portaliza dentro del contenedor del diálogo", async () => {
    const user = userEvent.setup();
    render(
      <Modal open onOpenChange={vi.fn()} title="Ajustes">
        <Select ariaLabel="Tema" options={options} onValueChange={vi.fn()} />
      </Modal>
    );

    const dialog = document.querySelector("[data-ego-dialog-content]");
    expect(dialog).not.toBeNull();

    const trigger = screen.getByRole("combobox", { name: "Tema" });
    await user.click(trigger);
    await screen.findByRole("option", { name: "Opción A" });

    const listbox = screen.getByRole("listbox");
    // El listbox debe ser descendiente del contenido del diálogo.
    expect(dialog!.contains(listbox)).toBe(true);
  });
});
