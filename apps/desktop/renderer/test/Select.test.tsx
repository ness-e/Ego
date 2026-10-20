import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "../components/ui-kit/Select.js";

/**
 * T5 / D3 — Select sobre `@radix-ui/react-select`.
 *
 * El contrato público (`SelectProps`) no cambia respecto a la implementación
 * propia anterior; lo que se verifica ahora es que Radix aporta:
 *  - el patrón ARIA canónico (`combobox` + `listbox` + `option`),
 *  - `aria-expanded` que refleja el estado,
 *  - navegación por teclado (flechas, Enter, Escape),
 *  - retorno del foco al trigger al cerrar,
 *  - y que NO aparece ningún `<select>` nativo en el DOM.
 */
describe("ui-kit Select (Radix)", () => {
  afterEach(() => {
    cleanup();
  });

  const options = [
    { value: "opt1", label: "Opción 1" },
    { value: "opt2", label: "Opción 2" },
    { value: "opt3", label: "Opción 3 (deshabilitada)", disabled: true },
  ];

  it("renderiza trigger combobox con aria-label y clases >=44px", () => {
    render(
      <Select
        value="opt1"
        options={options}
        ariaLabel="Selector de prueba"
        onValueChange={vi.fn()}
      />
    );

    const trigger = screen.getByRole("combobox", { name: "Selector de prueba" });
    expect(trigger).toBeTruthy();
    expect(trigger).toHaveTextContent("Opción 1");
    expect(trigger.className).toContain("min-h-11");
    expect(trigger.className).toContain("min-w-11");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector("select")).toBeNull();
  });

  it("aplica estado disabled cuando prop disabled es true", () => {
    render(
      <Select
        value="opt1"
        options={options}
        ariaLabel="Selector deshabilitado"
        disabled
        onValueChange={vi.fn()}
      />
    );

    const trigger = screen.getByRole("combobox", { name: "Selector deshabilitado" });
    expect(trigger).toBeDisabled();
    expect(trigger.className).toContain("disabled:opacity-50");
  });

  it("abre, expone role=listbox con role=option y selecciona", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Select
        value="opt1"
        options={options}
        ariaLabel="Selector de opciones"
        onValueChange={handleChange}
      />
    );

    const trigger = screen.getByRole("combobox", { name: "Selector de opciones" });
    await user.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    // Radixassocia el listbox al trigger vía `aria-controls`; el nombre
    // accesible del listbox lo aporta `aria-labelledby` (el valor del trigger).
    const listbox = await screen.findByRole("listbox");
    expect(listbox).toBeTruthy();
    expect(trigger.getAttribute("aria-controls")).toBe(listbox.id);
    const option = screen.getByRole("option", { name: "Opción 2" });
    expect(option).toBeTruthy();

    await user.click(option);
    expect(handleChange).toHaveBeenCalledWith("opt2");
  });

  it("navega con el teclado: ArrowDown + Enter selecciona", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Select
        value="opt1"
        options={options}
        ariaLabel="Selector de teclado"
        onValueChange={handleChange}
      />
    );

    const trigger = screen.getByRole("combobox", { name: "Selector de teclado" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(handleChange).toHaveBeenCalledWith("opt2");
  });

  it("Escape cierra el listbox y devuelve el foco al trigger", async () => {
    const user = userEvent.setup();
    render(
      <Select
        value="opt1"
        options={options}
        ariaLabel="Selector de escape"
        onValueChange={vi.fn()}
      />
    );

    const trigger = screen.getByRole("combobox", { name: "Selector de escape" });
    await user.click(trigger);
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("no deja pasar una opción deshabilitada", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Select
        value="opt1"
        options={options}
        ariaLabel="Selector con deshabilitada"
        onValueChange={handleChange}
      />
    );

    const trigger = screen.getByRole("combobox", { name: "Selector con deshabilitada" });
    await user.click(trigger);
    const disabledOption = await screen.findByRole("option", {
      name: "Opción 3 (deshabilitada)",
    });
    expect(disabledOption.getAttribute("data-disabled")).not.toBeNull();
    await user.click(disabledOption);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("muestra el placeholder cuando no hay valor seleccionado", () => {
    render(
      <Select
        options={[]}
        ariaLabel="Selector vacío"
        placeholder="Nada por ahora"
        onValueChange={vi.fn()}
      />
    );
    const trigger = screen.getByRole("combobox", { name: "Selector vacío" });
    expect(trigger).toHaveTextContent("Nada por ahora");
  });
});
