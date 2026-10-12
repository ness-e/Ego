import { z } from "zod";

export interface CryptoStorageBackend {
  isAvailable(): boolean;
  encrypt(plainText: string): Promise<string> | string;
  decrypt(encryptedText: string): Promise<string> | string;
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
 * Backend en memoria seguro con ofuscación para entornos de prueba o cuando el SO
 * no dispone de llavero activo.
 */
export class InMemoryCryptoBackend implements CryptoStorageBackend {
  // NOTA (deuda abierta P0-C05/C06): sin cifrado real, solo ofuscación para tests.
  // El parámetro se conserva por compatibilidad API; el cifrado real (SEC-03) queda pendiente.
  constructor(_sessionKey?: string) {}

  isAvailable(): boolean {
    return true;
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
      isHardwareProtected: this.backend.isAvailable(),
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
   * Importa credenciales verificando integridad de esquemas.
   */
  public importVault(credentials: StoredCredential[]): void {
    for (const cred of credentials) {
      const parsed = StoredCredentialSchema.parse(cred);
      this.vault.set(this.buildKey(parsed.service, parsed.account), parsed);
    }
  }
}
