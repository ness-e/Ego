import { describe, it, expect, afterEach } from "vitest";
import { Omnibar } from "../components/omnibar.js";

// RTL es devDep declarada en package.json pendiente de `pnpm install`.
// Resolución diferida con especificador en variable (sin literal) para no
// romper tsc ni la suite si falta; el describe se salta hasta que exista.
// `any` justificado: tipos del módulo opcional no resolubles pre-install.
const RTL_SPEC = "@testing-library/react";
const USER_EVENT_SPEC = "@testing-library/user-event";

let hasRtl = false;
try {
  const rtl: any = await import(/* @vite-ignore */ RTL_SPEC);
  const ue: any = await import(/* @vite-ignore */ USER_EVENT_SPEC);
  hasRtl = Boolean(rtl?.render && rtl?.screen && ue?.default);
} catch {
  hasRtl = false;
}

describe.skipIf(!hasRtl)("Omnibar — RTL por comportamiento (apertura Ctrl+K)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("abre la búsqueda federada al pulsar Ctrl+K", async () => {
    // Arrange
    const { render, screen } = await import(/* @vite-ignore */ RTL_SPEC);
    const userEvent = (await import(/* @vite-ignore */ USER_EVENT_SPEC)).default;
    const user = userEvent.setup();
    render(<Omnibar />);

    // Act — atajo real de teclado vía user-event
    await user.keyboard("{Control>}k{/Control}");

    // Assert — único assert del test; query prioritaria getByRole
    expect(screen.getByRole("search")).toBeTruthy();
  });
});
