import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Omnibar } from "../components/omnibar.js";

// STAB-07: import estático — @testing-library/react + user-event son
// devDeps declaradas (package.json:38-39). Si faltan, el import falla y
// la suite falla (nunca verde-falso por omisión). Sin gate hasRtl.
describe("Omnibar — RTL por comportamiento (apertura Ctrl+K)", () => {
  afterEach(() => {
    // cleanup() RTL en vez de innerHTML="": vaciar el body a mano arranca
    // el contenedor que React 19 intenta desmontar (removeChild happy-dom).
    cleanup();
  });

  it("abre la búsqueda federada al pulsar Ctrl+K", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Omnibar />);

    // Act — atajo real de teclado vía user-event
    await user.keyboard("{Control>}k{/Control}");

    // Assert — único assert del test; query prioritaria getByRole
    expect(screen.getByRole("search")).toBeTruthy();
  });
});
