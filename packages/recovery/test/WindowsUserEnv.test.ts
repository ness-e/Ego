import { describe, it, expect } from "vitest";
import {
  parseRegQueryValue,
  expandWindowsEnvRefs,
  readWindowsUserEnvVar,
  repairWindowsUserPath,
} from "../src/WindowsUserEnv.js";

describe("HERM-06: WindowsUserEnv (User Environment Recovery)", () => {
  it("parseRegQueryValue extrae correctamente el valor de salida de reg query", () => {
    const stdout = `
HKEY_CURRENT_USER\\Environment
    PATH    REG_EXPAND_SZ    C:\\Users\\Eros\\AppData\\Local\\pnpm;C:\\Program Files\\Git\\cmd
    EGO_HOME    REG_SZ    D:\\EgoData
`;
    expect(parseRegQueryValue(stdout, "PATH")).toBe(
      "C:\\Users\\Eros\\AppData\\Local\\pnpm;C:\\Program Files\\Git\\cmd"
    );
    expect(parseRegQueryValue(stdout, "EGO_HOME")).toBe("D:\\EgoData");
    expect(parseRegQueryValue(stdout, "INEXISTENTE")).toBeNull();
  });

  it("expandWindowsEnvRefs expande variables %VAR% contra el mapa de entorno", () => {
    const env = { USERPROFILE: "C:\\Users\\Eros", LOCALAPPDATA: "C:\\Users\\Eros\\AppData\\Local" };
    const expanded = expandWindowsEnvRefs("%USERPROFILE%\\.cargo\\bin;%LOCALAPPDATA%\\Programs", env);
    expect(expanded).toBe("C:\\Users\\Eros\\.cargo\\bin;C:\\Users\\Eros\\AppData\\Local\\Programs");
  });

  it("readWindowsUserEnvVar retorna null en plataformas distintas de win32 sin ejecutar subprocesos", () => {
    const result = readWindowsUserEnvVar("PATH", {
      platform: "linux",
      exec: () => {
        throw new Error("No debe ejecutarse en linux");
      },
    });
    expect(result).toBeNull();
  });

  it("readWindowsUserEnvVar ejecuta query en win32 y parsea el resultado", () => {
    const mockExec = () => `
HKEY_CURRENT_USER\\Environment
    PNPM_HOME    REG_SZ    %USERPROFILE%\\pnpm
`;
    const result = readWindowsUserEnvVar("PNPM_HOME", {
      platform: "win32",
      env: { USERPROFILE: "C:\\Users\\Alice" },
      exec: mockExec,
    });
    expect(result).toBe("C:\\Users\\Alice\\pnpm");
  });

  it("repairWindowsUserPath inyecta segmentos faltantes al process.env.PATH", () => {
    const mockEnv: NodeJS.ProcessEnv = {
      PATH: "C:\\Windows\\System32;C:\\Windows",
      USERPROFILE: "C:\\Users\\Bob",
    };
    const mockExec = () => `
HKEY_CURRENT_USER\\Environment
    PATH    REG_EXPAND_SZ    C:\\Windows\\System32;%USERPROFILE%\\AppData\\Local\\pnpm
`;
    const repaired = repairWindowsUserPath({
      platform: "win32",
      env: mockEnv,
      exec: mockExec,
    });

    expect(repaired).toBe(true);
    expect(mockEnv.PATH).toContain("C:\\Users\\Bob\\AppData\\Local\\pnpm");
  });
});
