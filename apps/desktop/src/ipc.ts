// Contrato IPC (renderer→main). Canales `ipc.*`; el servidor MCP `ego.*` es otro plano.
export const EgoIpc = [
  "ipc.memory",
  "ipc.llm.stream",
  "ipc.gov.approve",
  "ipc.snapshots",
  "ipc.subegos.list",
  "ipc.subegos.create",
] as const;

export type EgoIpcChannel = (typeof EgoIpc)[number];
