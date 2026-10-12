/**
 * Shim de tipos mínimos para `import("electron")` dinámico en `@ego/security`.
 *
 * Solo tipos: `electron` NO es dependencia de este paquete. En runtime el
 * módulo se resuelve vía import dinámico guarded en `CredentialManager.ts`
 * (`loadElectronSafeStorage`); fuera del main process falla suave a `null`.
 */
declare module "electron" {
  export interface ElectronSafeStorage {
    isEncryptionAvailable(): boolean;
    encryptString(plainText: string): Buffer;
    decryptString(encrypted: Buffer): string;
  }
  export const safeStorage: ElectronSafeStorage | undefined;
}
