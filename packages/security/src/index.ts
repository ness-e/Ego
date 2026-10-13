/**
 * @ego/security — Credential Manager canónico de Ego (SEC-03 / Fase 11).
 *
 * Centraliza el almacenamiento seguro de API keys y secretos del usuario
 * sobre el llavero del SO (Keychain/DPAPI/Secret Service). Este barrel
 * cierra C04: el paquete es importable (`@ego/security`) y expone el
 * manager, los backends y los schemas de validación.
 */
export {
  CredentialManager,
  InMemoryCryptoBackend,
  SafeStorageBackend,
  SyncSafeStorageBackend,
  StoredCredentialSchema,
  VaultExportSchema,
  VAULT_FORMAT_VERSION,
} from "./CredentialManager.js";
export type {
  CryptoStorageBackend,
  HardwareProtectionProbe,
  SafeStorageLike,
  StoredCredential,
  VaultExport,
} from "./CredentialManager.js";
export {
  scanText,
  redactText,
  containsSecret,
  assertNoSecrets,
  sanitizeForLog,
  scanEgoPut,
} from "./SecretsFilter.js";
export type {
  SecretFinding,
  ScanOptions,
  TextScanResult,
  EgoPutLike,
  PutScanResult,
} from "./SecretsFilter.js";
