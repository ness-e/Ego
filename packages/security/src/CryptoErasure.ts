/**
 * CryptoErasure — Purga criptográfica verificable a nivel API (SEC-07 / Fase 11).
 *
 * Borrado realista a nivel aplicación, en este orden:
 * 1. Sobrescritura: N pasadas de tombstones aleatorios vía `put` (por defecto 3).
 * 2. Rotación de claves: el epoch del scope se rota y el secreto anterior se
 *    pone a cero, de modo que lo sellado con claves derivadas previas ya no abre.
 * 3. `delete` del registro.
 * 4. Verificación de lectura: `get` debe retornar null y `list` (si existe) no
 *    debe contener la clave. Si el registro sobrevive → `ErasureVerificationError`
 *    (fail-closed: nunca se emite un receipt `verified:true` falso).
 *
 * Tipado estructural del store: NO importa `@ego/memory` (cero aristas nuevas
 * entre paquetes, como `SecretsFilter`); `EgoMemoryAdapter` satisface
 * `ErasureStore` y el wiring real vive fuera de este módulo.
 *
 * LÍMITE HONESTO (Fjall/LSM): el borrado físico en disco depende del motor
 * LSM (segmentos inmutables, WAL, compactación, snapshots). Este módulo
 * garantiza irrecuperabilidad a nivel API + destrucción del material de
 * claves; el receipt lo declara en `physicalErasure: "api-level-only"`.
 * Nunca promete borrado físico del LSM.
 */
import * as crypto from "node:crypto";

export interface ErasureStoreRecord {
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

export interface ErasurePut {
  namespace: string;
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

/** Subconjunto estructural de lectura/escritura que `EgoMemoryAdapter` satisface. */
export interface ErasureStore {
  get(namespace: string, key: string): Promise<ErasureStoreRecord | null>;
  put(item: ErasurePut): Promise<void>;
  delete(namespace: string, key: string): Promise<boolean | void>;
  list?(namespace: string, limit?: number): Promise<ErasureStoreRecord[]>;
}

export interface DerivedKey {
  keyId: string;
  key: Buffer;
}

export interface SealedEnvelope {
  keyId: string;
  nonce: string;
  ciphertext: string;
}

export type ErasureStatus = "erased" | "not-found";

export interface ErasureReceipt {
  namespace: string;
  key: string;
  status: ErasureStatus;
  overwritePasses: number;
  /** keyId del nuevo epoch tras la rotación; null si el scope no tenía claves. */
  keyId: string | null;
  keyRotated: boolean;
  verified: true;
  verifiedAt: number;
  /** Siempre `"api-level-only"`: el borrado físico del LSM no se promete. */
  physicalErasure: "api-level-only";
}

export class ErasureVerificationError extends Error {
  readonly namespace: string;
  readonly key: string;
  readonly cause_: "still-readable" | "still-listed";
  readonly detail?: unknown;
  constructor(
    namespace: string,
    key: string,
    cause_: ErasureVerificationError["cause_"],
    detail?: unknown
  ) {
    super(
      `[CryptoErasure] Purga NO verificada para ${namespace}:${key} (${cause_}); ` +
        `el registro sigue recuperable a nivel API`
    );
    this.name = "ErasureVerificationError";
    this.namespace = namespace;
    this.key = key;
    this.cause_ = cause_;
    this.detail = detail;
  }
}

const KEY_ID_EPOCH_SEP = "#e";

/**
 * Registro de epochs por scope. Cada scope tiene UN secreto activo (32 bytes);
 * la clave de cifrado se deriva por llamada vía HMAC-SHA-256 (nunca se
 * almacena). `rotate` genera un secreto nuevo y pone a cero el anterior:
 * las claves derivadas previas quedan criptográficamente huérfanas.
 */
export class ScopeKeyRegistry {
  private epochs = new Map<string, { epoch: number; secret: Buffer }>();

  private static scopeOf(keyId: string): { scope: string; epoch: number } {
    const idx = keyId.lastIndexOf(KEY_ID_EPOCH_SEP);
    if (idx <= 0) throw new Error("[ScopeKeyRegistry] keyId malformado");
    const epoch = Number(keyId.slice(idx + KEY_ID_EPOCH_SEP.length));
    if (!Number.isInteger(epoch) || epoch < 1) {
      throw new Error("[ScopeKeyRegistry] keyId malformado");
    }
    return { scope: keyId.slice(0, idx), epoch };
  }

  private static assertScope(scope: string): void {
    if (!scope || scope.includes(KEY_ID_EPOCH_SEP)) {
      throw new TypeError(
        "[ScopeKeyRegistry] scope inválido (vacío o contiene '#e')"
      );
    }
  }

  has(scope: string): boolean {
    return this.epochs.has(scope);
  }

  deriveKey(scope: string): DerivedKey {
    ScopeKeyRegistry.assertScope(scope);
    let entry = this.epochs.get(scope);
    if (!entry) {
      entry = { epoch: 1, secret: crypto.randomBytes(32) };
      this.epochs.set(scope, entry);
    }
    const key = crypto.createHmac("sha256", entry.secret).update(scope, "utf8").digest();
    return { keyId: `${scope}${KEY_ID_EPOCH_SEP}${entry.epoch}`, key };
  }

  rotate(scope: string): { oldKeyId: string | null; newKeyId: string } {
    ScopeKeyRegistry.assertScope(scope);
    const prev = this.epochs.get(scope);
    const oldKeyId = prev ? `${scope}${KEY_ID_EPOCH_SEP}${prev.epoch}` : null;
    if (prev) prev.secret.fill(0);
    const next = { epoch: (prev?.epoch ?? 0) + 1, secret: crypto.randomBytes(32) };
    this.epochs.set(scope, next);
    return { oldKeyId, newKeyId: `${scope}${KEY_ID_EPOCH_SEP}${next.epoch}` };
  }

  destroy(scope: string): boolean {
    const prev = this.epochs.get(scope);
    if (!prev) return false;
    prev.secret.fill(0);
    this.epochs.delete(scope);
    return true;
  }

  seal(scope: string, plaintext: string): SealedEnvelope {
    const { keyId, key } = this.deriveKey(scope);
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
    key.fill(0);
    return { keyId, nonce: nonce.toString("hex"), ciphertext: ciphertext.toString("hex") };
  }

  open(envelope: SealedEnvelope): string {
    const { scope, epoch } = ScopeKeyRegistry.scopeOf(envelope.keyId);
    const entry = this.epochs.get(scope);
    if (!entry || entry.epoch !== epoch) {
      throw new Error("[ScopeKeyRegistry] clave desconocida o destruida (purga efectiva)");
    }
    const key = crypto.createHmac("sha256", entry.secret).update(scope, "utf8").digest();
    try {
      const raw = Buffer.from(envelope.ciphertext, "hex");
      const authTag = raw.subarray(raw.length - 16);
      const data = raw.subarray(0, raw.length - 16);
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(envelope.nonce, "hex")
      );
      decipher.setAuthTag(authTag);
      return decipher.update(data).toString("utf8") + decipher.final().toString("utf8");
    } finally {
      key.fill(0);
    }
  }
}

export interface CryptoErasureOptions {
  /** Pasadas de sobrescritura previas al delete. Defecto 3, mínimo 1. */
  overwritePasses?: number;
  /** Registro de claves por scope; null = solo sobrescritura+delete+verificación. */
  registry?: ScopeKeyRegistry | null;
}

export class CryptoErasure {
  private readonly store: ErasureStore;
  private readonly passes: number;
  private readonly registry: ScopeKeyRegistry | null;

  constructor(store: ErasureStore, options: CryptoErasureOptions = {}) {
    if (!store) throw new TypeError("[CryptoErasure] store requerido");
    this.store = store;
    this.passes = Math.max(1, Math.floor(options.overwritePasses ?? 3));
    this.registry = options.registry ?? null;
  }

  private static assertTarget(namespace: string, key: string): void {
    if (!namespace || !key) {
      throw new TypeError("[CryptoErasure] namespace y key no vacíos (fail-closed)");
    }
  }

  private static scopeFor(namespace: string, key: string): string {
    return `${namespace}:${key}`;
  }

  async eraseOne(namespace: string, key: string): Promise<ErasureReceipt> {
    CryptoErasure.assertTarget(namespace, key);
    const existing = await this.store.get(namespace, key);
    const scope = CryptoErasure.scopeFor(namespace, key);
    const hadKeys = this.registry?.has(scope) ?? false;

    if (!existing) {
      // Idempotencia: nada que borrar, pero el material de claves del scope
      // también se purga si existía (defensa en profundidad).
      let keyId: string | null = null;
      if (hadKeys) keyId = (this.registry as ScopeKeyRegistry).rotate(scope).newKeyId;
      return {
        namespace,
        key,
        status: "not-found",
        overwritePasses: 0,
        keyId,
        keyRotated: hadKeys,
        verified: true,
        verifiedAt: Date.now(),
        physicalErasure: "api-level-only",
      };
    }

    for (let pass = 1; pass <= this.passes; pass++) {
      await this.store.put({
        namespace,
        key,
        payload: {
          erased: true,
          pass,
          nonce: crypto.randomBytes(16).toString("hex"),
        },
        metadata: { erasure_pass: pass, erased_at: Date.now() },
      });
    }

    let keyId: string | null = null;
    let keyRotated = false;
    if (this.registry && hadKeys) {
      keyId = this.registry.rotate(scope).newKeyId;
      keyRotated = true;
    }

    await this.store.delete(namespace, key).catch((err: unknown) => {
      throw new ErasureVerificationError(namespace, key, "still-readable", err);
    });

    const reread = await this.store.get(namespace, key);
    if (reread !== null) {
      throw new ErasureVerificationError(namespace, key, "still-readable");
    }
    if (typeof this.store.list === "function") {
      const listed = await this.store.list(namespace, 1000);
      if (listed.some((r) => r.key === key)) {
        throw new ErasureVerificationError(namespace, key, "still-listed");
      }
    }

    return {
      namespace,
      key,
      status: "erased",
      overwritePasses: this.passes,
      keyId,
      keyRotated,
      verified: true,
      verifiedAt: Date.now(),
      physicalErasure: "api-level-only",
    };
  }

  async eraseMany(namespace: string, keys: string[]): Promise<ErasureReceipt[]> {
    const receipts: ErasureReceipt[] = [];
    for (const key of keys) {
      receipts.push(await this.eraseOne(namespace, key));
    }
    return receipts;
  }

  /**
   * Purga todo un namespace; requiere `list` en el store. Re-lista hasta
   * vaciar (sin truncamiento silencioso en namespaces grandes): cada vuelta
   * verifica sus propios borrados, por lo que un fallo aborta con
   * `ErasureVerificationError` en vez de declarar éxito parcial.
   */
  async eraseNamespace(namespace: string): Promise<ErasureReceipt[]> {
    if (!namespace) throw new TypeError("[CryptoErasure] namespace no vacío (fail-closed)");
    if (typeof this.store.list !== "function") {
      throw new Error("[CryptoErasure] eraseNamespace requiere store.list");
    }
    const receipts: ErasureReceipt[] = [];
    for (let round = 0; round < 1000; round++) {
      const records = await this.store.list(namespace, 1000);
      const keys = [...new Set(records.map((r) => r.key))];
      if (keys.length === 0) return receipts;
      for (const key of keys) {
        receipts.push(await this.eraseOne(namespace, key));
      }
    }
    throw new Error("[CryptoErasure] eraseNamespace no converge tras 1000 rondas");
  }
}
