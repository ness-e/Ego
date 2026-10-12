// Contrato IPC (renderer→main). Canales `ipc.*`; el servidor MCP `ego.*` es otro plano.
// Task 10 (M25): se declaran los canales settings tocados por esta task.
// DEUDA: el resto de canales vivos (~35 usados en preload/main) aún no están
// catalogados aquí; completar el contrato en una task dedicada.
export const EgoIpc = [
  "ipc.memory",
  "ipc.llm.stream",
  "ipc.gov.approve",
  "ipc.snapshots",
  "ipc.subegos.list",
  "ipc.subegos.create",
  "ipc.settings.getModelConfig",
  "ipc.settings.saveModelConfig",
] as const;

export type EgoIpcChannel = (typeof EgoIpc)[number];
