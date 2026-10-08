import { contextBridge, ipcRenderer } from "electron";

/**
 * Puente tipado de IPC (Preload seguro).
 * El Renderer opera aislado (contextIsolation=true, sandbox=true) y nunca accede
 * directamente a Node.js ni a VantaDB.
 */
contextBridge.exposeInMainWorld("ego", {
  memory: (payload: { op: string; args: unknown[] }) => ipcRenderer.invoke("ipc.memory", payload),
  llmStream: (req: { prompt: string; sessionId?: string; systemPrompt?: string }) =>
    ipcRenderer.invoke("ipc.llm.stream", req),
  approve: (req: { actionId: string; confirmed: boolean; notes?: string }) =>
    ipcRenderer.invoke("ipc.gov.approve", req),
  snapshots: () => ipcRenderer.invoke("ipc.snapshots"),
  listSubEgos: () => ipcRenderer.invoke("ipc.subegos.list"),
  createSubEgo: (req: { name: string; role: string; instructions: string; tools?: string[] }) =>
    ipcRenderer.invoke("ipc.subegos.create", req),
  onChatDelta: (callback: (chunk: unknown) => void) => {
    const sub = (_event: Electron.IpcRendererEvent, chunk: unknown) => callback(chunk);
    ipcRenderer.on("ipc.chat.delta", sub);
    return () => {
      ipcRenderer.removeListener("ipc.chat.delta", sub);
    };
  },
  onRecallStatus: (callback: (status: unknown) => void) => {
    const sub = (_event: Electron.IpcRendererEvent, status: unknown) => callback(status);
    ipcRenderer.on("ipc.chat.recall_status", sub);
    return () => {
      ipcRenderer.removeListener("ipc.chat.recall_status", sub);
    };
  },
  onChatError: (callback: (err: { turnId?: string; error: string; timestamp?: number }) => void) => {
    const sub = (_event: Electron.IpcRendererEvent, err: any) => callback(err);
    ipcRenderer.on("ipc.chat.error", sub);
    return () => {
      ipcRenderer.removeListener("ipc.chat.error", sub);
    };
  },
});
