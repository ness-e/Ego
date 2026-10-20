import { vi } from "vitest";
import type { EgoMemoryAdapter } from "@ego/memory";

/**
 * Mock tipado del adaptador de memoria para los tests de `@ego/knowledge`.
 *
 * Sustituye al `any` anterior (A2-22): cada método es un `Mock` de vitest y
 * el contrato queda explícito, de modo que una deriva de firma del
 * adaptador se detecta al compilar y no sólo en runtime.
 *
 * El mock es **parcial** a propósito (cada test define sólo lo que usa);
 * por eso el cast a `EgoMemoryAdapter` es explícito y centralizado en
 * {@link asEgoAdapter}.
 */
export interface KnowledgeAdapterMock {
  searchMulti: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  putMulti: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  flush: ReturnType<typeof vi.fn>;
  graphRagSearch: ReturnType<typeof vi.fn>;
}

/**
 * Convierte el mock parcial en el adaptador que espera el código de
 * producción. Cast explícito y único: los tests declaran qué superficie
 * del gateway exercised, sin caer en `any`.
 */
export function asEgoAdapter(mock: KnowledgeAdapterMock): EgoMemoryAdapter {
  return mock as unknown as EgoMemoryAdapter;
}
