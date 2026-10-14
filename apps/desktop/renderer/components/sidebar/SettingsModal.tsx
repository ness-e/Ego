import { useState, useEffect, useCallback } from "react";
import { Modal } from "../ui-kit/Modal.js";
import { ego, type ModelConfigInfo } from "../../lib/ego.js";

export interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsTab = "models" | "memory" | "gov";
type KeyedProvider = "openai" | "anthropic" | "google" | "deepseek";

const KEYED_PROVIDERS: readonly KeyedProvider[] = ["openai", "anthropic", "google", "deepseek"];

const PROVIDER_KEY_FIELD: Record<KeyedProvider, "openaiKey" | "anthropicKey" | "googleKey" | "deepseekKey"> = {
  openai: "openaiKey",
  anthropic: "anthropicKey",
  google: "googleKey",
  deepseek: "deepseekKey",
};

/**
 * T08 (UI-05): modal de ajustes sobre Radix (trap+Escape+aria-modal nativos
 * vía ui-kit Modal). BYOK por proveedor: exige key no vacía (propia o
 * genérica) y advierte que el getter devuelve máscaras que se conservan.
 */
export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("models");
  const [modelConfig, setModelConfig] = useState<ModelConfigInfo>({
    activeProvider: "mock",
    apiKey: "",
    openaiKey: "",
    anthropicKey: "",
    googleKey: "",
    deepseekKey: "",
    baseUrl: "",
    openaiBaseURL: "",
    deepseekBaseURL: "",
    ollamaBaseURL: "",
    modelName: "",
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadModelConfig = useCallback(async () => {
    try {
      const cfg = await ego().settings.getModelConfig();
      if (cfg) setModelConfig((prev) => ({ ...prev, ...cfg }));
    } catch (err) {
      console.warn("[SettingsModal] Error al cargar configuración:", err);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setError(null);
      setSuccess(null);
      void loadModelConfig();
    }
  }, [open, loadModelConfig]);

  /** BYOK por proveedor: el proveedor con key exige key no vacía. */
  const validateByok = (cfg: ModelConfigInfo): string | null => {
    const p = cfg.activeProvider;
    if (p === "mock" || p === "ollama") return null;
    const own = cfg[PROVIDER_KEY_FIELD[p as KeyedProvider]] ?? "";
    const generic = cfg.apiKey ?? "";
    if (own.trim().length === 0 && generic.trim().length === 0) {
      return `El proveedor "${p}" exige una key no vacía (propia o genérica). Sin key, el chat se bloquea con error BYOK explícito.`;
    }
    return null;
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess(null);
    setError(null);
    try {
      const blockReason = validateByok(modelConfig);
      if (blockReason) {
        setError(blockReason);
        return;
      }
      // El getter retorna máscaras (nunca el secreto): se reenvían tal cual y
      // el main las detecta y conserva la key real. Los campos por proveedor
      // vacíos se envían como `undefined` (el schema rechaza `""` en keys).
      const emptyToUndefined = (v: string | undefined): string | undefined =>
        v && v.trim().length > 0 ? v : undefined;
      const { activeProvider } = modelConfig;
      await ego().settings.saveModelConfig({
        activeProvider,
        ...(modelConfig.apiKey ? { apiKey: modelConfig.apiKey } : {}),
        ...(emptyToUndefined(modelConfig.openaiKey) ? { openaiKey: modelConfig.openaiKey } : {}),
        ...(emptyToUndefined(modelConfig.anthropicKey) ? { anthropicKey: modelConfig.anthropicKey } : {}),
        ...(emptyToUndefined(modelConfig.googleKey) ? { googleKey: modelConfig.googleKey } : {}),
        ...(emptyToUndefined(modelConfig.deepseekKey) ? { deepseekKey: modelConfig.deepseekKey } : {}),
        ...(modelConfig.baseUrl ? { baseUrl: modelConfig.baseUrl } : {}),
        ...(emptyToUndefined(modelConfig.openaiBaseURL) ? { openaiBaseURL: modelConfig.openaiBaseURL } : {}),
        ...(emptyToUndefined(modelConfig.deepseekBaseURL) ? { deepseekBaseURL: modelConfig.deepseekBaseURL } : {}),
        ...(emptyToUndefined(modelConfig.ollamaBaseURL) ? { ollamaBaseURL: modelConfig.ollamaBaseURL } : {}),
        ...(modelConfig.modelName ? { modelName: modelConfig.modelName } : {}),
      });
      setSuccess("Configuración guardada en VantaDB exitosamente.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const providerField = KEYED_PROVIDERS.includes(modelConfig.activeProvider as KeyedProvider)
    ? PROVIDER_KEY_FIELD[modelConfig.activeProvider as KeyedProvider]
    : null;

  const tabBtn = (id: SettingsTab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setActiveTab(id)}
      className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs transition-colors ${
        activeTab === id ? "bg-raised text-ink font-medium" : "text-faint hover:bg-raised/50"
      }`}
    >
      <span>{label}</span>
    </button>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Configuración de Ego"
      wide
      error={error ?? undefined}
    >
      <div className="flex min-h-[320px]">
        <div className="w-40 shrink-0 space-y-1 border-r border-hairline pr-2">
          {tabBtn("models", "Model Router")}
          {tabBtn("memory", "VantaDB Motor")}
          {tabBtn("gov", "Gobernanza HITL")}
        </div>
        <div className="min-w-0 flex-1 space-y-3 pl-4">
          {activeTab === "models" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">Enrutamiento de Modelos y BYOK (INT-02)</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-faint">
                  Configura tus claves propias (BYOK) por proveedor o un endpoint local de Ollama.
                  El servidor nunca devuelve secretos: los campos con •••• conservan la key real.
                </p>
              </div>
              <div className="space-y-3 rounded border border-hairline bg-paper p-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-dim">
                    Proveedor Activo
                  </label>
                  <select
                    aria-label="Proveedor activo"
                    value={modelConfig.activeProvider}
                    onChange={(e) =>
                      setModelConfig((prev) => ({
                        ...prev,
                        activeProvider: e.target.value as ModelConfigInfo["activeProvider"],
                      }))
                    }
                    className="w-full rounded border border-hairline bg-raised px-2.5 py-1.5 text-xs text-ink focus:border-ink/50 focus:outline-none"
                  >
                    <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="google">Google (Gemini)</option>
                    <option value="deepseek">DeepSeek (DeepSeek-Chat / Coder)</option>
                    <option value="ollama">Ollama Local (Offline)</option>
                    <option value="mock">Mock Determinista (Pruebas sin coste)</option>
                  </select>
                </div>
                {modelConfig.activeProvider !== "mock" && modelConfig.activeProvider !== "ollama" && providerField && (
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-dim">
                      API Key ({modelConfig.activeProvider.toUpperCase()})
                    </label>
                    <input
                      type="password"
                      aria-label={`API Key de ${modelConfig.activeProvider}`}
                      placeholder={`sk-... (Clave de ${modelConfig.activeProvider})`}
                      value={modelConfig[providerField] ?? ""}
                      onChange={(e) =>
                        setModelConfig((prev) => ({ ...prev, [providerField]: e.target.value }))
                      }
                      className="w-full rounded border border-hairline bg-raised px-2.5 py-1.5 font-mono text-xs text-ink placeholder:text-dim focus:border-ink/50 focus:outline-none"
                    />
                  </div>
                )}
                {modelConfig.activeProvider !== "mock" && modelConfig.activeProvider !== "ollama" && (
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-dim">
                      API Key genérica (fallback)
                    </label>
                    <input
                      type="password"
                      aria-label="API Key genérica"
                      placeholder="sk-... (aplica a cualquier proveedor)"
                      value={modelConfig.apiKey ?? ""}
                      onChange={(e) => setModelConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                      className="w-full rounded border border-hairline bg-raised px-2.5 py-1.5 font-mono text-xs text-ink placeholder:text-dim focus:border-ink/50 focus:outline-none"
                    />
                  </div>
                )}
                {modelConfig.activeProvider !== "mock" && (
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-dim">
                      Endpoint Base URL (Opcional / Proxy)
                    </label>
                    <input
                      type="text"
                      aria-label="Endpoint base URL"
                      placeholder={
                        modelConfig.activeProvider === "ollama"
                          ? "http://localhost:11434/v1"
                          : modelConfig.activeProvider === "deepseek"
                            ? "https://api.deepseek.com"
                            : "https://api.openai.com/v1"
                      }
                      value={modelConfig.baseUrl ?? ""}
                      onChange={(e) => setModelConfig((prev) => ({ ...prev, baseUrl: e.target.value }))}
                      className="w-full rounded border border-hairline bg-raised px-2.5 py-1.5 font-mono text-xs text-ink placeholder:text-dim focus:border-ink/50 focus:outline-none"
                    />
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="font-mono text-[10px] text-dim">Persistencia en: gov/settings</span>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="rounded bg-ink px-3 py-1 text-xs font-semibold text-paper hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : "Guardar Configuración"}
                  </button>
                </div>
                {success && (
                  <div className="rounded border border-emerald-500/30 bg-emerald-950/40 p-2 text-[11px] text-emerald-300">
                    ✓ {success}
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === "memory" && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">Almacenamiento Local VantaDB</h3>
              <p className="leading-relaxed text-faint">
                Persistencia real mediante binding nativo de Rust (`NativeVantaDB`, Fjall LSM con WAL y fsync).
              </p>
              <div className="space-y-1.5 rounded border border-hairline bg-paper p-3 font-mono text-[11px]">
                <div className="text-dim">Ruta en Disco:</div>
                <div className="truncate rounded bg-raised p-1.5 text-ink">%APPDATA%\Ego\ego_memory.vdb</div>
                <div className="pt-2 text-dim">Namespaces Activos:</div>
                <div className="text-emerald-400">gov/audit, gov/sub_egos, session/turns, kb/docs</div>
              </div>
            </div>
          )}
          {activeTab === "gov" && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">Políticas de Aprobación Humana (HITL)</h3>
              <p className="leading-relaxed text-faint">
                Principio 6: Ninguna acción sensible (escritura en disco, git push, shell exec) se
                ejecuta sin confirmación explícita.
              </p>
              <div className="space-y-2 rounded border border-hairline bg-paper p-3">
                <div className="flex items-center justify-between text-xs">
                  <span>Aprobación de Comandos de Shell</span>
                  <span className="font-medium text-emerald-400">Requerida</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Límite de Tokens por Llamada</span>
                  <span className="font-mono text-dim">4,000 tokens</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
