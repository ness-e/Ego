import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { SafeConfigMutationService } from "../src/SafeConfigMutation.js";

describe("COUC-10: SafeConfigMutationService (12-step atomic mutation)", () => {
  let service: SafeConfigMutationService;
  let tempDir: string;

  beforeEach(async () => {
    service = new SafeConfigMutationService();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ego-test-config-"));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignorar fallos de limpieza en tmp
    }
  });

  it("ejecuta el ciclo de 12 pasos: preview -> confirm -> apply (con backup atómico y verificación)", async () => {
    const configPath = path.join(tempDir, "settings.json");
    const initialConfig = JSON.stringify({ theme: "dark", telemetry: false }, null, 2);
    await fs.writeFile(configPath, initialConfig, "utf8");

    // 1. Preview
    const plan = await service.preview(configPath, (curr) => {
      const parsed = JSON.parse(curr);
      parsed.theme = "light";
      return JSON.stringify(parsed, null, 2);
    });

    expect(plan.status).toBe("previewed");
    expect(plan.fingerprintOriginal).toBeDefined();
    expect(plan.fingerprintNew).toBeDefined();
    expect(plan.diff.added).toBeGreaterThan(0);

    // 2. Intentar aplicar sin confirmación debe fallar si requireConfirmation es true
    await expect(service.apply(plan.id, { requireConfirmation: true })).rejects.toThrow(
      /no ha sido confirmado/
    );

    // 3. Confirmación
    const confirmed = service.confirm(plan.id, "lead-engineer");
    expect(confirmed).toBe(true);
    expect(plan.status).toBe("confirmed");

    // 4. Aplicación atómica
    const res = await service.apply(plan.id);
    expect(res.success).toBe(true);
    expect(res.backupPath).toBeDefined();
    expect(plan.status).toBe("applied");

    // Verificar en disco
    const updatedOnDisk = JSON.parse(await fs.readFile(configPath, "utf8"));
    expect(updatedOnDisk.theme).toBe("light");
    expect(updatedOnDisk.telemetry).toBe(false);

    // Verificar backup
    const backupContent = JSON.parse(await fs.readFile(res.backupPath!, "utf8"));
    expect(backupContent.theme).toBe("dark");

    // 5. Rollback
    const rolledBack = await service.rollback(plan.id);
    expect(rolledBack).toBe(true);
    expect(plan.status).toBe("rolled_back");

    const rolledBackOnDisk = JSON.parse(await fs.readFile(configPath, "utf8"));
    expect(rolledBackOnDisk.theme).toBe("dark");
  });

  it("detecta modificaciones concurrentes en disco y aborta la aplicación", async () => {
    const configPath = path.join(tempDir, "concurrency.json");
    await fs.writeFile(configPath, JSON.stringify({ version: 1 }), "utf8");

    const plan = await service.preview(configPath, JSON.stringify({ version: 2 }));
    service.confirm(plan.id);

    // Modificación externa concurrente en disco después del preview
    await fs.writeFile(configPath, JSON.stringify({ version: 999 }), "utf8");

    await expect(service.apply(plan.id)).rejects.toThrow(
      /Conflicto de mutación concurrente/
    );
    expect(plan.status).toBe("failed");
  });

  it("removeOwnedEntries elimina solo propiedades de Ego preservando claves ajenas", async () => {
    const configPath = path.join(tempDir, "shared_mcp.json");
    const sharedData = {
      mcpServers: {
        github: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
        egoInternal: { command: "node", args: ["ego-worker.js"] },
        customTool: { command: "python", args: ["custom.py"] },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(sharedData, null, 2), "utf8");

    const plan = await service.preview(configPath, (curr) => {
      const parsed = JSON.parse(curr);
      delete parsed.mcpServers.egoInternal;
      return JSON.stringify(parsed, null, 2);
    });

    service.confirm(plan.id);
    await service.apply(plan.id);

    const onDisk = JSON.parse(await fs.readFile(configPath, "utf8"));
    expect(onDisk.mcpServers.egoInternal).toBeUndefined();
    expect(onDisk.mcpServers.github).toBeDefined();
    expect(onDisk.mcpServers.customTool).toBeDefined();
  });
});
