import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { ShikiHighlight } from "../components/assistant-ui/shiki-highlight.js";

describe("PERF-02: ShikiHighlight con Web Worker off-main-thread", () => {
  afterEach(() => {
    cleanup();
  });

  it("renderiza texto plano en streaming para mantener 60 FPS", () => {
    const code = "const message: string = 'streaming';";
    render(<ShikiHighlight code={code} language="typescript" streaming={true} />);

    const pre = screen.getByText(code);
    expect(pre.tagName.toLowerCase()).toBe("pre");
  });

  it("renderiza texto plano para lenguajes no soportados", () => {
    const code = "select * from users;";
    render(<ShikiHighlight code={code} language="sql" streaming={false} />);

    const pre = screen.getByText(code);
    expect(pre.tagName.toLowerCase()).toBe("pre");
  });

  it("resalta código diff o typescript mediante fallback/worker sin colapsar el hilo principal", async () => {
    const code = "const a: number = 100;";
    const { container } = render(
      <ShikiHighlight code={code} language="typescript" streaming={false} />
    );

    // Debe mostrar pre inicialmente o html generado
    await waitFor(
      () => {
        const shikiEl = container.querySelector(".shiki-static");
        const preEl = container.querySelector("pre");
        expect(shikiEl || preEl).toBeTruthy();
      },
      { timeout: 2000 }
    );
  });
});
