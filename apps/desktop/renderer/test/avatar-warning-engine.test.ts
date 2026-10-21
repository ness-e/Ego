/**
 * E6/Ola 2 (A4) — Integración con el MOTOR: el estado `warning` se pinta.
 *
 * ## Qué afirma
 * Que el `<ego-avatar>` con `state="warning"` renderiza la **imagen de
 * warning** del motor canónico (tinte ámbar + insignia de aviso) y NO la
 * de `idle`. Es el cierre del circuito: el motor sabe representar `warning`
 * (A6) y el renderer se lo pide; aquí se comprueba que la cadena entera
 * llega al SVG.
 *
 * ## Dónde se mira (y por qué no en el código)
 * El motor es un Web Component con `shadowRoot` abierto: la insignia y el
 * tinte son **observables en el DOM** (`.badge-warn`, `.tint`). Se comprueba
 * el DOM renderizado, no el texto de una implementación.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import "@ego/avatar/runtime/avatar-element.js";

/** Monta un `<ego-avatar>` con un estado y devuelve el elemento. */
async function mountAvatar(state: string): Promise<HTMLElement> {
  const el = document.createElement("ego-avatar");
  el.setAttribute("seed", "subego:ego.nucleus");
  el.setAttribute("state", state);
  el.setAttribute("size", "120");
  document.body.appendChild(el);
  // El motor monta el shadow DOM en `connectedCallback`; un tick basta.
  await new Promise((r) => setTimeout(r, 0));
  return el;
}

describe("E6 — el motor renderiza el estado `warning` (A6, Ola 2)", () => {
  const mounted: HTMLElement[] = [];

  beforeAll(() => {
    // El custom element debe estar registrado antes de montar.
    expect(customElements.get("ego-avatar")).toBeTruthy();
  });

  afterEach(() => {
    for (const el of mounted) el.remove();
    mounted.length = 0;
  });

  it("`warning` pinta el tinte ámbar y la insignia de aviso", async () => {
    const el = await mountAvatar("warning");
    mounted.push(el);

    const tint = el.shadowRoot?.querySelector(".tint") as SVGElement | null;
    expect(tint, "el motor no pintó el tinte").toBeTruthy();
    // Tinte del estado warning: `hsl(48 92% 55%)` con fuerza 0.4.
    expect(tint!.style.fill).toContain("48 92% 55%");
    expect(tint!.getAttribute("opacity")).toBe("0.400");

    // Insignia de aviso VISIBLE (y la de "bang" —error/aprobación— oculta).
    const warn = el.shadowRoot?.querySelector(".badge-warn");
    const bang = el.shadowRoot?.querySelector(".badge-bang");
    expect(warn?.getAttribute("visibility")).toBe("visible");
    expect(bang?.getAttribute("visibility")).not.toBe("visible");
  });

  it("`idle` NO pinta el tinte de warning ni muestra la insignia de aviso", async () => {
    const el = await mountAvatar("idle");
    mounted.push(el);

    const tint = el.shadowRoot?.querySelector(".tint") as SVGElement | null;
    expect(tint!.style.fill).not.toContain("48 92% 55%");

    const warn = el.shadowRoot?.querySelector(".badge-warn");
    expect(warn?.getAttribute("visibility")).not.toBe("visible");
  });

  it("`warning` y `idle` se distinguen en el DOM renderizado", async () => {
    const warnAvatar = await mountAvatar("warning");
    const idleAvatar = await mountAvatar("idle");
    mounted.push(warnAvatar, idleAvatar);

    const warnTint = warnAvatar.shadowRoot?.querySelector(".tint") as SVGElement;
    const idleTint = idleAvatar.shadowRoot?.querySelector(".tint") as SVGElement;
    expect(warnTint.style.fill).not.toBe(idleTint.style.fill);
  });

  it("el motor RECHAZA un estado que no conoce (fail-closed, no fallback silencioso)", async () => {
    const el = await mountAvatar("idle");
    mounted.push(el);
    const engine = el as unknown as { setState: (n: string) => void };
    expect(() => engine.setState("estado-que-no-existe")).toThrow(
      /estado desconocido/i
    );
  });
});
