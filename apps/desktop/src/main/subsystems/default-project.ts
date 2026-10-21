/**
 * E6-res (Ola 3) — El proyecto por defecto de Ego (`gov/projects/default`).
 *
 * Extracción **verbatim** del god-file `main.ts`. No tiene estado propio:
 * recibe el adapter como parámetro (el mismo patrón que antes).
 */
import { EgoMemoryAdapter } from "@ego/memory";
import { ProjectManifestSchema, type ProjectManifest } from "../../ipc/schema.js";

export async function getOrCreateDefaultProject(adapterInstance: EgoMemoryAdapter): Promise<ProjectManifest> {
  const existing = await adapterInstance.get("gov/projects", "default");
  if (existing) {
    let payload: unknown = existing;
    if (typeof existing === "object" && existing !== null && "payload" in existing) {
      payload = (existing as { payload: unknown }).payload;
    }
    try {
      return ProjectManifestSchema.parse(payload);
    } catch {
      // noop
    }
  }

  const defaultProject: ProjectManifest = {
    id: "default",
    name: "Ego Core",
    rootPath: process.env.EGO_WORKSPACE_PATH || process.cwd(),
    description: "Proyecto central y entorno de trabajo principal de Ego",
    activeSubEgoId: "ego.nucleus",
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  };

  await adapterInstance.put({
    namespace: "gov/projects",
    key: "default",
    payload: defaultProject,
    metadata: { name: defaultProject.name, rootPath: defaultProject.rootPath }
  });
  await adapterInstance.put({
    namespace: "projects/default",
    key: "manifest",
    payload: defaultProject,
    metadata: { name: defaultProject.name, rootPath: defaultProject.rootPath }
  });

  return defaultProject;
}
