import { ReactiveStore } from "./ReactiveStore.js";

// 1. Runtime State (Ejecuciones activas, hilos cognitivos)
export interface RuntimeState extends Record<string, unknown> {
  activeRuns: string[];
  isExecuting: boolean;
  activeSubEgos: string[];
  executionErrors: string[];
  concurrencyLimit: number;
}

// 2. Interaction State (HITL, aprobaciones, preguntas al usuario)
export interface PendingApprovalItem {
  id: string;
  action: string;
  riskLevel: string;
  details: unknown;
  createdAt: number;
}

export interface InteractionState extends Record<string, unknown> {
  pendingApprovals: PendingApprovalItem[];
  pendingQuestionsCount: number;
  activeLeaseId?: string;
}

// 3. Attention State (Superficie, urgencia y foco)
export interface AttentionState extends Record<string, unknown> {
  surfaceState: "hidden" | "compact" | "expanded" | "alert" | "hitl_approval";
  priority: "low" | "medium" | "high" | "urgent";
  activePillId?: string;
  badgeCount: number;
}

// 4. Workspace State (Canvas, artefactos y diagramas)
export interface WorkspaceState extends Record<string, unknown> {
  activeArtifactIds: string[];
  selectedArtifactId?: string;
  layout: "single" | "split" | "grid";
  zoomLevel: number;
}

// 5. Project State (Metadatos del proyecto y estado Git)
export interface ProjectState extends Record<string, unknown> {
  projectId: string;
  projectName: string;
  projectPath: string;
  branch: string;
  dirtyFilesCount: number;
}

// 6. Integration State (Servidores MCP y conectores nativos)
export interface IntegrationState extends Record<string, unknown> {
  mcpServers: Record<string, "connected" | "disconnected" | "error">;
  nativeToolsReady: boolean;
  lastHeartbeat: number;
}

// 7. User Preferences State (Opciones visuales y accesibilidad)
export interface UserPrefsState extends Record<string, unknown> {
  theme: "dark" | "light" | "system";
  reduceMotion: boolean;
  compactMode: boolean;
  soundEnabled: boolean;
  autoApproveReadOperations: boolean;
}

export interface EgoStoresGroup {
  runtime: ReactiveStore<RuntimeState>;
  interaction: ReactiveStore<InteractionState>;
  attention: ReactiveStore<AttentionState>;
  workspace: ReactiveStore<WorkspaceState>;
  project: ReactiveStore<ProjectState>;
  integration: ReactiveStore<IntegrationState>;
  userPrefs: ReactiveStore<UserPrefsState>;
  resetAll: () => void;
}

/**
 * Factoría de los 7 Stores Ortogonales Tipados de Ego (Patrón Coucou COUC-05 / Anti-Singleton).
 * Fragmenta el monolítico AppState en dominios reactivos desacoplados.
 */
export function createEgoStateStores(): EgoStoresGroup {
  const runtime = new ReactiveStore<RuntimeState>({
    activeRuns: [],
    isExecuting: false,
    activeSubEgos: [],
    executionErrors: [],
    concurrencyLimit: 4,
  });

  const interaction = new ReactiveStore<InteractionState>({
    pendingApprovals: [],
    pendingQuestionsCount: 0,
    activeLeaseId: undefined,
  });

  const attention = new ReactiveStore<AttentionState>({
    surfaceState: "hidden",
    priority: "low",
    activePillId: undefined,
    badgeCount: 0,
  });

  const workspace = new ReactiveStore<WorkspaceState>({
    activeArtifactIds: [],
    selectedArtifactId: undefined,
    layout: "single",
    zoomLevel: 1.0,
  });

  const project = new ReactiveStore<ProjectState>({
    projectId: "default_project",
    projectName: "Default Project",
    projectPath: process.cwd ? process.cwd() : ".",
    branch: "main",
    dirtyFilesCount: 0,
  });

  const integration = new ReactiveStore<IntegrationState>({
    mcpServers: {},
    nativeToolsReady: true,
    lastHeartbeat: Date.now(),
  });

  const userPrefs = new ReactiveStore<UserPrefsState>({
    theme: "dark",
    reduceMotion: false,
    compactMode: false,
    soundEnabled: true,
    autoApproveReadOperations: true,
  });

  return {
    runtime,
    interaction,
    attention,
    workspace,
    project,
    integration,
    userPrefs,
    resetAll: () => {
      runtime.reset();
      interaction.reset();
      attention.reset();
      workspace.reset();
      project.reset();
      integration.reset();
      userPrefs.reset();
    },
  };
}
