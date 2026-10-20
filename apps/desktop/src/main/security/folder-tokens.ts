/**
 * T11 (EGO-FIND-54) — Tokens opacos de carpeta (`ipc.projects.selectFolder`).
 *
 * El renderer **nunca** recibe una ruta del sistema de ficheros: pide un
 * diálogo, el main elige la carpeta y emite un token opaco (UUID, TTL 60 s,
 * single-use). El renderer canjea el token por la ruta.
 *
 * Extraído de `main.ts` (god-file) sin cambiar comportamiento observable.
 */
import { randomUUID } from "node:crypto";

/** TTL del token opaco de selectFolder (60 s). */
export const SELECT_FOLDER_TOKEN_TTL_MS = 60_000;

interface FolderTokenEntry {
  folderPath: string;
  expiresAt: number;
}

const folderTokens = new Map<string, FolderTokenEntry>();

/** Emite un token UUID opaco ligado a un path (nunca el path al renderer). */
export function issueFolderToken(folderPath: string): string {
  pruneFolderTokens();
  const token = randomUUID();
  folderTokens.set(token, { folderPath, expiresAt: Date.now() + SELECT_FOLDER_TOKEN_TTL_MS });
  return token;
}

/**
 * Canjea un token opaco por su path. Single-use: se invalida tras el primer
 * uso (éxito o no) y expira a los 60 s. Retorna `null` si es inválido/expirado.
 */
export function redeemFolderToken(token: string): string | null {
  const entry = folderTokens.get(token);
  folderTokens.delete(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry.folderPath;
}

/** Purga tokens expirados (best-effort, nunca lanza). */
export function pruneFolderTokens(now: number = Date.now()): void {
  try {
    for (const [token, entry] of folderTokens) {
      if (now > entry.expiresAt) folderTokens.delete(token);
    }
  } catch {
    // noop
  }
}

/** Solo tests: cantidad de tokens vivos. */
export function folderTokenCountForTests(): number {
  pruneFolderTokens();
  return folderTokens.size;
}
