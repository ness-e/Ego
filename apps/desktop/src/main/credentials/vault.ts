/**
 * T11 (EGO-FIND-54) — Vault de credenciales del main process.
 *
 * Extraído de `main.ts` (god-file) sin cambiar comportamiento:
 *  - `encryptCredential` / `decryptCredential`: safeStorage del SO
 *    (Keychain/DPAPI). Sin cifrado disponible → ofuscación legada `obf:`
 *    (migración), NUNCA texto plano.
 *  - `maskApiKey`: enmascarado para respuestas al renderer.
 *
 * Este módulo es la ÚNICA fuente de verdad del cifrado en el main: el
 * renderer nunca ve un secreto en claro.
 */
import { safeStorage } from "electron";
import { CredentialManager, SyncSafeStorageBackend } from "@ego/security";

/**
 * Backend de cifrado canónico (@ego/security) sobre el safeStorage real del
 * main process (F1T2). La lógica cripto (prefijos `enc:`/`obf:`, base64,
 * errores fail-closed) vive en el paquete; este bloque solo adapta su API
 * síncrona, que es la que exigen los call sites de settings. El restore
 * `gov/settings` no cambia de semántica: vacío → `""`, sin cifrado del
 * SO → ofuscación legada `obf:` con warn (migración), nunca texto plano.
 *
 * ## POR QUÉ el store NO se decide en el import (bug corregido 2026-10-20)
 * `safeStorage.isEncryptionAvailable()` devuelve **false hasta que la app
 * está lista**: en Electron, el backend criptográfico del SO (DPAPI en
 * Windows, Keychain en macOS) se inicializa durante `app.whenReady()`.
 * Medido en esta máquina con una sonda dedicada:
 *
 *   ANTES de `app.whenReady()`  → isEncryptionAvailable = false
 *   DESPUÉS de `app.whenReady()` → isEncryptionAvailable = true
 *
 * Este módulo se evalúa en el grafo de imports del main process, es decir
 * ANTES de `app.whenReady()`. Evaluar ahí la disponibilidad y pasar `null`
 * cuando aún no lo está dejaba el backend **permanentemente** incapaz de
 * cifrar durante toda la vida del proceso, aunque 100 ms después la app
 * estuviera lista. De ahí el crash de arranque: `storeSecret` → `encrypt` →
 * "safeStorage no disponible para cifrar".
 *
 * La solución es pasar un **adaptador vivo**: `SyncSafeStorageBackend`
 * re-consulta `isEncryptionAvailable()` en CADA operación (`activeStore()`),
 * así que decide en el momento del uso, no en el del import. Antes de
 * `app.whenReady()` sigue fallando en cerrado (fail-closed correcto);
 * después, cifra con el keychain del SO.
 */
export const mainProcessCryptoBackend = new SyncSafeStorageBackend(
  typeof safeStorage !== "undefined"
    ? {
        isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
        encryptString: (plainText: string) => safeStorage.encryptString(plainText),
        decryptString: (encrypted: Buffer) => safeStorage.decryptString(encrypted),
      }
    : null
);

/**
 * Cifra una credencial sensible usando safeStorage del SO (Keychain/DPAPI).
 * Prohibición absoluta de guardar API keys en texto plano en VantaDB.
 */
export function encryptCredential(plainText: string): string {
  if (!plainText) return "";
  try {
    return mainProcessCryptoBackend.encrypt(plainText);
  } catch (err) {
    console.warn("[Security] Fallo al cifrar con safeStorage, usando ofuscación legada:", err);
    return `obf:${Buffer.from(plainText, "utf-8").toString("base64")}`;
  }
}

/**
 * Backend degradado con la misma semántica que `encryptCredential`: intenta
 * safeStorage real y, si no está disponible (fail-closed del backend),
 * ofusca `obf:` reversible en memoria. Existe porque `SyncSafeStorageBackend`
 * lanza sin cifrado del SO y el pool de T21 lo usa en el path de guardado
 * (BUGFIX 2026-10-15: sin esto, `saveModelConfig` moría en `setProviderKeys`).
 * Nunca texto plano; `decrypt` acepta `obf:` y `enc:`.
 */
export class DegradedObfBackend {
  isAvailable(): boolean {
    try {
      return mainProcessCryptoBackend.isAvailable();
    } catch {
      return false;
    }
  }
  encrypt(plainText: string): string {
    try {
      return mainProcessCryptoBackend.encrypt(plainText);
    } catch {
      return `obf:${Buffer.from(plainText, "utf-8").toString("base64")}`;
    }
  }
  decrypt(encryptedText: string): string {
    try {
      return mainProcessCryptoBackend.decrypt(encryptedText);
    } catch {
      return encryptedText;
    }
  }
}

/**
 * Descifra una credencial sensible protegida por safeStorage del SO.
 */
export function decryptCredential(stored: string): string {
  if (!stored) return "";
  try {
    return mainProcessCryptoBackend.decrypt(stored);
  } catch (err) {
    console.warn("[Security] Fallo al descifrar credencial con safeStorage:", err);
  }
  return stored;
}

/**
 * Enmascara una API key para devolver a la UI sin exponer el secreto en claro (ej. sk-...3a8f).
 */
export function maskApiKey(key: string): string {
  return CredentialManager.maskSecret(key);
}

/** Alias del enmascarado de keys para respuestas hacia el renderer (nunca el secreto). */
export const maskKey = maskApiKey;