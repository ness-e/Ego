import * as crypto from "node:crypto";
import type { EgoMemoryAdapter } from "@ego/memory";
import { getQuarantineAware, listQuarantineAware } from "@ego/memory";
import type { EventBus } from "@ego/events";
import {
  DailyStateSummary,
  DailySnapshotRecord,
  DailySnapshotRecordSchema,
} from "./types.js";
import { DailyStateEngine } from "./DailyStateEngine.js";

export class DailyStatePersistence {
  private memory: EgoMemoryAdapter;
  private eventBus?: EventBus;
  public static readonly NAMESPACE = "system/snapshots/daily";

  constructor(memory: EgoMemoryAdapter, options?: { eventBus?: EventBus }) {
    this.memory = memory;
    this.eventBus = options?.eventBus;
  }

  /**
   * Calcula el checksum SHA-256 canónico de un DailyStateSummary
   */
  public static computeChecksum(summary: DailyStateSummary): string {
    const serialized = JSON.stringify(summary);
    return crypto.createHash("sha256").update(serialized, "utf-8").digest("hex");
  }

  /**
   * Guarda un snapshot inmutable del día en VantaDB con checksum SHA-256
   */
  async saveSnapshot(
    summary: DailyStateSummary,
    journalEntryId?: string
  ): Promise<DailySnapshotRecord> {
    const checksum = DailyStatePersistence.computeChecksum(summary);
    const now = Date.now();

    const record: DailySnapshotRecord = {
      date: summary.date,
      timestamp: now,
      checksum,
      summary,
      journalEntryId,
    };

    const validated = DailySnapshotRecordSchema.parse(record);

    await this.memory.put({
      namespace: DailyStatePersistence.NAMESPACE,
      key: summary.date,
      payload: validated,
      metadata: {
        date: summary.date,
        checksum,
        ts: now,
        agent_id: "ego.nucleus",
      },
    });

    if (this.eventBus) {
      this.eventBus.emit("daily.snapshot.saved", validated, {
        source: "DailyStatePersistence",
      });
    }

    return validated;
  }

  /**
   * Recupera un snapshot histórico por fecha YYYY-MM-DD y valida su integridad.
   *
   * Lectura quarantine-aware (HIG-04 / SEC-09): resuelve live primero y
   * `quarantine/pending` después, para que el retiro del diferimiento de
   * `system/snapshots` no invisibilice los snapshots diarios.
   */
  async getSnapshot(date: string): Promise<DailySnapshotRecord | null> {
    let hit: { payload: unknown } | null;
    try {
      hit = await getQuarantineAware(this.memory, DailyStatePersistence.NAMESPACE, date);
    } catch {
      return null;
    }
    if (!hit) return null;
    const raw = { payload: hit.payload };

    try {
      const record = DailySnapshotRecordSchema.parse(raw.payload);
      // Validar integridad SHA-256 — fail-closed (H15): un mismatch significa
      // manipulación o corrupción; NUNCA se retorna el registro alterado.
      const actualChecksum = DailyStatePersistence.computeChecksum(record.summary);
      if (actualChecksum !== record.checksum) {
        const detail =
          `[DailyStatePersistence] Checksum discrepante en snapshot ${date}. ` +
          `Esperado: ${record.checksum}, Calculado: ${actualChecksum}`;
        if (this.eventBus) {
          this.eventBus.emit(
            "system.alert",
            {
              code: "DAILY_CHECKSUM_MISMATCH",
              message: `Integridad de snapshot diario ${date} comprometida: checksum SHA-256 no coincide.`,
              details: { date, expected: record.checksum, actual: actualChecksum },
            },
            { source: "DailyStatePersistence", severity: "error" }
          );
        } else {
          console.error(detail);
        }
        return null;
      }

      if (this.eventBus) {
        this.eventBus.emit("daily.snapshot.restored", record, {
          source: "DailyStatePersistence",
        });
      }

      return record;
    } catch (err) {
      console.error(`[DailyStatePersistence] Error deserializando snapshot ${date}:`, err);
      return null;
    }
  }

  /**
   * Lista snapshots históricos ordenados cronológicamente descendente.
   *
   * Lectura quarantine-aware (HIG-04 / SEC-09): fusiona live +
   * `quarantine/pending` con la vía compartida, igual que
   * `SessionCheckpointPolicy.listCheckpoints`.
   */
  async listSnapshots(limit: number = 30): Promise<DailySnapshotRecord[]> {
    const records = await listQuarantineAware(
      this.memory,
      DailyStatePersistence.NAMESPACE,
      limit,
      (err) => {
        console.warn(`[DailyStatePersistence] listSnapshots: barrido de cuarentena falló:`, err);
      }
    );
    const snapshots: DailySnapshotRecord[] = [];

    for (const rec of records) {
      try {
        const parsed = DailySnapshotRecordSchema.parse(rec.payload);
        // Fail-closed (H15): omitir registros con checksum inválido.
        const actualChecksum = DailyStatePersistence.computeChecksum(parsed.summary);
        if (actualChecksum !== parsed.checksum) continue;
        snapshots.push(parsed);
      } catch {
        // Ignorar registros corruptos
      }
    }

    // Ordenar de más reciente a más antiguo
    return snapshots.sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Determina si es el primer inicio de la aplicación en el día calendario (COUC-06).
   * Si no existe snapshot para la fecha especificada (o hoy), devuelve true.
   */
  async isFirstLaunchOfDay(date?: string): Promise<boolean> {
    const targetDate = date || DailyStateEngine.getTodayDateString();
    const existing = await this.getSnapshot(targetDate);
    return existing === null;
  }
}
