import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  ToolRegistry,
  PathValidator,
  FileLockManager,
  createFsReadFileTool,
  createFsWriteFileTool,
  GitParser,
  createGitStatusTool,
  createGitDiffTool,
  TerminalOutputBuffer,
  createTerminalExecTool,
  registerNativeTools,
} from "../src/index.js";

describe("@ego/tools — Conectores Nivel A Nativos (ACT-04)", () => {
  let tempWorkspace: string;

  beforeEach(() => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ego-native-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    } catch {}
  });

  describe("1. PathValidator (CARP-03 — Sandboxing de Directorio)", () => {
    it("permite rutas relativas y absolutas válidas dentro del workspace", () => {
      const relPath = PathValidator.validatePath("src/index.ts", tempWorkspace);
      expect(relPath).toBe(path.resolve(tempWorkspace, "src/index.ts"));

      const absInside = path.join(tempWorkspace, "docs", "README.md");
      const resolved = PathValidator.validatePath(absInside, tempWorkspace);
      expect(resolved).toBe(absInside);
    });

    it("bloquea escapes mediante path-traversal (..)", () => {
      expect(() => {
        PathValidator.validatePath("../../etc/passwd", tempWorkspace);
      }).toThrow(/Violación de Sandbox/i);
    });

    it("bloquea rutas críticas del sistema operativo", () => {
      const isWindows = process.platform === "win32";
      const criticalPath = isWindows ? "C:\\Windows\\System32\\cmd.exe" : "/etc/shadow";

      expect(() => {
        PathValidator.validatePath(criticalPath, tempWorkspace);
      }).toThrow(/ruta protegida del sistema operativo/i);
    });
  });

  describe("2. FileLockManager (CARP-02 — Exclusión Mutua Atómica)", () => {
    it("adquiere y libera lockfiles correctamente durante operaciones concurrentes", async () => {
      const targetFile = path.join(tempWorkspace, "data.json");
      fs.writeFileSync(targetFile, "{}", "utf-8");

      let insideLock = false;
      const result = await FileLockManager.withLock(targetFile, async () => {
        insideLock = true;
        return 42;
      });

      expect(result).toBe(42);
      expect(insideLock).toBe(true);
      expect(FileLockManager.isLocked(targetFile)).toBe(false);
    });

    it("libera el lock incluso si la función interna arroja excepción", async () => {
      const targetFile = path.join(tempWorkspace, "error.log");

      await expect(
        FileLockManager.withLock(targetFile, async () => {
          throw new Error("Fallo de prueba");
        })
      ).rejects.toThrow("Fallo de prueba");

      expect(FileLockManager.isLocked(targetFile)).toBe(false);
    });
  });

  describe("3. NativeFsTool (COUC-11 — Atomic Write & Rollback Backup)", () => {
    it("escribe un archivo de forma atómica y genera backup si ya existía", async () => {
      const writeTool = createFsWriteFileTool();
      const readTool = createFsReadFileTool();
      const ctx = {
        callId: "test-c1",
        sessionId: "s1",
        workspacePath: tempWorkspace,
      };

      // 1. Primera escritura: archivo nuevo
      const res1 = await writeTool.execute(
        { path: "notes.txt", content: "Versión 1", createBackup: true },
        ctx
      );
      expect(res1.success).toBe(true);
      expect(res1.backupPath).toBeUndefined();

      // Verificar lectura
      const readRes1 = await readTool.execute({ path: "notes.txt", encoding: "utf-8" }, ctx);
      expect(readRes1.content).toBe("Versión 1");

      // 2. Segunda escritura: mutación con backup
      const res2 = await writeTool.execute(
        { path: "notes.txt", content: "Versión 2 Modificada", createBackup: true },
        ctx
      );
      expect(res2.success).toBe(true);
      expect(res2.backupPath).toBeDefined();

      // Verificar que el backup existe en disco y tiene el contenido previo
      const backupAbs = path.join(tempWorkspace, res2.backupPath!);
      expect(fs.existsSync(backupAbs)).toBe(true);
      expect(fs.readFileSync(backupAbs, "utf-8")).toBe("Versión 1");

      // Verificar que el archivo principal tiene el contenido nuevo
      const readRes2 = await readTool.execute({ path: "notes.txt", encoding: "utf-8" }, ctx);
      expect(readRes2.content).toBe("Versión 2 Modificada");
    });

    it("rechaza lectura de archivos fuera del workspace", async () => {
      const readTool = createFsReadFileTool();
      const ctx = {
        callId: "test-c2",
        sessionId: "s1",
        workspacePath: tempWorkspace,
      };

      await expect(
        readTool.execute({ path: "../../../sensitive.txt", encoding: "utf-8" }, ctx)
      ).rejects.toThrow(/Violación de Sandbox/i);
    });
  });

  describe("4. GitParser (OCLW-08 — Parsing Estructurado)", () => {
    it("parsea correctamente la salida de git status --porcelain=v1", () => {
      const rawStatus = `## main...origin/main [ahead 1, behind 2]
 M src/app.ts
M  src/utils.ts
?? newfile.ts
 D deleted.txt
`;
      const parsed = GitParser.parseStatus(rawStatus);

      expect(parsed.branch).toBe("main");
      expect(parsed.upstream).toBe("origin/main");
      expect(parsed.ahead).toBe(1);
      expect(parsed.behind).toBe(2);
      expect(parsed.files).toHaveLength(4);

      const modified = parsed.files.find((f) => f.path === "src/app.ts");
      expect(modified?.status).toBe("modified");
      expect(modified?.staged).toBe(false);

      const stagedMod = parsed.files.find((f) => f.path === "src/utils.ts");
      expect(stagedMod?.status).toBe("modified");
      expect(stagedMod?.staged).toBe(true);

      const untracked = parsed.files.find((f) => f.path === "newfile.ts");
      expect(untracked?.status).toBe("untracked");

      const deleted = parsed.files.find((f) => f.path === "deleted.txt");
      expect(deleted?.status).toBe("deleted");
    });

    it("parsea diffs estructurados", () => {
      const rawDiff = `diff --git a/index.ts b/index.ts
--- a/index.ts
+++ b/index.ts
@@ -1,3 +1,4 @@
 import os from "node:os";
+import fs from "node:fs";
 export const a = 1;
`;
      const parsed = GitParser.parseDiff(rawDiff);
      expect(parsed.files).toContain("index.ts");
      expect(parsed.raw).toBe(rawDiff);
      expect(parsed.chunks).toHaveLength(1);
      expect(parsed.chunks[0].header).toBe("@@ -1,3 +1,4 @@");
    });
  });

  describe("5. TerminalOutputBuffer & NativeTerminalTool (HELM-01, HELM-02, HELM-04)", () => {
    it("acumula salida y trunca en ring-buffer de 2MB", () => {
      const buffer = new TerminalOutputBuffer({ maxSizeBytes: 100 });
      const largeChunk = "A".repeat(150);

      buffer.append(largeChunk);
      const out = buffer.getOutput();

      expect(buffer.isTruncated()).toBe(true);
      expect(out).toContain("[TRUNCATED: buffer excedió 100 bytes");
      expect(out.length).toBeGreaterThan(0);
    });

    it("bloquea comandos letales en terminal_exec", async () => {
      const terminalTool = createTerminalExecTool();
      const ctx = {
        callId: "test-c3",
        sessionId: "s1",
        workspacePath: tempWorkspace,
      };

      await expect(
        terminalTool.execute({ command: "rm -rf /" }, ctx)
      ).rejects.toThrow(/Comando bloqueado por guardrail de seguridad/i);

      await expect(
        terminalTool.execute({ command: "format C:" }, ctx)
      ).rejects.toThrow(/Comando bloqueado por guardrail de seguridad/i);
    });

    it("ejecuta comandos seguros en terminal local confinado al workspace", async () => {
      const terminalTool = createTerminalExecTool();
      const ctx = {
        callId: "test-c4",
        sessionId: "s1",
        workspacePath: tempWorkspace,
      };

      const result = await terminalTool.execute(
        { command: "node -e \"console.log('EGO_SYSTEM_OK')\"" },
        ctx
      );

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("EGO_SYSTEM_OK");
    });

    it("cancela la ejecución cooperativamente ante AbortSignal (HELM-04)", async () => {
      const terminalTool = createTerminalExecTool();
      const abortController = new AbortController();
      const ctx = {
        callId: "test-c5",
        sessionId: "s1",
        workspacePath: tempWorkspace,
        abortSignal: abortController.signal,
      };

      // Disparar cancelación rápida
      setTimeout(() => abortController.abort(), 100);

      await expect(
        terminalTool.execute(
          { command: "node -e \"setTimeout(() => {}, 10000)\"" },
          ctx
        )
      ).rejects.toThrow(/cancelada por el usuario/i);
    });
  });

  describe("6. registerNativeTools (ACT-04 — Integración completa)", () => {
    it("registra todas las herramientas Nivel A en el ToolRegistry", () => {
      const registry = new ToolRegistry();
      registerNativeTools(registry, { workspacePath: tempWorkspace });

      expect(registry.has("fs_read_file")).toBe(true);
      expect(registry.has("fs_write_file")).toBe(true);
      expect(registry.has("git_status")).toBe(true);
      expect(registry.has("git_diff")).toBe(true);
      expect(registry.has("terminal_exec")).toBe(true);

      const terminalTool = registry.get("terminal_exec");
      expect(terminalTool?.riskLevel).toBe("destructive");
      expect(registry.resolveApprovalRequirement("terminal_exec")).toBe(true);

      const writeTool = registry.get("fs_write_file");
      expect(writeTool?.riskLevel).toBe("sensitive");
      expect(registry.resolveApprovalRequirement("fs_write_file")).toBe(true);

      const readTool = registry.get("fs_read_file");
      expect(readTool?.riskLevel).toBe("safe");
      expect(registry.resolveApprovalRequirement("fs_read_file")).toBe(false);
    });
  });
});
