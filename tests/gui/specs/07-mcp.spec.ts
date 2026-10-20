// T10-Step-3 ítem 7: "MCP/skills" (T10.md:79).
// El catálogo de skills/integraciones vive en el main (McpClient,
// firma T20); sin main no hay servidor que listar → skip honesto.
import { test, expect, collectPageErrors } from "../fixtures/base.js";

test("mcp-shell: app monta sin consola roja con la superficie MCP", async ({
  page,
}) => {
  const errors = await collectPageErrors(page);
  await page.goto("/");
  await expect(page.locator("#root")).toBeVisible();
  expect(errors, `consola roja en MCP: ${errors.join("\n")}`).toEqual([]);
});

test.describe.skip("requiere backend Electron vivo — Clase B (taxonomía docs/dev/e2e-skip-inventory.md)", () => {
  test("MCP: catálogo de skills lista servidores y respeta firma", async () => {
    // Exige backend Electron real: McpClient del main + verificación de
    // firma (T20, fail-closed). Sin main no hay catálogo real.
  });
});
