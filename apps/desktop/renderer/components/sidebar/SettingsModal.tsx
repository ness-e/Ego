import { useState, useEffect, useCallback, useRef } from "react";
import {
  Gear,
  Cpu,
  Microphone,
  HardDrive,
  Sparkle,
  ShieldCheck,
  Check,
  FloppyDisk,
  FileArrowUp,
  FileArrowDown,
} from "@phosphor-icons/react";
import { Modal } from "../ui-kit/Modal.js";
import { Select } from "../ui-kit/Select.js";
import { Button } from "../ui-kit/Button.js";
import { Input } from "../ui-kit/Input.js";
import { Badge } from "../ui-kit/Badge.js";
import { ego, type ModelConfigInfo, type StorageInfoResult, type GovPoliciesResult } from "../../lib/ego.js";

/**
 * El `Button` del kit envuelve los hijos en un `<span>` interno
 * (`inline-flex min-w-0 items-center gap-1.5`).
 *
 * - El icono va por la prop `icon`: se renderiza como hermano ANTERIOR a
 *   ese span, así que el `gap-1.5` del base separa icono y etiqueta sin
 *   acoplar el consumidor al DOM interno del kit (nada de `[&>span]:flex`).
 * - `BTN_LABEL_FULL` queda sólo para lo que de verdad necesita que el
 *   contenido ocupe TODO el ancho: una etiqueta larga con `truncate`
 *   necesita un ancho ACOTADO para que aparezca la elipsis. `inline-flex`
 *   se ajusta al contenido (sin acotar → sin elipsis); `w-full` sí acota.
 *   El selector apunta al span de CONTENIDO (el único sin `aria-hidden`):
 *   con la prop `icon` el botón tiene DOS spans directos —el de icono
 *   (`aria-hidden`) y el de contenido— y un `:last-child` o un `>span`
 *   sin distinguir aplicaría al icono y empotraría la etiqueta fuera del
 *   botón.
 */
const BTN_LABEL_FULL = "[&>span:not([aria-hidden])]:w-full";

export interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsTab = "models" | "general" | "voice" | "memory" | "floating" | "gov";
type KeyedProvider = "openai" | "anthropic" | "google" | "deepseek";

const KEYED_PROVIDERS: readonly KeyedProvider[] = ["openai", "anthropic", "google", "deepseek"];

const PROVIDER_KEY_FIELD: Record<KeyedProvider, "openaiKey" | "anthropicKey" | "googleKey" | "deepseekKey"> = {
  openai: "openaiKey",
  anthropic: "anthropicKey",
  google: "googleKey",
  deepseek: "deepseekKey",
};

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  // activeTab inicia en "models" para que select[aria-label="Proveedor activo"] esté disponible inmediatamente
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

  // Estados de General / Voz / Mascota
  const [themeMode, setThemeMode] = useState("dark");
  const [autoStart, setAutoStart] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(false);
  const [petFloatingVisible, setPetFloatingVisible] = useState(true);

  // T14: estado live de memoria/gobernanza (puentes T13)
  const [storageInfo, setStorageInfo] = useState<StorageInfoResult | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [govPolicies, setGovPolicies] = useState<GovPoliciesResult | null>(null);
  const [govError, setGovError] = useState<string | null>(null);
  const [govLoading, setGovLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!open || activeTab !== "memory") return;
    let cancelled = false;
    setStorageLoading(true);
    setStorageError(null);
    void ego()
      .settings.getStorageInfo()
      .then((res) => {
        if (cancelled) return;
        if (res && typeof res === "object" && (res as { ok?: unknown }).ok) {
          setStorageInfo(res as StorageInfoResult);
        } else {
          const err = (res as { error?: unknown })?.error;
          setStorageInfo(null);
          setStorageError(
            typeof err === "string" && err.length > 0
              ? err
              : "No se pudo leer el almacenamiento del backend."
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStorageInfo(null);
          setStorageError("Canal settings.getStorageInfo no disponible en el bridge.");
        }
      })
      .finally(() => {
        if (!cancelled) setStorageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, activeTab]);

  useEffect(() => {
    if (!open || activeTab !== "gov") return;
    let cancelled = false;
    setGovLoading(true);
    setGovError(null);
    void ego()
      .settings.getGovPolicies()
      .then((res) => {
        if (cancelled) return;
        if (res && typeof res === "object" && (res as { ok?: unknown }).ok) {
          setGovPolicies(res as GovPoliciesResult);
        } else {
          const err = (res as { error?: unknown })?.error;
          setGovPolicies(null);
          setGovError(
            typeof err === "string" && err.length > 0
              ? err
              : "No se pudieron leer las políticas del backend."
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGovPolicies(null);
          setGovError("Canal settings.getGovPolicies no disponible en el bridge.");
        }
      })
      .finally(() => {
        if (!cancelled) setGovLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, activeTab]);

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

  const handleExportBackup = async () => {
    setIsExporting(true);
    setBackupMessage(null);
    try {
      let payload: unknown;
      const knowledge = ego().knowledge;
      const exportFn = knowledge?.exportPackage as unknown as ((arg?: unknown) => Promise<unknown>) | undefined;
      const res = await (exportFn ? exportFn({ projectId: "default" }).catch(() => exportFn("default")) : undefined);
      if (res && typeof res === "object") {
        payload = res;
      } else {
        payload = {
          version: 1,
          exportedAt: new Date().toISOString(),
          projectId: "default",
          modelConfig,
          storageInfo,
        };
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ego-sovereign-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMessage("Snapshot exportado exitosamente.");
    } catch (err) {
      setBackupMessage(`Error al exportar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setBackupMessage(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const knowledge = ego().knowledge;
      if (knowledge && typeof knowledge.importPackage === "function") {
        await knowledge.importPackage(parsed);
        setBackupMessage(`Snapshot importado exitosamente desde "${file.name}".`);
      } else {
        setBackupMessage(`Snapshot leído (${file.name}), pero el bridge de importación no está disponible.`);
      }
    } catch (err) {
      setBackupMessage(`Error al importar snapshot: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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

  const NAV_ITEMS: Array<{ id: SettingsTab; label: string; icon: typeof Gear }> = [
    { id: "general", label: "General y Permisos", icon: Gear },
    { id: "models", label: "Modelos y Proveedores", icon: Cpu },
    { id: "voice", label: "Voz y Audio", icon: Microphone },
    { id: "memory", label: "Memoria VantaDB", icon: HardDrive },
    { id: "floating", label: "Isla Flotante y Mascota", icon: Sparkle },
    { id: "gov", label: "Gobernanza y HITL", icon: ShieldCheck },
  ];

  /**
   * Interruptor (switch) del panel: el `Button` del kit es el objetivo
   * táctil de 44×44 TRANSPARENTE y la "pista" visible (24×44) va dentro,
   * para que el área pulsable cumpla el mínimo sin engordar el control.
   * El knob usa `bg-ink` (claro sobre superficie oscura) y la pista
   * `bg-brand` encendida.
   *
   * D17: la pista apagada usaba `bg-strong`, que es el token de BORDE
   * interactivo (`--color-strong` = #71717a) — un borde pintado como si
   * fuera una superficie. Ahora usa `bg-panel` (como el `Switch` del kit)
   * más un `border-hairline`, que es lo que hace legible una pista
   * apagada sobre la tarjeta `bg-raised`.
   */
  const renderSwitch = (
    checked: boolean,
    onToggle: () => void,
    label: string,
  ) => (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      aria-pressed={checked}
      aria-label={label}
      className="shrink-0 rounded-full hover:bg-transparent"
    >
      <span
        className={`flex h-6 w-11 items-center rounded-full border border-hairline p-0.5 transition-colors ${
          checked ? "bg-brand" : "bg-panel"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-ink shadow-[var(--ego-elevation-l1)] transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </Button>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Configuración de Ego"
      wide
      error={error ?? undefined}
    >
      <div className="flex h-[72vh] min-h-[480px] max-h-[720px] divide-x divide-hairline">
        {/* Barra Lateral Izquierda con Iconos */}
        <div className="w-56 shrink-0 bg-paper p-3 space-y-1">
          <div className="px-2.5 py-1.5 mb-1">
            <span className="font-mono text-xs uppercase tracking-wider text-dim">Preferencias</span>
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <Button
                key={item.id}
                variant="ghost"
                size="md"
                onClick={() => setActiveTab(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={`${BTN_LABEL_FULL} w-full justify-start rounded-[var(--radius-card)] ${
                  isActive
                    ? "bg-raised text-ink font-semibold"
                    : "text-dim hover:bg-raised hover:text-ink"
                }`}
                icon={<Icon size={16} className={isActive ? "text-brand" : "text-dim"} />}
              >
                <span className="truncate">{item.label}</span>
              </Button>
            );
          })}
        </div>

        {/* Panel Derecho de Contenido con Tarjetas */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: MODELOS Y PROVEEDORES (INT-02 / BYOK) */}
          {activeTab === "models" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-ink">Enrutamiento de Modelos y BYOK (INT-02)</h3>
                <p className="mt-1 text-xs text-dim leading-relaxed">
                  Configura tus claves propias (BYOK) por proveedor o un endpoint local de Ollama.
                  El servidor nunca devuelve secretos: los campos con •••• conservan la key real.
                </p>
              </div>

              {/* Tarjeta de Proveedor y Modelo */}
              <div className="rounded-[var(--radius-card)] border border-hairline bg-raised p-4 space-y-4 divide-y divide-hairline">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-ink">Proveedor Activo</label>
                    <p className="text-xs text-dim">Selecciona el motor de inferencia principal</p>
                  </div>
                  <Select
                    ariaLabel="Proveedor activo"
                    value={modelConfig.activeProvider}
                    onValueChange={(val) =>
                      setModelConfig((prev) => ({
                        ...prev,
                        activeProvider: val as ModelConfigInfo["activeProvider"],
                      }))
                    }
                    // D12: etiqueta CORTA. El nombre largo ("OpenAI (GPT-4o /
                    // GPT-4o-mini)") se partía en varias líneas dentro del
                    // trigger de altura fija y empujaba la fila; el detalle
                    // del modelo ya vive en el campo "ID de Modelo
                    // Específico" de abajo.
                    options={[
                      { value: "openai", label: "OpenAI" },
                      { value: "anthropic", label: "Anthropic" },
                      { value: "google", label: "Google" },
                      { value: "deepseek", label: "DeepSeek" },
                      { value: "ollama", label: "Ollama Local" },
                      { value: "mock", label: "Mock Determinista" },
                    ]}
                    className="w-full sm:w-64 min-h-11 min-w-11"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
                  <div>
                    <label className="text-xs font-semibold text-ink">ID de Modelo Específico</label>
                    <p className="text-xs text-dim">Vacío = el router decide por rol (ej: gemini-2.5-pro, claude-3-5-sonnet)</p>
                  </div>
                  <div className="w-full sm:w-64">
                    <Input
                      type="text"
                      aria-label="ID de modelo"
                      placeholder="gemini-2.5-flash / gpt-4o"
                      value={modelConfig.modelName ?? ""}
                      onChange={(e) =>
                        setModelConfig((prev) => ({ ...prev, modelName: e.target.value }))
                      }
                      className="font-mono"
                    />
                  </div>
                </div>

                {/* API Keys */}
                {modelConfig.activeProvider !== "mock" && modelConfig.activeProvider !== "ollama" && providerField && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
                    <div>
                      <label className="text-xs font-semibold text-ink">
                        API Key ({modelConfig.activeProvider.toUpperCase()})
                      </label>
                      <p className="text-xs text-dim">Clave de autenticación para el proveedor activo</p>
                    </div>
                    <div className="w-full sm:w-64">
                      <Input
                        type="password"
                        aria-label={`API Key de ${modelConfig.activeProvider}`}
                        placeholder={`sk-... (Clave de ${modelConfig.activeProvider})`}
                        value={modelConfig[providerField] ?? ""}
                        onChange={(e) =>
                          setModelConfig((prev) => ({ ...prev, [providerField]: e.target.value }))
                        }
                        className="font-mono"
                      />
                    </div>
                  </div>
                )}

                {modelConfig.activeProvider !== "mock" && modelConfig.activeProvider !== "ollama" && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
                    <div>
                      <label className="text-xs font-semibold text-ink">API Key Genérica (Fallback)</label>
                      <p className="text-xs text-dim">Clave alternativa si no se especifica la particular</p>
                    </div>
                    <div className="w-full sm:w-64">
                      <Input
                        type="password"
                        aria-label="API Key genérica"
                        placeholder="sk-... (Fallback)"
                        value={modelConfig.apiKey ?? ""}
                        onChange={(e) => setModelConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                        className="font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Endpoints y URLs */}
                {modelConfig.activeProvider !== "mock" && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
                    <div>
                      <label className="text-xs font-semibold text-ink">Endpoint Base URL (Proxy)</label>
                      <p className="text-xs text-dim">URL personalizada para enrutar llamadas</p>
                    </div>
                    <div className="w-full sm:w-64">
                      <Input
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
                        className="font-mono"
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
                  <div>
                    <label className="text-xs font-semibold text-ink">OpenAI Base URL</label>
                    <p className="text-xs text-dim">URL del endpoint compatible con OpenAI</p>
                  </div>
                  <div className="w-full sm:w-64">
                    <Input
                      type="text"
                      aria-label="OpenAI base URL"
                      placeholder="https://api.openai.com/v1"
                      value={modelConfig.openaiBaseURL ?? ""}
                      onChange={(e) =>
                        setModelConfig((prev) => ({ ...prev, openaiBaseURL: e.target.value }))
                      }
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
                  <div>
                    <label className="text-xs font-semibold text-ink">DeepSeek Base URL</label>
                    <p className="text-xs text-dim">URL del endpoint de DeepSeek</p>
                  </div>
                  <div className="w-full sm:w-64">
                    <Input
                      type="text"
                      aria-label="DeepSeek base URL"
                      placeholder="https://api.deepseek.com"
                      value={modelConfig.deepseekBaseURL ?? ""}
                      onChange={(e) =>
                        setModelConfig((prev) => ({ ...prev, deepseekBaseURL: e.target.value }))
                      }
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
                  <div>
                    <label className="text-xs font-semibold text-ink">Ollama Base URL</label>
                    <p className="text-xs text-dim">Instancia local de Ollama en tu máquina</p>
                  </div>
                  <div className="w-full sm:w-64">
                    <Input
                      type="text"
                      aria-label="Ollama base URL"
                      placeholder="http://localhost:11434/v1"
                      value={modelConfig.ollamaBaseURL ?? ""}
                      onChange={(e) =>
                        setModelConfig((prev) => ({ ...prev, ollamaBaseURL: e.target.value }))
                      }
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Botón Guardar y Notificaciones */}
              <div className="flex items-center justify-between pt-2">
                <span className="font-mono text-xs text-dim">Persistencia en: gov/settings</span>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void handleSave()}
                  loading={saving}
                  className="font-semibold"
                  icon={<FloppyDisk size={15} />}
                >
                  <span>{saving ? "Guardando..." : "Guardar Configuración"}</span>
                </Button>
              </div>

              {success && (
                <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-success/30 bg-success/10 p-3 text-xs text-success">
                  <Check size={16} className="text-success" />
                  <span>{success}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GENERAL Y PERMISOS */}
          {activeTab === "general" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-ink">General y Preferencias del Sistema</h3>
                <p className="mt-1 text-xs text-dim">
                  Configura el comportamiento del arranque, idioma y notificaciones de Ego.
                </p>
              </div>

              <div className="rounded-[var(--radius-card)] border border-hairline bg-raised p-4 divide-y divide-hairline">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="text-xs font-semibold text-ink">Tema y Apariencia</h4>
                    <p className="text-xs text-dim">Modo oscuro adaptativo local de alto contraste</p>
                  </div>
                  <Select
                    ariaLabel="Tema y Apariencia"
                    value={themeMode}
                    onValueChange={(val) => setThemeMode(val)}
                    // D12: etiqueta CORTA. "Dark Sovereign (Predeterminado)"
                    // (31 caracteres) ocupaba 3 líneas en el trigger; el
                    // matiz va en la descripción de la fila.
                    options={[
                      { value: "dark", label: "Dark Sovereign" },
                      { value: "oled", label: "Pure OLED" },
                      { value: "graphite", label: "Graphite CX" },
                    ]}
                    className="w-full sm:w-64 min-h-11 min-w-11"
                  />
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="text-xs font-semibold text-ink">Iniciar al arrancar el sistema</h4>
                    <p className="text-xs text-dim">Ejecutar el servicio de fondo en segundo plano</p>
                  </div>
                  {renderSwitch(
                    autoStart,
                    () => setAutoStart(!autoStart),
                    "Iniciar al arrancar el sistema",
                  )}
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="text-xs font-semibold text-ink">Efectos de sonido de respuesta</h4>
                    <p className="text-xs text-dim">Notificar mediante señales auditivas al terminar tareas</p>
                  </div>
                  {renderSwitch(
                    soundEnabled,
                    () => setSoundEnabled(!soundEnabled),
                    "Efectos de sonido de respuesta",
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VOZ Y AUDIO */}
          {activeTab === "voice" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-ink">Voz y Síntesis de Audio</h3>
                <p className="mt-1 text-xs text-dim">
                  Configuración para reconocimiento de voz en tiempo real y lectura de respuestas (TTS).
                </p>
              </div>

              <div className="rounded-[var(--radius-card)] border border-hairline bg-raised p-4 divide-y divide-hairline">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="text-xs font-semibold text-ink">Dictado por Voz (Whisper Local / API)</h4>
                    <p className="text-xs text-dim">Habilita el botón de micrófono en la barra de chat</p>
                  </div>
                  {renderSwitch(
                    voiceInputEnabled,
                    () => setVoiceInputEnabled(!voiceInputEnabled),
                    "Dictado por voz",
                  )}
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="text-xs font-semibold text-ink">Motor de Text-to-Speech (TTS)</h4>
                    <p className="text-xs text-dim">Voz sintética para respuestas habladas</p>
                  </div>
                  <Select
                    ariaLabel="Motor de Text-to-Speech (TTS)"
                    defaultValue="system"
                    options={[
                      { value: "system", label: "Voz del Sistema" },
                      { value: "piper", label: "Piper Neural" },
                      { value: "openai", label: "OpenAI TTS-1" },
                    ]}
                    className="w-full sm:w-64 min-h-11 min-w-11"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MEMORIA VANTADB */}
          {activeTab === "memory" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-ink">Almacenamiento Local VantaDB</h3>
                <p className="mt-1 text-xs text-dim">
                  Persistencia real mediante binding nativo de Rust (`NativeVantaDB`, Fjall LSM con WAL y fsync).
                </p>
              </div>

              {storageLoading && (
                <p className="font-mono text-xs text-dim animate-pulse">Leyendo almacenamiento del backend…</p>
              )}

              {storageError && (
                <div
                  role="alert"
                  className="rounded-[var(--radius-card)] border border-error/30 bg-error/10 p-3 text-xs text-error"
                >
                  {storageError}
                </div>
              )}

              {storageInfo && !storageLoading && (
                <div className="space-y-3 rounded-[var(--radius-card)] border border-hairline bg-raised p-4 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-hairline/60 pb-2">
                    <span className="text-dim">Ruta en Disco:</span>
                    <span className="truncate max-w-sm rounded-md bg-panel px-2 py-1 text-ink font-mono text-xs">
                      {storageInfo.dbPath ?? storageInfo.userDataDir ?? "No disponible"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-hairline/60 pb-2">
                    <span className="text-dim">Namespaces Activos ({storageInfo.namespaces?.length ?? 0}):</span>
                    <span className="text-success font-semibold">
                      {storageInfo.namespaces && storageInfo.namespaces.length > 0
                        ? storageInfo.namespaces.join(", ")
                        : "Sin namespaces visibles"}
                    </span>
                  </div>

                  {(storageInfo.platform || typeof storageInfo.operational === "boolean") && (
                    <div className="flex items-center justify-between text-dim text-xs">
                      <span>{storageInfo.platform ? `Plataforma: ${storageInfo.platform}` : ""}</span>
                      <span className="text-success">
                        {typeof storageInfo.operational === "boolean"
                          ? `Estado Operativo: ${storageInfo.operational ? "Online (LSM Fjall)" : "Desconectado"}`
                          : ""}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Tarjeta de Respaldo Soberano y Portabilidad */}
              <div className="space-y-3 rounded-[var(--radius-card)] border border-hairline bg-raised p-4">
                <h4 className="text-xs font-semibold text-ink">Respaldo Soberano y Portabilidad (Export / Import)</h4>
                <p className="text-xs leading-relaxed text-dim">
                  Exporta o restaura snapshots completos de memoria y configuración de Ego en formato JSON portable.
                </p>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => void handleExportBackup()}
                    disabled={isExporting}
                    className="font-medium"
                    icon={<FileArrowDown size={14} />}
                  >
                    <span>{isExporting ? "Exportando..." : "Exportar Snapshot JSON"}</span>
                  </Button>

                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="font-medium"
                    icon={<FileArrowUp size={14} />}
                  >
                    <span>{isImporting ? "Importando..." : "Importar Snapshot JSON"}</span>
                  </Button>

                  {/* El `<input type="file">` es un control NATIVO por
                      naturaleza: el `Input` del kit es para campos de texto
                      y envolvolverlo aquí mostraría una caja visible. Se
                      mantiene oculto y sólo actúa como selector de archivo. */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => void handleImportFile(e)}
                  />
                </div>

                {backupMessage && (
                  <p className="font-mono text-xs text-brand pt-1">{backupMessage}</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: ISLA FLOTANTE Y MASCOTA */}
          {activeTab === "floating" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-ink">Isla Flotante Companion</h3>
                <p className="mt-1 text-xs text-dim">
                  Controla la mascota desktop desacoplada y sus animaciones reactivas.
                </p>
              </div>

              <div className="rounded-[var(--radius-card)] border border-hairline bg-raised p-4 divide-y divide-hairline">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="text-xs font-semibold text-ink">Visibilidad de la Isla</h4>
                    <p className="text-xs text-dim">Muestra la ventana transparente sobre otras apps (Alt+Win+P)</p>
                  </div>
                  {renderSwitch(
                    petFloatingVisible,
                    () => {
                      const bridge = (
                        window.ego as unknown as {
                          floating?: { toggleFloating?: () => void };
                        }
                      ).floating;
                      bridge?.toggleFloating?.();
                      setPetFloatingVisible(!petFloatingVisible);
                    },
                    "Visibilidad de la Isla Flotante",
                  )}
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="text-xs font-semibold text-ink">Reacción a eventos del sistema</h4>
                    <p className="text-xs text-dim">La mascota muestra gestos al compilar, pensar o recibir mensajes</p>
                  </div>
                  <Badge tone="ok">Activado</Badge>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: GOBERNANZA Y HITL */}
          {activeTab === "gov" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-ink">Políticas de Aprobación Humana (HITL)</h3>
                <p className="mt-1 text-xs text-dim leading-relaxed">
                  Principio 6: Ninguna acción sensible (escritura en disco, git push, shell exec) se
                  ejecuta sin confirmación explícita del usuario soberano.
                </p>
              </div>

              {govLoading && (
                <p className="font-mono text-xs text-dim animate-pulse">Leyendo políticas del backend…</p>
              )}

              {govError && (
                <div
                  role="alert"
                  className="rounded-[var(--radius-card)] border border-error/30 bg-error/10 p-3 text-xs text-error"
                >
                  {govError}
                </div>
              )}

              {govPolicies && !govLoading && (
                <div className="space-y-2.5 rounded-[var(--radius-card)] border border-hairline bg-raised p-4">
                  {govPolicies.policies.length === 0 ? (
                    <p className="text-xs text-dim italic">
                      Sin políticas registradas en `gov/policies` (vacío honesto).
                    </p>
                  ) : (
                    govPolicies.policies.map((p) => (
                      <div key={p.key} className="flex flex-col gap-0.5 border-b border-hairline/60 pb-2 text-xs">
                        <span className="font-mono font-medium text-ink">{p.key}</span>
                        <span className="truncate font-mono text-xs text-dim">
                          {JSON.stringify(p.payload)?.slice(0, 160) ?? ""}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default SettingsModal;
