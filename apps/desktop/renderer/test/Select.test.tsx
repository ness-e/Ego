import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "../components/ui-kit/Select.js";

describe("ui-kit Select component", () => {
  afterEach(() => {
    cleanup();
  });

  const options = [
    { value: "opt1", label: "Opción 1" },
    { value: "opt2", label: "Opción 2" },
    { value: "opt3", label: "Opción 3 (deshabilitada)", disabled: true },
  ];

  it("renderiza trigger con aria-label, clases >=44px y valor inicial", () => {
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

  it("permite abrir y seleccionar una opción", async () => {
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
    const option = await screen.findByRole("option", { name: "Opción 2" });
    expect(option).toBeTruthy();
    await user.click(option);
    expect(handleChange).toHaveBeenCalledWith("opt2");
  });
});
