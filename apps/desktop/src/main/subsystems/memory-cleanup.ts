/**
 * E6-res (Ola 3) — El job periódico de limpieza de memoria (STAB-05).
 *
 * Extracción **verbatim** del god-file `main.ts`.
 *
 * Consolida turnos y sesiones obsoletas del workspace. Snapshots `.vdbdump`:
 * fuera (ubicación de dumps gobernada por recovery). Leases: sin owner prod.
 * El job acepta el hook cuando exista instancia gobernada (deuda
 * STAB-05→STAB-12).
 *
 * El estado (los dos timers) vive en `state/app-context.ts`.
 */
import { MemoryCleanupJob } from "@ego/tasks";
import { SubEgoWorktreeManager } from "@ego/subegos";
import { getCachedCompressionSettings } from "../settings-cache.js";
import { adapter, memoryCleanupTimer, memoryCleanupFirst } from "../state/app-context.js";
import { setMemoryCleanupTimer, setMemoryCleanupFirst } from "../state/app-context.js";

export function scheduleMemoryCleanup(): void {
  if (memoryCleanupTimer) return;
  const runCleanup = async (): Promise<void> => {
    try {
      const settings = getCachedCompressionSettings();
      const repoRoot = process.env["EGO_WORKSPACE_PATH"] || process.cwd();
      const worktrees = new SubEgoWorktreeManager();
      const job = new MemoryCleanupJob(adapter, {
        cleanupPeriodDays: settings.cleanupPeriodDays,
        pruneOrphanWorktrees: () =>
          worktrees.pruneOrphanWorktrees(repoRoot, {
            cleanupPeriodDays: settings.cleanupPeriodDays,
          }),
      });
      const report = await job.run();
      const total =
        report.sessions.pruned.length +
        report.turns.pruned.length +
        (report.worktrees?.pruned.length ?? 0);
      if (total > 0) {
        console.log(
          `[Ego Main] MemoryCleanup STAB-05: sesiones=${report.sessions.pruned.length} ` +
            `turns=${report.turns.pruned.length} worktrees=${report.worktrees?.pruned.length ?? 0}`
        );
      }
    } catch (err) {
      console.warn("[Ego Main] MemoryCleanup STAB-05 falló (reintenta en 24h):", err);
    }
  };
  // Primera corrida diferida; luego cada 24h. `unref` para no retener salida.
  setMemoryCleanupFirst(setTimeout(() => {
      setMemoryCleanupFirst(null);
      void runCleanup();
    }, 60_000)
  );
  if (typeof memoryCleanupFirst === "object" && memoryCleanupFirst !== null && "unref" in memoryCleanupFirst) {
    (memoryCleanupFirst as NodeJS.Timeout).unref();
  }
  setMemoryCleanupTimer(setInterval(() => {
    void runCleanup();
  }, 24 * 60 * 60 * 1000));
  if (typeof memoryCleanupTimer === "object" && memoryCleanupTimer !== null && "unref" in memoryCleanupTimer) {
    (memoryCleanupTimer as NodeJS.Timeout).unref();
  }
}

export function stopMemoryCleanupForTests(): void {
  if (memoryCleanupFirst) {
    clearTimeout(memoryCleanupFirst);
    setMemoryCleanupFirst(null);
  }
  if (memoryCleanupTimer) {
    clearInterval(memoryCleanupTimer);
    setMemoryCleanupTimer(null);
  }
}
