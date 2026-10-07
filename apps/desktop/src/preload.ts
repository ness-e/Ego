import { contextBridge, ipcRenderer } from "electron";

// Renderer nunca toca VantaDB/FS directo: todo pasa por canales `ipc.*`.
contextBridge.exposeInMainWorld("ego", {
  memory: (op: string, args: unknown[]) => ipcRenderer.invoke("ipc.memory", { op, args }),
  llmStream: (args: unknown) => ipcRenderer.invoke("ipc.llm.stream", args),
  approve: (args: unknown) => ipcRenderer.invoke("ipc.gov.approve", args),
  snapshots: () => ipcRenderer.invoke("ipc.snapshots"),
  listSubEgos: () => ipcRenderer.invoke("ipc.subegos.list"),
  createSubEgo: (req: unknown) => ipcRenderer.invoke("ipc.subegos.create", req),
});
