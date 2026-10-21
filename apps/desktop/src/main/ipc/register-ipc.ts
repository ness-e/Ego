/**
 * T11 (EGO-FIND-54) — Registro de los handlers IPC del main process.
 *
 * T3 (Ola 5): este fichero ya no es el god-file de IPC. Es la RAÍZ DE
 * COMPOSICIÓN: cada dominio de canal tiene su módulo en `./domains/`.
 *
 * El criterio (un módulo por dominio de canal) y su gate están en
 * `apps/desktop/test/ipc-modules-gate.test.ts`: ningún fichero de IPC
 * supera el umbral, cada canal se registra en exactamente un módulo y los
 * 81 canales siguen siendo los mismos.
 *
 * El bloque se registra DESPUÉS de inicializar los subsistemas, así que las
 * dependencias (memoria, routers, engines) se inyectan ya construidas
 * mediante `createIpcDeps()` (main). El estado que muta durante la vida
 * de la app vive en `ipc-state.ts` con live bindings, para que main y los
 * handlers compartan la MISMA fuente de verdad.
 */
import type { createIpcDeps } from "../../main.js";

import { registerApprovalIpc } from "./domains/approval.js";
import { registerDailyIpc } from "./domains/daily.js";
import { registerDecisionIpc } from "./domains/decision.js";
import { registerDomainsIpc } from "./domains/domains.js";
import { registerFloatingIpc } from "./domains/floating.js";
import { registerGovIpc } from "./domains/gov.js";
import { registerHooksIpc } from "./domains/hooks.js";
import { registerKnowledgeIpc } from "./domains/knowledge.js";
import { registerLlmIpc } from "./domains/llm.js";
import { registerMcpIpc } from "./domains/mcp.js";
import { registerMemoryIpc } from "./domains/memory.js";
import { registerModelsIpc } from "./domains/models.js";
import { registerNetIpc } from "./domains/net.js";
import { registerProjectsIpc } from "./domains/projects.js";
import { registerSessionsIpc } from "./domains/sessions.js";
import { registerSettingsIpc } from "./domains/settings.js";
import { registerSkillsIpc } from "./domains/skills.js";
import { registerSnapshotsIpc } from "./domains/snapshots.js";
import { registerSubegosIpc } from "./domains/subegos.js";
import { registerTasksIpc } from "./domains/tasks.js";
import { registerTerminalIpc } from "./domains/terminal.js";
import { registerVoiceIpc } from "./domains/voice.js";

/** Dependencias de los handlers (referencias estables, ya inicializadas). */
export type IpcDeps = ReturnType<typeof createIpcDeps>;

/**
 * Registra los 81 handlers IPC, delegando cada dominio en su módulo.
 *
 * @param deps Dependencias ya inicializadas del main process.
 */
export function registerIpcHandlers(deps: IpcDeps): void {
  registerApprovalIpc(deps);
  registerDailyIpc(deps);
  registerDecisionIpc(deps);
  registerDomainsIpc(deps);
  registerFloatingIpc(deps);
  registerGovIpc(deps);
  registerHooksIpc(deps);
  registerKnowledgeIpc(deps);
  registerLlmIpc(deps);
  registerMcpIpc(deps);
  registerMemoryIpc(deps);
  registerModelsIpc(deps);
  registerNetIpc(deps);
  registerProjectsIpc(deps);
  registerSessionsIpc(deps);
  registerSettingsIpc(deps);
  registerSkillsIpc(deps);
  registerSnapshotsIpc(deps);
  registerSubegosIpc(deps);
  registerTasksIpc(deps);
  registerTerminalIpc(deps);
  registerVoiceIpc(deps);
}

// Re-exports de compatibilidad: el catálogo de especialistas y su siembra
// vivían aquí antes de la división por dominio.
export {
  CANONICAL_SPECIALIST_SUBEGOS,
  buildCanonicalSpecialistManifests,
  buildCanonicalSubEgoManifest,
  seedCanonicalSubEgos,
  type CanonicalSpecialistSpec,
} from "./canonical-specialists.js";
