// Declaración global del puente preload (F5T11/M26 + T01).
// El preload expone `window.ego` vía `contextBridge` (`src/preload.ts`); el
// renderer lo consume con la vista tipada `EgoBridge` (`lib/ego.ts`), cuyas
// formas de respuesta espejan los retornos reales de `main.ts`. La paridad de
// nombres de canal la garantiza el contrato (`src/ipc.ts` + el guard
// `test/ipc-contract.test.ts`); los payloads se validan con Zod en main.
// T01 (window.ego único): este módulo NO redefine los tipos del puente —
// re-exporta la fuente canónica de `src/preload.ts`. `EgoBridge` es la vista
// rica del renderer sobre ese mismo puente (mismas firmas de request).
// Cero `any`: el acceso es `window.ego` directo.
import type { EgoBridge } from "../lib/ego";

// Re-export canónico (type-only, borrado en compilación): si `src/preload.ts`
// y `lib/ego.ts` divergen, el import falla y el typecheck lo revela.
export type {
  EgoPreloadBridge,
  LlmStreamBridgeRequest,
  MemoryBridgeRequest,
} from "../../src/preload";

declare global {
  interface Window {
    ego: EgoBridge;
  }
}

export {};
