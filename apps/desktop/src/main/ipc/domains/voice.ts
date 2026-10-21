/**
 * T3 (Ola 5) — Canal IPC `ipc.voice.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import {
  VoiceSttSchema,
  VoiceTtsSchema,
  VoiceSettingsSchema,
  type VoiceSettings,
} from "../../../ipc/schema.js";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.voice.*`. */
export function registerVoiceIpc(deps: IpcDeps): void {
  const {
    adapter,
  } = deps;

  async function getVoiceSettingsStore(): Promise<VoiceSettings> {
    try {
      const record = await adapter.get("gov/settings", "voice");
      const payload = record?.payload as { config?: unknown } | null;
      const parsed = VoiceSettingsSchema.safeParse(
        payload && typeof payload === "object" && "config" in payload ? payload.config : (payload ?? {})
      );
      if (parsed.success) return parsed.data;
    } catch {
      // noop: best-effort, caen los defaults seguros (voz local, sin kill)
    }
    return VoiceSettingsSchema.parse({});
  }

  ipcMain.handle("ipc.voice.getStatus", async () => {
    const settings = await getVoiceSettingsStore();
    return { ok: true, ...settings };
  });

  ipcMain.handle("ipc.voice.setConfig", async (_e, rawReq: unknown) => {
    const parseResult = VoiceSettingsSchema.partial().safeParse(rawReq ?? {});
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const current = await getVoiceSettingsStore();
    const merged = VoiceSettingsSchema.parse({ ...current, ...parseResult.data });
    await adapter.put({
      namespace: "gov/settings",
      key: "voice",
      payload: { config: merged },
      metadata: { updatedAtMs: Date.now() },
    });
    return { ok: true, ...merged };
  });

  ipcMain.handle("ipc.voice.stt", async (_e, rawReq: unknown) => {
    const settings = await getVoiceSettingsStore();
    if (settings.disableVoice) {
      return { ok: false, denied: true, error: "Voz deshabilitada por kill switch." };
    }
    const parseResult = VoiceSttSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    if (settings.sttProvider !== "groq") {
      return {
        ok: false,
        error: "STT nube no configurado: el dictado local WebSpeech no usa este canal.",
      };
    }
    const groqKey = (process.env["GROQ_API_KEY"] ?? "").trim();
    if (!groqKey) {
      return {
        ok: false,
        error: "STT groq sin key: configurá GROQ_API_KEY en el entorno del main (la key nunca viaja al renderer).",
      };
    }
    try {
      const audioBytes = Buffer.from(parseResult.data.audioB64, "base64");
      const form = new FormData();
      form.append("model", "whisper-large-v3-turbo");
      form.append("file", new Blob([audioBytes], { type: `audio/${parseResult.data.format}` }), `dictado.${parseResult.data.format}`);
      if (parseResult.data.language) form.append("language", parseResult.data.language);
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 30_000);
      try {
        const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${groqKey}` },
          body: form,
          signal: ctrl.signal,
        });
        if (!res.ok) {
          return { ok: false, error: `STT groq rechazado (HTTP ${res.status}).` };
        }
        const body = (await res.json()) as { text?: unknown };
        if (typeof body.text !== "string" || body.text.trim().length === 0) {
          return { ok: false, error: "STT groq sin texto." };
        }
        return { ok: true, text: body.text.trim() };
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("ipc.voice.tts", async (_e, rawReq: unknown) => {
    const settings = await getVoiceSettingsStore();
    if (settings.disableVoice) {
      return { ok: false, denied: true, error: "Voz deshabilitada por kill switch." };
    }
    const parseResult = VoiceTtsSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    try {
      await adapter.recordAudit(
        "voice",
        "tts",
        { chars: parseResult.data.text.length, provider: settings.ttsProvider },
        "user"
      );
    } catch {
      // noop: auditoría best-effort, la validación ya pasó
    }
    if (settings.ttsProvider !== "speechSynthesis") {
      return {
        ok: false,
        error: "TTS edge pendiente de cableado de red: usá speechSynthesis local (default).",
      };
    }
    // La síntesis local la hace el renderer (`speechSynthesis`, por gesto);
    // el main solo valida, audita y autoriza.
    return { ok: true, mode: "local" as const };
  });
}
