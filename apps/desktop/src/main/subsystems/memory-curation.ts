/**
 * Curaduría programada de memoria (CFG-08) - `@ego/tasks`.
 *
 * Precedente: `apps/desktop/src/main/subsystems/memory-cleanup.ts` (STAB-05).
 *
 * `MemoryCurator` marca como `superseded` (soft-replace, **nunca** borra) los
 * registros stale de `kb/facts` y `kb/docs`, y deja la auditoría
 * `curator_run` en `gov/audit`.
 *
 * ⚠️ **NO** se le pasa un `DreamConsolidator`: la consolidación ("sueño") ya
 * la dispara `EgoMemoryLifecycle` en su hook de inactividad. Pasárselo
 * aquí consolidaría dos veces por el mismo ciclo.
 *
 * ## Por qué existe (EGO-FIND-22)
 * `MemoryCurator` estaba implementado y verificado en `packages/tasks` pero
 * **sin instanciar**: su capacidad (marcar stale) no ocurría nunca. Aquí se
 * cablea en el arranque de la app y se para en el apagado.
 */
import type { EgoMemoryAdapter } from "@ego/memory";
import { MemoryCurator, type CuratorRunStats } from "@ego/tasks";
// E6: el estado mutable del proceso vive en `app-context.ts` (único sitio),
// no en el módulo que lo usa.
import { memoryCurator, setMemoryCurator } from "../state/app-context.js";

/**
 * Inicia la curaduría programada.
 *
 * Idempotente: si ya había un curator, se para antes de sustituirlo (evita
 * dos temporizadores vivos → la curaduría correría dos veces por ciclo).
 */
export function startMemoryCuration(
  adapter: EgoMemoryAdapter,
  options: { intervalHours?: number; staleAfterDays?: number } = {},
): MemoryCurator {
  memoryCurator?.stop();
  const curator = new MemoryCurator(adapter, {
    intervalHours: options.intervalHours ?? 24,
    staleAfterDays: options.staleAfterDays ?? 90,
  });
  curator.start((stats: CuratorRunStats) => {
    console.warn(
      `[MemoryCurator] corrida: stale=${stats.staleConsolidatedCount} ` +
        `namespaces=${stats.staleNamespacesScanned.join(",")}`,
    );
  });
  setMemoryCurator(curator);
  return curator;
}

/**
 * Para la curaduría (apagado de la app).
 *
 * Sin esto, el `setInterval` del curator seguiría vivo → en Electron
 * impediría que la app cerrase.
 */
export function stopMemoryCuration(): void {
  memoryCurator?.stop();
  setMemoryCurator(null);
}
