import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
// Nota: los tipos mínimos de "electron" viven en `./electron-shim.d.ts`
// (solo tipos; en runtime se resuelve vía import dinámico guarded).

export interface CryptoStorageBackend {
  isAvailable(): boolean;
  encrypt(plainText: string): Promise<string> | string;
  decrypt(encryptedText: string): Promise<string> | string;
}

/**
 * Sonda opcional de protección hardware. Los backends reales
 * (`SafeStorageBackend`) la implementan; el manager la usa para
 * flags honestos en vez de asumir `isAvailable()`.
 */
export interface HardwareProtectionProbe {
  isHardwareProtected(): boolean;
}

function hasHardwareProbe(backend: unknown): backend is CryptoStorageBackend & HardwareProtectionProbe {
  if (typeof backend !== "object" || backend === null) return false;
  const probe = (backend as { isHardwareProtected?: unknown }).isHardwareProtected;
  return typeof probe === "function";
}

/**
 * Forma mínima de `Electron.safeStorage` que `SafeStorageBackend` necesita.
 * Se inyecta en tests; en main se resuelve vía `import("electron")` dinámico.
 */
export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

function isSafeStorageLike(value: unknown): value is SafeStorageLike {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["isEncryptionAvailable"] === "function" &&
    typeof record["encryptString"] === "function" &&
    typeof record["decryptString"] === "function"
  );
}

function extractSafeStorage(moduleValue: unknown): SafeStorageLike | null {
  if (typeof moduleValue !== "object" || moduleValue === null) return null;
  const record = moduleValue as Record<string, unknown>;
  const direct = record["safeStorage"];
  if (isSafeStorageLike(direct)) return direct;
  const def = record["default"];
  if (typeof def === "object" && def !== null) {
    const nested = (def as Record<string, unknown>)["safeStorage"];
    if (isSafeStorageLike(nested)) return nested;
  }
  return null;
}

/**
 * Resuelve `safeStorage` de Electron sin declararlo como dependencia del
 * paquete: fuera del main process (tests, renderer) el import dinámico
 * falla y se devuelve `null` (falla suave, sin excepciones).
 */
async function loadElectronSafeStorage(): Promise<SafeStorageLike | null> {
  try {
    const electronModule: unknown = await import("electron");
    return extractSafeStorage(electronModule);
  } catch {
    return null;
  }
}

export const StoredCredentialSchema = z.object({
  service: z.string().min(1),
  account: z.string().min(1),
  encryptedPayload: z.string().min(1),
  createdAtMs: z.number().int().positive(),
  updatedAtMs: z.number().int().positive(),
  isHardwareProtected: z.boolean(),
});

export type StoredCredential = z.infer<typeof StoredCredentialSchema>;

/**
 * Versión del formato de vault firmado (M17). El import rechaza cualquier
 * versión distinta: sin negociación silenciosa de formatos.
 */
export const VAULT_FORMAT_VERSION = 1 as const;

export const VaultExportSchema = z.object({
  version: z.number().int(),
  exportedAtMs: z.number().int().positive(),
  credentials: z.array(StoredCredentialSchema),
  hmac: z.string().min(1),
});

export type VaultExport = z.infer<typeof VaultExportSchema>;

interface VaultPayload {
  version: number;
  exportedAtMs: number;
  credentials: StoredCredential[];
}

function isVaultExport(value: unknown): value is VaultExport {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return "version" in record && "credentials" in record && "hmac" in record;
}

function canonicalVaultPayload(input: VaultPayload): string {
  return JSON.stringify({
    version: input.version,
    exportedAtMs: input.exportedAtMs,
    credentials: input.credentials,
  });
}

function computeVaultHmac(canonical: string, hmacKey: string): string {
  return createHmac("sha256", hmacKey).update(canonical, "utf-8").digest("hex");
}

function verifyVaultHmac(canonical: string, expectedHex: string, hmacKey: string): boolean {
  const actual = computeVaultHmac(canonical, hmacKey);
  const actualBuf = Buffer.from(actual, "utf-8");
  const expectedBuf = Buffer.from(expectedHex, "utf-8");
  if (actualBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(actualBuf, expectedBuf);
}

function requireHmacKey(hmacKey: string | undefined, operation: string): string {
  if (typeof hmacKey !== "string" || hmacKey.trim().length === 0) {
    throw new Error(
      `[CredentialManager] ${operation} de vault firmado exige una clave HMAC no vacía (fail-closed).`
    );
  }
  return hmacKey;
}

/**
 * @testOnly — Backend en memoria con ofuscación base64, SIN cifrado real.
 * Solo para tests. Nunca en producción (C06): los payloads `obf:` son
 * reversibles por cualquiera que lea el vault.
 */
export class InMemoryCryptoBackend implements CryptoStorageBackend {
  // El parámetro se conserva por compatibilidad API; el cifrado real vive
  // en SafeStorageBackend (SEC-03).
  constructor(_sessionKey?: string) {
    console.warn(
      "[InMemoryCryptoBackend] TEST-ONLY: ofuscación base64 sin cifrado real. No usar en producción."
    );
  }

  isAvailable(): boolean {
    return true;
  }

  isHardwareProtected(): boolean {
    return false;
  }

  encrypt(plainText: string): string {
    const encoded = Buffer.from(plainText, "utf-8").toString("base64");
    return `obf:${encoded}`;
  }

  decrypt(encryptedText: string): string {
    if (encryptedText.startsWith("obf:")) {
      const b64 = encryptedText.slice(4);
      return Buffer.from(b64, "base64").toString("utf-8");
    }
    return encryptedText;
  }
}

/**
 * Backend real sobre el llavero del SO vía `Electron.safeStorage`
 * (macOS Keychain, Windows DPAPI, Linux Secret Service).
 *
 * - Vive en `@ego/security` con `import("electron")` dinámico guarded:
 *   fuera del main process (tests, renderer) `isAvailable()` es `false`
 *   explícito y `encrypt`/`decrypt` fallan cerrados en vez de degradar
 *   a ofuscación silenciosa.
 * - Solo emite payloads `enc:` (cifrado real). Acepta `obf:` legacy solo
 *   en lectura para migración.
 * - Para tests, inyectar un `SafeStorageLike` falso por constructor.
 */
export class SafeStorageBackend implements CryptoStorageBackend, HardwareProtectionProbe {
  private readonly injected: SafeStorageLike | null;
  private resolved: SafeStorageLike | null = null;
  private resolutionAttempted = false;

  constructor(injectedSafeStorage?: SafeStorageLike | null) {
    this.injected = injectedSafeStorage ?? null;
  }

  private encryptionAvailable(store: SafeStorageLike): boolean {
    try {
      return store.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  private activeStoreSync(): SafeStorageLike | null {
    const candidate = this.injected ?? this.resolved;
    if (!candidate) return null;
    return this.encryptionAvailable(candidate) ? candidate : null;
  }

  isAvailable(): boolean {
    return this.activeStoreSync() !== null;
  }

  isHardwareProtected(): boolean {
    return this.activeStoreSync() !== null;
  }

  /**
   * Intenta resolver `safeStorage` de Electron (una sola vez). Devuelve
   * `true` si quedó cifrado real disponible. Sin `electron` (tests,
   * renderer) devuelve `false` sin lanzar.
   */
  public async ensureLoaded(): Promise<boolean> {
    if (this.injected) return this.encryptionAvailable(this.injected);
    if (this.resolved) return this.encryptionAvailable(this.resolved);
    if (this.resolutionAttempted) return false;
    this.resolutionAttempted = true;
    const loaded = await loadElectronSafeStorage();
    this.resolved = loaded;
    return loaded !== null && this.encryptionAvailable(loaded);
  }

  private async requireStore(operation: string): Promise<SafeStorageLike> {
    const fromSync = this.activeStoreSync();
    if (fromSync) return fromSync;
    const loaded = await this.ensureLoaded();
    const store = this.injected ?? this.resolved;
    if (!loaded || !store) {
      throw new Error(
        `[SafeStorageBackend] safeStorage no disponible para ${operation} (fuera del main process o cifrado del SO desactivado).`
      );
    }
    return store;
  }

  public async encrypt(plainText: string): Promise<string> {
    if (!plainText) {
      throw new Error("[SafeStorageBackend] No se puede cifrar un texto vacío.");
    }
    const store = await this.requireStore("cifrar");
    const encrypted = store.encryptString(plainText);
    return `enc:${Buffer.from(encrypted).toString("base64")}`;
  }

  public async decrypt(encryptedText: string): Promise<string> {
    if (encryptedText.startsWith("obf:")) {
      return Buffer.from(encryptedText.slice(4), "base64").toString("utf-8");
    }
    if (!encryptedText.startsWith("enc:")) {
      throw new Error("[SafeStorageBackend] Formato no soportado: se esperaba payload `enc:` u `obf:` legacy.");
    }
    const store = await this.requireStore("descifrar");
    return store.decryptString(Buffer.from(encryptedText.slice(4), "base64"));
  }
}

/**
 * Backend síncrono sobre el llavero del SO para el main process de Electron
 * (F1T2 — `Electron.safeStorage` expone API síncrona y los call sites de
 * `apps/desktop/src/main.ts` exigen cifrado síncrono).
 *
 * - Misma semántica fail-closed que `SafeStorageBackend`: sin store
 *   disponible `isAvailable()` es `false` y `encrypt`/`decrypt` lanzan en
 *   vez de degradar a ofuscación silenciosa.
 * - Solo emite payloads `enc:` (cifrado real). Acepta `obf:` legacy solo
 *   en lectura para migración.
 */
export class SyncSafeStorageBackend implements CryptoStorageBackend, HardwareProtectionProbe {
  constructor(private readonly store: SafeStorageLike | null) {}

  private activeStore(): SafeStorageLike | null {
    if (!this.store) return null;
    try {
      return this.store.isEncryptionAvailable() ? this.store : null;
    } catch {
      return null;
    }
  }

  isAvailable(): boolean {
    return this.activeStore() !== null;
  }

  isHardwareProtected(): boolean {
    return this.activeStore() !== null;
  }

  public encrypt(plainText: string): string {
    if (!plainText) {
      throw new Error("[SyncSafeStorageBackend] No se puede cifrar un texto vacío.");
    }
    const store = this.activeStore();
    if (!store) {
      throw new Error(
        "[SyncSafeStorageBackend] safeStorage no disponible para cifrar (fuera del main process o cifrado del SO desactivado)."
      );
    }
    return `enc:${Buffer.from(store.encryptString(plainText)).toString("base64")}`;
  }

  public decrypt(encryptedText: string): string {
    if (encryptedText.startsWith("obf:")) {
      return Buffer.from(encryptedText.slice(4), "base64").toString("utf-8");
    }
    if (!encryptedText.startsWith("enc:")) {
      throw new Error("[SyncSafeStorageBackend] Formato no soportado: se esperaba payload `enc:` u `obf:` legacy.");
    }
    const store = this.activeStore();
    if (!store) {
      throw new Error(
        "[SyncSafeStorageBackend] safeStorage no disponible para descifrar (fuera del main process o cifrado del SO desactivado)."
      );
    }
    return store.decryptString(Buffer.from(encryptedText.slice(4), "base64"));
  }
}

/**
 * CredentialManager Canónico de Ego (SEC-03 / DSEK-05).
 * Centraliza el almacenamiento seguro de API keys y secretos del usuario,
 * desacoplando el almacenamiento de VantaDB del acceso en claro.
 */
export class CredentialManager {
  private backend: CryptoStorageBackend;
  private vault: Map<string, StoredCredential> = new Map();

  constructor(backend?: CryptoStorageBackend) {
    this.backend = backend || new InMemoryCryptoBackend();
  }

  public setBackend(backend: CryptoStorageBackend): void {
    this.backend = backend;
  }

  public isHardwareProtected(): boolean {
    if (hasHardwareProbe(this.backend)) {
      try {
        return this.backend.isHardwareProtected();
      } catch {
        return false;
      }
    }
    return this.backend.isAvailable();
  }

  private buildKey(service: string, account: string): string {
    return `${service.trim().toLowerCase()}::${account.trim().toLowerCase()}`;
  }

  /**
   * Almacena una credencial sensible cifrada.
   */
  public async storeSecret(service: string, account: string, secret: string): Promise<void> {
    if (!secret || secret.trim().length === 0) {
      throw new Error(`[CredentialManager] El secreto para ${service}/${account} no puede estar vacío.`);
    }

    const encrypted = await this.backend.encrypt(secret);
    const key = this.buildKey(service, account);
    const now = Date.now();

    const credential: StoredCredential = {
      service: service.trim(),
      account: account.trim(),
      encryptedPayload: encrypted,
      createdAtMs: this.vault.has(key) ? this.vault.get(key)!.createdAtMs : now,
      updatedAtMs: now,
      isHardwareProtected: this.isHardwareProtected(),
    };

    StoredCredentialSchema.parse(credential);
    this.vault.set(key, credential);
  }

  /**
   * Recupera y descifra una credencial sensible.
   */
  public async getSecret(service: string, account: string): Promise<string | null> {
    const key = this.buildKey(service, account);
    const entry = this.vault.get(key);
    if (!entry) return null;

    try {
      return await this.backend.decrypt(entry.encryptedPayload);
    } catch (err) {
      console.error(`[CredentialManager] Error al descifrar secreto para ${service}/${account}:`, err);
      return null;
    }
  }

  /**
   * Elimina de forma segura una credencial del llavero.
   */
  public deleteSecret(service: string, account: string): boolean {
    const key = this.buildKey(service, account);
    return this.vault.delete(key);
  }

  /**
   * Verifica existencia sin descifrar el payload.
   */
  public hasSecret(service: string, account: string): boolean {
    const key = this.buildKey(service, account);
    return this.vault.has(key);
  }

  /**
   * Enmascara un secreto para su presentación en UI (ej. 'sk-...49af' o '••••••••').
   */
  public static maskSecret(secret: string): string {
    if (!secret) return "";
    if (secret.length <= 8) return "••••••••";
    const prefix = secret.slice(0, 4);
    const suffix = secret.slice(-4);
    return `${prefix}...${suffix}`;
  }

  /**
   * Exporta las credenciales en formato seguro con metadatos.
   */
  public exportVault(): StoredCredential[] {
    return Array.from(this.vault.values());
  }

  /**
   * Exporta el vault en envelope versionado y firmado con HMAC-SHA256 (M17).
   * El HMAC cubre `{version, exportedAtMs, credentials}` en forma canónica
   * JSON; sin clave HMAC falla cerrado (nunca exporta sin firmar).
   */
  public exportVaultSigned(hmacKey: string): VaultExport {
    const key = requireHmacKey(hmacKey, "exportVaultSigned: el export");
    const envelope: VaultPayload = {
      version: VAULT_FORMAT_VERSION,
      exportedAtMs: Date.now(),
      credentials: this.exportVault(),
    };
    const signed: VaultExport = {
      ...envelope,
      hmac: computeVaultHmac(canonicalVaultPayload(envelope), key),
    };
    return VaultExportSchema.parse(signed);
  }

  /**
   * Importa credenciales verificando integridad de esquemas.
   *
   * Acepta el formato legacy (array plano, sin firma — solo para migración)
   * o el envelope firmado `{version, exportedAtMs, credentials, hmac}`.
   * El envelope exige `hmacKey`: verifica versión exacta + HMAC en tiempo
   * constante y rechaza el import ante cualquier manipulación.
   */
  public importVault(credentials: StoredCredential[]): void;
  public importVault(envelope: VaultExport, hmacKey: string): void;
  public importVault(input: StoredCredential[] | VaultExport, hmacKey?: string): void {
    if (isVaultExport(input)) {
      const parsed = VaultExportSchema.parse(input);
      if (parsed.version !== VAULT_FORMAT_VERSION) {
        throw new Error(
          `[CredentialManager] Versión de vault no soportada: ${parsed.version} (se esperaba ${VAULT_FORMAT_VERSION}).`
        );
      }
      const key = requireHmacKey(hmacKey, "importVault: el import de envelope firmado");
      const canonical = canonicalVaultPayload(parsed);
      if (!verifyVaultHmac(canonical, parsed.hmac, key)) {
        throw new Error(
          "[CredentialManager] HMAC del vault inválido: integridad comprometida, import rechazado."
        );
      }
      for (const cred of parsed.credentials) {
        const valid = StoredCredentialSchema.parse(cred);
        this.vault.set(this.buildKey(valid.service, valid.account), valid);
      }
      return;
    }
    for (const cred of input) {
      const parsed = StoredCredentialSchema.parse(cred);
      this.vault.set(this.buildKey(parsed.service, parsed.account), parsed);
    }
  }
}
