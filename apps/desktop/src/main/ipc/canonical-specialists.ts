/**
 * T3 (Ola 5) — Catálogo de especialistas canónicos y su siembra.
 *
 * Extraído de `register-ipc.ts`: es DATO (el catálogo y la siembra), no un
 * handler. Su peso no debe decidir el tamaño del fichero de IPC, y su
 * dominio (Sub-Egos) no es el de ningún canal.
 */
import { EgoMemoryAdapter } from "@ego/memory";
import {
  SubEgoRegistry,
  createSubEgoId as createCanonicalSubEgoId,
  parseSubEgoManifest,
  type SubEgoManifest,
} from "@ego/subegos";

/**
 * Especificación de un especialista canónico sembrado por el main process.
 *
 * `id` es el ID de **plantilla** (`@ego/subegos` → `DOMAIN_TEMPLATES`), NO el
 * identificador del manifiesto. El esquema canónico (DSEK-03) exige IDs opacos
 * (`ego.*` / `sub_*`), y el ID de plantilla es desnudo ("researcher"): por eso
 * se convierte con `createSubEgoId` al construir el manifiesto.
 *
 * Mantener separados ambos conceptos es lo que permite que el nombre visible
 * cambie ("Arquitecto & Revisor" → "Arquitecto de Sistemas") sin romper la
 * identidad persistida del Sub-Ego: el ID de plantilla es el ancla estable
 * (lo consumen `TraitRegistry`, `DomainRegistry` y `SelfImprovementLoop`).
 */
export interface CanonicalSpecialistSpec {
  /** ID de plantilla canónico (estable; no cambia aunque se renombre el especialista). */
  readonly id: string;
  readonly name: string;
  /** Dominio funcional de referencia (viaja como `metadata.domain` del manifiesto). */
  readonly domain: string;
  readonly role: string;
  readonly description: string;
  readonly capabilities: readonly string[];
  /** Estado operativo heredado de la UI (informativo; el manifiesto usa `state`). */
  readonly status: string;
  readonly state: "active" | "paused" | "archived";
  readonly systemPrompt: string;
  readonly responsibilities: readonly string[];
  readonly tools: readonly string[];
  readonly permissions: readonly string[];
}

export const CANONICAL_SPECIALIST_SUBEGOS: readonly CanonicalSpecialistSpec[] = [
  {
    id: "researcher",
    name: "Investigador Cognitivo",
    domain: "knowledge",
    role: "Investigación profunda, síntesis documental y GraphRAG en VantaDB",
    description: "Investigación profunda, síntesis documental y GraphRAG en VantaDB",
    capabilities: ["memory_search", "web_search", "knowledge_ingest"],
    status: "idle",
    state: "active" as const,
    systemPrompt: "Eres el Investigador Cognitivo de Ego. Especialista en GraphRAG, síntesis documental y exploración de conocimiento.",
    responsibilities: ["Investigación profunda", "Síntesis documental", "Búsqueda GraphRAG"],
    tools: ["memory_search", "web_search", "knowledge_ingest"],
    permissions: ["memory:read", "web:search"],
  },
  {
    id: "code_reviewer",
    name: "Arquitecto & Revisor",
    domain: "engineering",
    role: "Ingeniería de sistemas, revisión de diffs, tests y seguridad",
    description: "Ingeniería de sistemas, revisión de diffs, tests y seguridad",
    capabilities: ["fs_read_file", "fs_write_file", "git_status", "git_diff", "terminal_exec"],
    status: "idle",
    state: "active" as const,
    systemPrompt: "Eres el Arquitecto & Revisor de Ego. Especialista en ingeniería de software, arquitectura de sistemas, diffs y seguridad.",
    responsibilities: ["Revisión de diffs", "Ejecución de tests", "Auditoría de arquitectura"],
    tools: ["fs_read_file", "fs_write_file", "git_status", "git_diff", "terminal_exec"],
    permissions: ["fs:read", "fs:write", "terminal:exec"],
  },
  {
    id: "copywriter",
    name: "Estratega de Producto",
    domain: "product",
    role: "PRDs, historias de usuario, roadmaps y comunicación ejecutiva",
    description: "PRDs, historias de usuario, roadmaps y comunicación ejecutiva",
    capabilities: ["canvas_render", "memory_search"],
    status: "idle",
    state: "active" as const,
    systemPrompt: "Eres el Estratega de Producto de Ego. Diseñas PRDs, historias de usuario, roadmaps y artefactos Canvas.",
    responsibilities: ["Definición de PRDs", "Roadmaps", "Canvas UI"],
    tools: ["canvas_render", "memory_search"],
    permissions: ["canvas:write", "memory:read"],
  },
  {
    id: "analyst",
    name: "Analista de Telemetría",
    domain: "analytics",
    role: "Métricas de inferencia, costos, latencias P99 y proyecciones en Canvas",
    description: "Métricas de inferencia, costos, latencias P99 y proyecciones en Canvas",
    capabilities: ["canvas_render", "memory_search"],
    status: "idle",
    state: "active" as const,
    systemPrompt: "Eres el Analista de Telemetría de Ego. Monitoreas latencias P99, tokens, consumo de APIs y proyecciones.",
    responsibilities: ["Monitoreo de telemetría", "Métricas P99", "Análisis de costos"],
    tools: ["canvas_render", "memory_search"],
    permissions: ["canvas:write", "memory:read"],
  },
  {
    id: "planner",
    name: "Orquestador de Tareas",
    domain: "planning",
    role: "Descomposición de objetivos complejos, cron jobs y delegación multi-agente",
    description: "Descomposición de objetivos complejos, cron jobs y delegación multi-agente",
    capabilities: ["delegate_task", "canvas_render"],
    status: "idle",
    state: "active" as const,
    systemPrompt: "Eres el Orquestador de Tareas de Ego. Descompones objetivos complejos, planificas tareas y orquestas sub-egos.",
    responsibilities: ["Descomposición de metas", "Planificación de tareas", "Delegación"],
    tools: ["delegate_task", "canvas_render"],
    permissions: ["tasks:manage", "canvas:write"],
  },
];

/**
 * Construye el manifiesto canónico (validado por Zod, regla DSEK-03) de un
 * especialista canónico.
 *
 * ## Por qué NO `SubEgoFactory.fromTemplate`
 * La fábrica deriva el ID del **nombre visible** (`createSubEgoId(name)`), y el
 * nombre visible es un dato de producto editable. Si el ID dependiera del
 * nombre, un simple renombrado generaría un Sub-Ego nuevo y dejaría huérfano
 * al anterior en `gov/sub_egos` (además de re-sembrar su namespace privado).
 * Aquí el ID se deriva del ID de **plantilla**, que es estable por contrato.
 *
 * ## Por qué las namespaces se anclan al ID del manifiesto
 * `SubEgoMemoryGuard` calcula el estado privado como `egos/<callerId>`: si el
 * manifiesto declarase `egos/<otro-id>/*` el Sub-Ego no podría leer ni
 * escribir en su propio namespace. Por eso lectura y escritura apuntan a
 * `egos/<manifestId>/*`, y el perfil en memoria usa el mismo prefijo.
 */
export function buildCanonicalSubEgoManifest(spec: CanonicalSpecialistSpec): SubEgoManifest {
  const manifestId = createCanonicalSubEgoId(spec.id);
  return parseSubEgoManifest({
    id: manifestId,
    name: spec.name,
    role: spec.role,
    description: spec.description,
    systemPrompt: spec.systemPrompt,
    responsibilities: [...spec.responsibilities],
    capabilities: [...spec.capabilities],
    tools: [...spec.tools],
    permissions: [...spec.permissions],
    creator: "ego-nucleus",
    createdAtMs: Date.now(),
    namespaces: {
      read: ["kb/docs", `egos/${manifestId}/*`],
      write: [`egos/${manifestId}/*`, "quarantine/pending"],
    },
    budget: {
      maxTokensPerCall: 4000,
      maxDailyCostUsd: 2.0,
      requiresApprovalAboveUsd: 0.5,
    },
    trigger: "manual",
    state: spec.state,
    metadata: {
      domain: spec.domain,
      templateId: spec.id,
      seeded: true,
    },
  });
}

/**
 * Construye los manifiestos canónicos de forma tolerante: si uno no se puede
 * construir se omite (con log) en lugar de tumbar el listado completo.
 */
export function buildCanonicalSpecialistManifests(): SubEgoManifest[] {
  const manifests: SubEgoManifest[] = [];
  for (const spec of CANONICAL_SPECIALIST_SUBEGOS) {
    try {
      manifests.push(buildCanonicalSubEgoManifest(spec));
    } catch (err) {
      console.warn(`[Ego Main] Manifiesto canónico inválido para '${spec.id}':`, err);
    }
  }
  return manifests;
}

/**
 * Sembrado en vuelo (holder `const`, patrón E6): serializa las llamadas
 * concurrentes a la siembra. Es un `const` y no un `let` porque el estado
 * mutable del proceso vive únicamente en `state/app-context.ts` (guard E6:
 * `test/e6-runtime-state.test.ts`); el resto de módulos usa holders `const`.
 */
const canonicalSeedState: { inFlight: Promise<void> | null } = { inFlight: null };

/**
 * Siembra los especialistas canónicos (idempotente y fail-soft).
 *
 * - **Idempotente**: solo escribe lo que NO existe. El manifiesto se registra
 *   solo si el catálogo no lo tiene, y el perfil solo si no está en memoria
 *   (ni en vivo ni en cuarentena).
 * - **Fail-soft**: un especialista inválido o un fallo de persistencia se
 *   registra en el log y NO aborta ni el resto del sembrado ni el arranque.
 *   Antes el `register` se tragaba el error en silencio (`.catch(() => {})`),
 *   lo que hacía imposible distinguir "sembrado" de "fallido" en el log.
 * - **Concurrente**: el renderer invoca `ipc.subegos.list` varias veces al
 *   arrancar; sin un cerrojo dos llamadas simultáneas verían el catálogo
 *   vacío y sembrarían dos veces (doble escritura del perfil en cuarentena
 *   y avisos duplicados). Se comparte la promesa en vuelo.
 */
export async function seedCanonicalSubEgos(
  adapterInstance: EgoMemoryAdapter,
  registryInstance?: SubEgoRegistry
): Promise<void> {
  if (!canonicalSeedState.inFlight) {
    canonicalSeedState.inFlight = seedCanonicalSubEgosOnce(adapterInstance, registryInstance)
      .catch((err) => {
        console.warn("[Ego Main] Error en la siembra de sub-egos canónicos:", err);
      })
      .finally(() => {
        canonicalSeedState.inFlight = null;
      });
  }
  return canonicalSeedState.inFlight;
}

async function seedCanonicalSubEgosOnce(
  adapterInstance: EgoMemoryAdapter,
  registryInstance?: SubEgoRegistry
): Promise<void> {
  for (const spec of CANONICAL_SPECIALIST_SUBEGOS) {
    try {
      const manifest = buildCanonicalSubEgoManifest(spec);
      const manifestId = manifest.id;
      const profileNamespace = `egos/${manifestId}/profile`;

      // 1. Perfil del especialista en su namespace privado.
      //    `egos/*` es namespace SENSIBLE (SEC-09): sin cifrado at-rest
      //    (VantaDB FIND-249 pendiente) la escritura se enruta a
      //    `quarantine/pending`. Por eso la comprobación de existencia es
      //    quarantine-aware: con un `get` live-only el perfil nunca se vería
      //    y se reescribiría en cada arranque (sembrado no idempotente).
      const existingProfile = await adapterInstance
        .getWithQuarantine(profileNamespace, "profile")
        .catch(() => null);
      if (!existingProfile) {
        await adapterInstance
          .put({
            namespace: profileNamespace,
            key: "profile",
            payload: { ...spec, id: manifestId, templateId: spec.id },
            metadata: {
              seeded: true,
              id: manifestId,
              templateId: spec.id,
              domain: spec.domain,
            },
          })
          .catch((err) =>
            console.warn(`[Ego Main] Error sembrando perfil ego ${manifestId}:`, err)
          );
      }

      // 2. Manifiesto en el catálogo persistente `gov/sub_egos`.
      if (registryInstance) {
        // Solo se siembra si NO existe: los manifiestos canónicos son
        // entidades de sistema (`creator: "ego-nucleus"` → inmutables), así que
        // re-registrarlos lanzaría `SubEgoSystemImmutableError`.
        const existingManifest = await registryInstance.get(manifestId).catch(() => null);
        if (!existingManifest) {
          // `SubEgoRegistry.register` ya persiste el manifiesto en
          // `gov/sub_egos` (mismo namespace que `adapter.registerSubEgo`) con
          // metadatos más ricos (dominio, tags, tools). La llamada espejo al
          // adaptador solo degradaba esos metadatos y, si `register` fallaba
          // por la protección de sistema, podía escribir el manifiesto
          // saltándose ese control: por eso NO se replica aquí.
          await registryInstance
            .register(manifest)
            .catch((err) =>
              console.warn(`[Ego Main] Error registrando subego ${manifestId}:`, err)
            );
        }
      }
    } catch (err) {
      console.warn(`[Ego Main] Error sembrando subego ${spec.id}:`, err);
    }
  }
}
