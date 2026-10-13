// Declaración global del puente preload (F5T11/M26).
// El preload expone `window.ego` vía `contextBridge` (`src/preload.ts`); el
// renderer lo consume con la vista tipada `EgoBridge` (`lib/ego.ts`), cuyas
// formas de respuesta espejan los retornos reales de `main.ts`. La paridad de
// nombres de canal la garantiza el contrato (`src/ipc.ts` + el guard
// `test/ipc-contract.test.ts`); los payloads se validan con Zod en main.
// Cero `any`: el acceso es `window.ego` directo.
import type { EgoBridge } from "../lib/ego";

declare global {
  interface Window {
    ego: EgoBridge;
  }
}

export {};
