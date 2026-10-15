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
  CredentialPool,
  CREDENTIAL_POOL_DEFAULT_COOLDOWN_MS,
  CREDENTIAL_POOL_FINGERPRINT_LENGTH,
  InMemoryCryptoBackend,
  SafeStorageBackend,
  SyncSafeStorageBackend,
  StoredCredentialSchema,
  VaultExportSchema,
  VAULT_FORMAT_VERSION,
} from "./CredentialManager.js";
export type {
  CryptoStorageBackend,
  CredentialPoolOptions,
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
export {
  evaluateToolCall,
  isDenied,
  needsApproval,
  DEFAULT_ALLOWED_MCP_SERVERS,
} from "./ToolPermissions.js";
export type {
  ToolDecision,
  ToolDecisionResult,
  ToolCallRequest,
  ToolPermissionsOptions,
  ToolDefaultMode,
  ToolApprovalsOptions,
  ToolRiskLevelLike,
  ToolOriginLike,
} from "./ToolPermissions.js";
export {
  CryptoErasure,
  ScopeKeyRegistry,
  ErasureVerificationError,
} from "./CryptoErasure.js";export type {
  ErasureStore,
  ErasureStoreRecord,
  ErasurePut,
  DerivedKey,
  SealedEnvelope,
  ErasureStatus,
  ErasureReceipt,
  CryptoErasureOptions,
} from "./CryptoErasure.js";
export {
  isBlockedSSRFIPv4,
  isBlockedSSRFIPv6,
  validateSSRFUrl,
} from "./netPolicy.js";
export type { SSRFCheck } from "./netPolicy.js";
