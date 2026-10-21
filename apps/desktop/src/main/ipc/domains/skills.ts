/**
 * T3 (Ola 5) — Canal IPC `ipc.skills.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import { ScanSkillsSchema } from "../../../ipc/schema.js";
import {
  assertPathInScope,
  filterPathsInScope,
} from "../../path-scope.js";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.skills.*`. */
export function registerSkillsIpc(deps: IpcDeps): void {
  const {
    currentScopeDirs,
    skillScanner,
  } = deps;

  ipcMain.handle("ipc.skills.listLocal", async (_e, rawReq: unknown) => {
    const parseResult = ScanSkillsSchema.safeParse(rawReq || {});
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Parámetros de escaneo de skills inválidos: ${parseResult.error.message}`);
    }

    // T2 (EGO-FIND-26): `searchPaths` / `projectRoot` vienen del renderer
    // (untrusted). `SkillScanner.scan` hace `readdirSync`/`readFileSync`
    // recursivo → sin validación de scope, el renderer podía enumerar y
    // leer directorios arbitrarios del SO. Se filtra al alcance del workspace.
    const scopeDirs = currentScopeDirs();
    const requested = parseResult.data.searchPaths ?? [];
    const allowedPaths = filterPathsInScope(requested, scopeDirs);
    if (requested.length > 0 && allowedPaths.length === 0) {
      return {
        ok: false,
        error:
          "searchPaths fuera del alcance del workspace (fail-closed): no se escanea ninguna ruta.",
      };
    }
    const projectRoot = parseResult.data.projectRoot
      ? assertPathInScope(parseResult.data.projectRoot, scopeDirs, "projectRoot")
      : null;
    if (projectRoot && !projectRoot.ok) {
      return { ok: false, error: projectRoot.reason };
    }

    return skillScanner.scan({
      ...(allowedPaths.length > 0 ? { searchPaths: allowedPaths } : {}),
      ...(projectRoot && projectRoot.ok ? { projectRoot: projectRoot.path } : {}),
    });
  });
}
