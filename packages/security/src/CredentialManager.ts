import { z } from "zod";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
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

/**
 * Cooldown default ante 429/rate-limit: la key castigada no se reintenta
 * hasta pasado este ventana (inyectable en tests vía `nowMs`).
 */
export const CREDENTIAL_POOL_DEFAULT_COOLDOWN_MS = 60_000 as const;

/** Longitud del fingerprint opaco de slot (hex SHA-256, no reversible). */
export const CREDENTIAL_POOL_FINGERPRINT_LENGTH = 16 as const;

export interface CredentialPoolOptions {
  cooldownMs?: number;
  nowMs?: () => number;
}

function normalizePoolProviderStrict(provider: string): string {
  const normalized = provider.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new Error("[CredentialPool] El proveedor no puede estar vacío (fail-closed).");
  }
  return normalized;
}

function normalizePoolProviderLenient(provider: string): string {
  return provider.trim().toLowerCase();
}

function fingerprintSecret(secret: string): string {
  return createHash("sha256")
    .update(secret, "utf-8")
    .digest("hex")
    .slice(0, CREDENTIAL_POOL_FINGERPRINT_LENGTH);
}

/**
 * Pool multi-key por proveedor con rotación ante rate-limit (T21).
 *
 * - Los secretos viven SOLO en el `CredentialManager` (cifrados por el
 *   backend); el pool guarda orden + cooldowns + fingerprints opacos.
 * - `getActiveKey` retorna `null` si no hay slot utilizable (vacío o todo
 *   en cooldown): fail-closed, el llamador cae a su fallback seguro.
 * - Fuera del pool NUNCA sale una key en claro salvo por `getActiveKey`
 *   (canal hacia el provider en main); logs e introspección usan
 *   fingerprints SHA-256 no reversibles.
 */
export class CredentialPool {
  private readonly manager: CredentialManager;
  private readonly cooldownMs: number;
  private readonly nowMs: () => number;
  private readonly order = new Map<string, string[]>();
  private readonly cursor = new Map<string, number>();
  private readonly cooldownUntil = new Map<string, number>();

  constructor(manager: CredentialManager, opts: CredentialPoolOptions = {}) {
    const cooldownMs = opts.cooldownMs ?? CREDENTIAL_POOL_DEFAULT_COOLDOWN_MS;
    if (!Number.isFinite(cooldownMs) || cooldownMs <= 0) {
      throw new Error("[CredentialPool] `cooldownMs` debe ser un número positivo.");
    }
    this.manager = manager;
    this.cooldownMs = cooldownMs;
    this.nowMs = opts.nowMs ?? Date.now;
  }

  private serviceFor(provider: string): string {
    return `models/${provider}/pool`;
  }

  private cooldownKey(provider: string, fingerprint: string): string {
    return `${provider}::${fingerprint}`;
  }

  private peekActive(provider: string): { fingerprint: string; index: number } | null {
    const slots = this.order.get(provider);
    if (!slots || slots.length === 0) return null;
    const now = this.nowMs();
    const start = this.cursor.get(provider) ?? 0;
    for (let step = 0; step < slots.length; step++) {
      const index = (start + step) % slots.length;
      const fingerprint = slots[index] as string;
      const until = this.cooldownUntil.get(this.cooldownKey(provider, fingerprint)) ?? 0;
      if (until <= now) return { fingerprint, index };
    }
    return null;
  }

  /**
   * Reemplaza el pool del proveedor (sin OAuth todavía: keys directas).
   * Valida TODO antes de escribir: ante un secreto inválido no persiste
   * nada parcial (fail-closed). Limpia del vault los slots desplazados.
   */
  public async setProviderKeys(provider: string, secrets: string[]): Promise<void> {
    const normalized = normalizePoolProviderStrict(provider);
    const unique: Array<{ fingerprint: string; secret: string }> = [];
    const seen = new Set<string>();
    for (const secret of secrets) {
      if (typeof secret !== "string" || secret.trim().length === 0) {
        throw new Error(
          `[CredentialPool] Secreto vacío para '${normalized}': el pool no acepta slots sin key (fail-closed).`
        );
      }
      const fingerprint = fingerprintSecret(secret);
      if (!seen.has(fingerprint)) {
        seen.add(fingerprint);
        unique.push({ fingerprint, secret });
      }
    }
    const service = this.serviceFor(normalized);
    for (const slot of unique) {
      await this.manager.storeSecret(service, slot.fingerprint, slot.secret);
    }
    const previous = this.order.get(normalized) ?? [];
    const fresh = new Set(unique.map((slot) => slot.fingerprint));
    for (const old of previous) {
      if (!fresh.has(old)) this.manager.deleteSecret(service, old);
    }
    this.order.set(normalized, unique.map((slot) => slot.fingerprint));
    this.cursor.set(normalized, 0);
    for (const key of Array.from(this.cooldownUntil.keys())) {
      if (key.startsWith(`${normalized}::`)) this.cooldownUntil.delete(key);
    }
  }

  /**
   * Agrega una key al pool (deduplica por fingerprint estable).
   * Retorna el fingerprint opaco del slot (apto para logs).
   */
  public async addProviderKey(provider: string, secret: string): Promise<string> {
    const normalized = normalizePoolProviderStrict(provider);
    if (typeof secret !== "string" || secret.trim().length === 0) {
      throw new Error(
        `[CredentialPool] Secreto vacío para '${normalized}': el pool no acepta slots sin key (fail-closed).`
      );
    }
    const fingerprint = fingerprintSecret(secret);
    const slots = this.order.get(normalized) ?? [];
    if (!slots.includes(fingerprint)) {
      await this.manager.storeSecret(this.serviceFor(normalized), fingerprint, secret);
      this.order.set(normalized, [...slots, fingerprint]);
      if (!this.cursor.has(normalized)) this.cursor.set(normalized, 0);
    }
    return fingerprint;
  }

  public getPoolSize(provider: string): number {
    return this.order.get(normalizePoolProviderLenient(provider))?.length ?? 0;
  }

  /** Fingerprints del pool (introspección sin secretos). */
  public listFingerprints(provider: string): string[] {
    return [...(this.order.get(normalizePoolProviderLenient(provider)) ?? [])];
  }

  /** Key activa descifrada o `null` si no hay slot utilizable (fail-closed). */
  public async getActiveKey(provider: string): Promise<string | null> {
    const normalized = normalizePoolProviderLenient(provider);
    if (normalized.length === 0) return null;
    const active = this.peekActive(normalized);
    if (!active) return null;
    return this.manager.getSecret(this.serviceFor(normalized), active.fingerprint);
  }

  /** Fingerprint de la key activa o `null` (apto para logs, nunca el secreto). */
  public getActiveFingerprint(provider: string): string | null {
    const normalized = normalizePoolProviderLenient(provider);
    if (normalized.length === 0) return null;
    return this.peekActive(normalized)?.fingerprint ?? null;
  }

  /**
   * Castiga la key activa con cooldown y avanza el cursor (rotación).
   * Sin slot activo es no-op (nunca lanza en el path de error del router).
   */
  public async reportRateLimited(provider: string): Promise<void> {
    const normalized = normalizePoolProviderLenient(provider);
    if (normalized.length === 0) return;
    const active = this.peekActive(normalized);
    if (!active) return;
    const slots = this.order.get(normalized) ?? [];
    this.cooldownUntil.set(
      this.cooldownKey(normalized, active.fingerprint),
      this.nowMs() + this.cooldownMs
    );
    this.cursor.set(normalized, slots.length > 0 ? (active.index + 1) % slots.length : 0);
  }
}
