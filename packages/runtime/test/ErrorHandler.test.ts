import { describe, it, expect, beforeEach } from "vitest";
import { ErrorHandler } from "../src/ErrorHandler.js";
import type { ToolCall } from "@ego/models";

describe("@ego/runtime — ErrorHandler & Causal Context Suite (ACT-08 / OCLW-03 / OCLW-04)", () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    handler = new ErrorHandler();
  });

  describe("1. Auto-Reparación Sintáctica y Normalización de Argumentos (OCLW-03, OCLW-04)", () => {
    it("conserva objetos JSON ya conformes", () => {
      const input = { path: "src/index.ts", line: 42, enabled: true };
      const repaired = handler.repairArguments("test_tool", input);
      expect(repaired).toEqual(input);
    });

    it("parsea strings JSON válidos", () => {
      const input = '{"path": "package.json", "format": "json"}';
      const repaired = handler.repairArguments("test_tool", input);
      expect(repaired).toEqual({ path: "package.json", format: "json" });
    });

    it("repara comillas simples y trailing commas de modelos LLM", () => {
      const malformed = "{'file': 'notes.txt', 'lines': 10, }";
      const repaired = handler.repairArguments("test_tool", malformed);
      expect(repaired.file).toBe("notes.txt");
      expect(repaired.lines).toBe(10);
    });

    it("repara JSON truncado cerrando llaves y corchetes abiertos", () => {
      const truncated = '{"query": "search term", "filters": ["tag1", "tag2"';
      const repaired = handler.repairArguments("test_tool", truncated);
      expect(repaired.query).toBe("search term");
      expect(Array.isArray(repaired.filters)).toBe(true);
      expect((repaired.filters as string[])[0]).toBe("tag1");
    });

    it("desenvuelve contenedores redundantes ({ params: {...} }, { arguments: {...} })", () => {
      const redundant = {
        params: {
          target: "output.log",
          verbose: true
        }
      };
      const repaired = handler.repairArguments("test_tool", redundant);
      expect(repaired).toEqual({ target: "output.log", verbose: true });
    });

    it("coacciona strings numéricos y booleanos", () => {
      const uncoerced = {
        timeout: "5000",
        active: "true",
        disabled: "false"
      };
      const repaired = handler.repairArguments("test_tool", uncoerced);
      expect(repaired.timeout).toBe(5000);
      expect(repaired.active).toBe(true);
      expect(repaired.disabled).toBe(false);
    });
  });

  describe("2. Manejo de Herramienta Inexistente con Sugerencias Difusas", () => {
    it("clasifica TOOL_NOT_FOUND y sugiere alternativas cercanas", () => {
      const call: ToolCall = {
        id: "call_1",
        name: "read_file",
        arguments: { path: "doc.txt" }
      };
      const available = ["fs_read_file", "fs_write_file", "terminal_exec"];

      const enriched = handler.handleToolNotFound(call, available);

      expect(enriched.category).toBe("TOOL_NOT_FOUND");
      expect(enriched.suggestedTools).toContain("fs_read_file");
      expect(enriched.remedyHint).toContain("fs_read_file");
    });
  });

  describe("3. Errores de Validación Zod con Desglose Amigable", () => {
    it("clasifica VALIDATION_FAILED y desglosa campos faltantes o inválidos", () => {
      const call: ToolCall = {
        id: "call_2",
        name: "fs_write_file",
        arguments: { path: "hello.txt" } // falta 'content'
      };

      const zodErrorMock = {
        issues: [
          {
            path: ["content"],
            message: "Required",
            code: "invalid_type"
          }
        ]
      };

      const enriched = handler.handleValidationError(call, zodErrorMock);

      expect(enriched.category).toBe("VALIDATION_FAILED");
      expect(enriched.validationDetails).toHaveLength(1);
      expect(enriched.validationDetails?.[0].path).toBe("content");
      expect(enriched.message).toContain("content");
      expect(enriched.remedyHint).toBeDefined();
    });
  });

  describe("4. Clasificación Causal de Errores de Ejecución Material", () => {
    const makeCall = (name: string): ToolCall => ({
      id: "call_x",
      name,
      arguments: {}
    });

    it("identifica FILE_NOT_FOUND ante errores ENOENT", () => {
      const call = makeCall("fs_read_file");
      const enriched = handler.handleExecutionError(
        call,
        "ENOENT: no such file or directory, open 'src/missing.ts'"
      );
      expect(enriched.category).toBe("FILE_NOT_FOUND");
      expect(enriched.remedyHint).toContain("fs_read_file");
    });

    it("identifica PERMISSION_DENIED ante violaciones de sandbox o EACCES", () => {
      const call = makeCall("fs_write_file");
      const enriched = handler.handleExecutionError(
        call,
        "EACCES: permission denied o fuera del sandbox permitido"
      );
      expect(enriched.category).toBe("PERMISSION_DENIED");
      expect(enriched.remedyHint).toContain("workspace");
    });

    it("identifica EXECUTION_TIMEOUT ante tiempo de espera excedido", () => {
      const call = makeCall("terminal_exec");
      const enriched = handler.handleExecutionError(
        call,
        "Execution timed out after 30000ms"
      );
      expect(enriched.category).toBe("EXECUTION_TIMEOUT");
      expect(enriched.remedyHint).toContain("tiempo límite");
    });

    it("identifica PROCESS_FAILED ante códigos de salida no-cero", () => {
      const call = makeCall("terminal_exec");
      const enriched = handler.handleExecutionError(
        call,
        "Command failed with exit code 1: gcc missing"
      );
      expect(enriched.category).toBe("PROCESS_FAILED");
      expect(enriched.remedyHint).toContain("código de error");
    });

    it("asigna UNKNOWN_ERROR ante fallos genéricos", () => {
      const call = makeCall("custom_tool");
      const enriched = handler.handleExecutionError(
        call,
        "Unexpected hardware entropy glitch"
      );
      expect(enriched.category).toBe("UNKNOWN_ERROR");
    });
  });

  describe("5. LoopGuard — Detección de Bucles de Reintento Idéntico", () => {
    it("detecta LOOP_DETECTED si el modelo reintenta exactamente la misma llamada fallida consecutivamente", () => {
      const call: ToolCall = {
        id: "call_repeat_1",
        name: "fs_read_file",
        arguments: { path: "nonexistent.txt" }
      };

      // Primer fallo
      const first = handler.handleExecutionError(call, "ENOENT: file not found");
      expect(first.category).toBe("FILE_NOT_FOUND");
      expect(first.isLoopRisk).toBeFalsy();

      // Segundo fallo con idéntica firma de llamada
      const secondCall: ToolCall = {
        id: "call_repeat_2",
        name: "fs_read_file",
        arguments: { path: "nonexistent.txt" }
      };
      const second = handler.handleExecutionError(secondCall, "ENOENT: file not found");

      expect(second.category).toBe("LOOP_DETECTED");
      expect(second.isLoopRisk).toBe(true);
      expect(second.remedyHint).toContain("Detén los reintentos idénticos");
    });

    it("resetea el tracking de fallos cuando una llamada tiene éxito", () => {
      const call: ToolCall = {
        id: "call_1",
        name: "fs_read_file",
        arguments: { path: "bad.txt" }
      };
      handler.handleExecutionError(call, "ENOENT: not found");

      // Notificar éxito
      handler.notifySuccess();

      // Nueva llamada idéntica ya no es consecutiva
      const retryCall: ToolCall = {
        id: "call_2",
        name: "fs_read_file",
        arguments: { path: "bad.txt" }
      };
      const result = handler.handleExecutionError(retryCall, "ENOENT: not found");
      expect(result.category).toBe("FILE_NOT_FOUND");
    });
  });

  describe("6. Formato de Salida JSON para el Modelo", () => {
    it("formatea la respuesta estructurada de forma compacta y legible", () => {
      const call: ToolCall = {
        id: "call_fmt",
        name: "fs_read_file",
        arguments: { path: "missing.json" }
      };
      const enriched = handler.handleExecutionError(call, "ENOENT: missing file");
      const jsonStr = handler.formatErrorResponse(enriched);

      const parsed = JSON.parse(jsonStr);
      expect(parsed.status).toBe("error");
      expect(parsed.category).toBe("FILE_NOT_FOUND");
      expect(parsed.tool).toBe("fs_read_file");
      expect(parsed.hint).toBeDefined();
    });
  });
});
