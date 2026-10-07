import { contextBridge, ipcRenderer } from "electron";

/**
 * Puente tipado de IPC (Preload seguro).
 * El Renderer opera aislado (contextIsolation=true, sandbox=true) y nunca accede
 * directamente a Node.js ni a VantaDB.
 */
contextBridge.exposeInMainWorld("ego", {
  memory: (payload: { op: string; args: unknown[] }) => ipcRenderer.invoke("ipc.memory", payload),
  llmStream: (args: unknown) => ipcRenderer.invoke("ipc.llm.stream", args),
  approve: (req: { actionId: string; confirmed: boolean; notes?: string }) => ipcRenderer.invoke("ipc.gov.approve", req),
  snapshots: () => ipcRenderer.invoke("ipc.snapshots"),
  listSubEgos: () => ipcRenderer.invoke("ipc.subegos.list"),
  createSubEgo: (req: { name: string; role: string; instructions: string; tools?: string[] }) => ipcRenderer.invoke("ipc.subegos.create", req),
});
