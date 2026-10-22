import type { EgoMemoryAdapter } from '@ego/memory';
import { DreamConsolidator, type DreamConsolidationStats } from '@ego/memory';
import {
  DEFAULT_CURATION_SETTINGS,
  readCurationSettings,
  type CurationSettings,
} from './CurationSettings.js';

/**
 * Opciones del curator.
 *
 * ⚠️ **Ninguna opción es muerta** (`EGO-FIND-112`): las cuatro que existían
 * (`intervalHours`, `staleAfterDays`, `staleNamespaces`, `staleBatchSize`) son
 * alcanzables desde el producto, porque la configuración vive en
 * `gov/settings/memory_curation` (ver `CurationSettings.ts`) y el producto
 * cablea esa lectura. `staleBatchSize` desaparece: su semántica (el tope de
 * lectura por llamada) la sustituyen `maxRecordsPerRun` (presupuesto de
 * **examen**) y `maxScanRecordsPerRun` (techo de **lectura**), que son
 * cosas distintas.
 */
export interface MemoryCuratorOptions {
  /** Horas entre corridas programadas (por defecto 24). Debe ser > 0. */
  intervalHours?: number;
  /** Días de antigüedad para considerar un registro stale (por defecto 90). Debe ser > 0. */
  staleAfterDays?: number;
  /** Namespaces barridos en busca de stale (por defecto kb/facts + kb/docs). */
  staleNamespaces?: string[];
  /**
   * **Presupuesto** de registros EXAMINADOS por namespace y corrida
   * (por defecto 500). Es el límite de trabajo de la curaduría: leer +
   * evaluar + marcar. Los registros ya terminales o en cuarentena NO lo
   * consumen (el presupuesto se gasta en registros accionables).
   */
  maxRecordsPerRun?: number;
  /**
   * Techo de registros LEÍDOS por namespace y corrida (por defecto 5000).
   * Es la red de seguridad del barrido: el motor no indexa por `ts`, así que
   * para ordenar por antigüedad hay que traer la ventana y ordenarla en
   * memoria. Si el techo corta el namespace, la corrida lo declara
   * (`partial: true`) en vez de fingir que lo ha visto todo.
   */
  maxScanRecordsPerRun?: number;
  /** Tamaño de página del bucle de cursor (por defecto 100). */
  scanPageSize?: number;
}

export interface CuratorRunStats {
  timestamp: number;
  durationMs: number;
  staleConsolidatedCount: number;
  staleNamespacesScanned: string[];
  /** Registros LEÍDOS del almacenamiento en esta corrida. */
  scannedCount: number;
  /** Registros EXAMINADOS (evaluados para su antigüedad) en esta corrida. */
  examinedCount: number;
  /**
   * Claves examinadas, en orden de antigüedad (de más viejo a más nuevo),
   * con el namespace delante: `kb/facts:<clave>`. Es observabilidad (y la
   * aserción de las pruebas): NO se persiste en la auditoría.
   */
  examinedKeys: string[];
  /** `true` si algún namespace quedó truncado por el techo de lectura. */
  partial: boolean;
  /** Presupuesto de examen vigente en la corrida. */
  maxRecordsPerRun: number;
  /** Ventana de antigüedad vigente en la corrida (días). */
  staleAfterDays: number;
  /** Presente solo cuando se configuró un DreamConsolidator. */
  dream?: DreamConsolidationStats;
}

interface CuratorListItem {
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

interface CuratorListPage {
  records: CuratorListItem[];
  nextCursor?: number | string;
}

/** Superficie mínima del adapter que usa el curator (list/listPaged/put/recordAudit). */
interface CuratorGateway {
  list(namespace: string, limit?: number): Promise<CuratorListItem[]>;
  listPaged?(
    namespace: string,
    limit?: number,
    cursor?: number | string,
  ): Promise<CuratorListPage>;
  get?(
    namespace: string,
    key: string,
  ): Promise<{ key: string; payload: unknown; metadata?: Record<string, unknown> } | null>;
  put(item: CuratorPut): Promise<unknown>;
  putMulti?(items: CuratorPut[]): Promise<unknown>;
  recordAudit?(action: string, actor: string, details: Record<string, unknown>): Promise<unknown>;
}

interface CuratorPut {
  namespace: string;
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

function asGateway(adapter: EgoMemoryAdapter): CuratorGateway {
  return adapter as unknown as CuratorGateway;
}

function isQuarantined(metadata: Record<string, unknown> | undefined): boolean {
  if (!metadata) return false;
  if (metadata['quarantined'] === true) return true;
  if (metadata['state'] === 'quarantined') return true;
  // Envoltorio de quarantine/pending: solo el DreamConsolidator lo toca.
  if (typeof metadata['original_namespace'] === 'string') return true;
  return false;
}

function isTerminalState(metadata: Record<string, unknown> | undefined): boolean {
  if (!metadata) return false;
  const state = metadata['state'];
  return state === 'superseded' || state === 'archived';
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Timestamp de última actividad del registro (metadata primero, payload después). */
function readRecordTimestamp(item: CuratorListItem): number | null {
  const meta = item.metadata;
  if (meta) {
    for (const field of ['ts', 'created_at', 'updated_at', 'timestamp']) {
      const ts = readNumber(meta[field]);
      if (ts !== null) return ts;
    }
  }
  const payload = item.payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const p = payload as Record<string, unknown>;
    for (const field of ['timestamp', 'updated_at', 'created_at']) {
      const ts = readNumber(p[field]);
      if (ts !== null) return ts;
    }
  }
  return null;
}

/** Comparador de claves (orden lexicográfico, determinista). */
function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Cuenta los ítems que han quedado VIVOS tras la escritura.
 *
 * El borde de escritura (`EgoMemoryAdapter.putMulti`) puede enrutar un ítem a
 * `quarantine/pending` (SEC-04/SEC-09): ese registro **no** está curado y no
 * debe contar como tal. Si el informe no tiene la forma esperada, se cuenta
 * el lote entero (el comportamiento por defecto del borde).
 */
function countLive(reports: unknown, fallback: number): number {
  if (!Array.isArray(reports)) return fallback;
  let live = 0;
  for (const r of reports) {
    const routed = r && typeof r === 'object' ? (r as { routedTo?: string }).routedTo : undefined;
    if (routed !== 'quarantine') live++;
  }
  return live;
}

/**
 * Job programado de curaduría de memoria (CFG-08).
 *
 * Cada corrida:
 * 1. Delega en `DreamConsolidator.runCycle` si se configuró (purga de
 *    cuarentena expirada + deduplicación) — el curator NUNCA toca
 *    `quarantine/pending` por su cuenta: los registros marcados como
 *    cuarentena se omiten siempre.
 * 2. Marca como `superseded` (soft-replace, nunca borra en caliente) los
 *    registros de `staleNamespaces` sin actividad por más de
 *    `staleAfterDays`. Sin timestamp evidenciable → no se toca.
 *
 * ## El barrido real (Ola 10, `EGO-FIND-110` / `EGO-FIND-111`)
 *
 * Antes el barrido era **una sola** llamada `list(ns, 50)`: sin bucle de
 * cursor (los registros más allá del puesto 50 nunca se curaban) y **por
 * orden de clave** (el conjunto examinado era estable e independiente de la
 * edad: un registro nuevo nunca entraba y los 50 primeros por clave se
 * reexaminaban eternamente).
 *
 * Ahora:
 *
 * 1. **Lee paginando** (`listPaged` + cursor opaco) hasta agotar el
 *    namespace o alcanzar el techo de lectura (`maxScanRecordsPerRun`).
 * 2. **Ordena por antigüedad** en memoria: el motor no indexa por `ts`, así
 *    que la antigüedad se calcula tras traer la ventana leída (decisión
 *    medida y justificada en el handoff de la Ola 10).
 * 3. **Examina** los más antiguos primero, hasta el presupuesto
 *    (`maxRecordsPerRun`). Los registros ya terminales o en cuarentena no
 *    consumen presupuesto: el trabajo se gasta en registros accionables, así
 *    que la curaduría **converge** (cada corrida avanza a los siguientes más
 *    antiguos).
 *
 * ## Quién es el dueño de la consolidación ("sueño")
 *
 * En el producto, la consolidación de hechos la dispara **el lifecycle**
 * (`EgoMemoryLifecycle.runDreamConsolidation`, en el hook de inactividad de
 * 5 min): es el que tiene el disparador natural y deja la evidencia en
 * `gov/audit`. Por eso **el producto NO le pasa un `DreamConsolidator` a este
 * curator**: hacerlo consolidaría dos veces por el mismo ciclo. Este job
 * aporta la capacidad que el lifecycle no tiene: **marcar stale**.
 */
export class MemoryCurator {
  private readonly gateway: CuratorGateway;
  private readonly consolidator?: DreamConsolidator;
  private readonly options: MemoryCuratorOptions;
  private timer: NodeJS.Timeout | null = null;
  private scheduledHours = 0;
  private onRun?: (stats: CuratorRunStats) => void;
  private stopped = false;

  constructor(
    adapter: EgoMemoryAdapter,
    options: MemoryCuratorOptions = {},
    consolidator?: DreamConsolidator,
  ) {
    if (options.intervalHours !== undefined && !isPositive(options.intervalHours)) {
      throw new Error(
        `[MemoryCurator] intervalHours debe ser > 0 (recibido: ${options.intervalHours})`
      );
    }
    if (options.staleAfterDays !== undefined && !isPositive(options.staleAfterDays)) {
      throw new Error(
        `[MemoryCurator] staleAfterDays debe ser > 0 (recibido: ${options.staleAfterDays})`
      );
    }
    if (options.maxRecordsPerRun !== undefined && !isPositiveInteger(options.maxRecordsPerRun)) {
      throw new Error(
        `[MemoryCurator] maxRecordsPerRun debe ser un entero > 0 (recibido: ${options.maxRecordsPerRun})`
      );
    }
    if (
      options.maxScanRecordsPerRun !== undefined &&
      !isPositiveInteger(options.maxScanRecordsPerRun)
    ) {
      throw new Error(
        `[MemoryCurator] maxScanRecordsPerRun debe ser un entero > 0 (recibido: ${options.maxScanRecordsPerRun})`
      );
    }
    if (options.scanPageSize !== undefined && !isPositiveInteger(options.scanPageSize)) {
      throw new Error(
        `[MemoryCurator] scanPageSize debe ser un entero > 0 (recibido: ${options.scanPageSize})`
      );
    }
    this.gateway = asGateway(adapter);
    this.consolidator = consolidator;
    this.options = { ...options };
  }

  public get running(): boolean {
    return this.timer !== null;
  }

  /**
   * Ajustes efectivos de la corrida: opción explícita > ajuste persistido en
   * `gov/settings/memory_curation` > default del paquete.
   */
  private async resolveSettings(): Promise<CurationSettings> {
    const persisted = await this.readPersistedSettings();
    return {
      intervalHours:
        this.options.intervalHours ??
        persisted.intervalHours ??
        DEFAULT_CURATION_SETTINGS.intervalHours,
      staleAfterDays:
        this.options.staleAfterDays ??
        persisted.staleAfterDays ??
        DEFAULT_CURATION_SETTINGS.staleAfterDays,
      staleNamespaces:
        this.options.staleNamespaces ??
        persisted.staleNamespaces ??
        DEFAULT_CURATION_SETTINGS.staleNamespaces,
      maxRecordsPerRun:
        this.options.maxRecordsPerRun ??
        persisted.maxRecordsPerRun ??
        DEFAULT_CURATION_SETTINGS.maxRecordsPerRun,
    };
  }

  /** Ajustes persistidos (o defaults si no hay gateway `get` o falló la lectura). */
  private async readPersistedSettings(): Promise<CurationSettings> {
    if (typeof this.gateway.get !== 'function') {
      return { ...DEFAULT_CURATION_SETTINGS };
    }
    // El envoltorio conserva el `this` del gateway (el método del adapter
    // lo necesita) y satisface el lector de ajustes.
    const reader = {
      get: (namespace: string, key: string) =>
        this.gateway.get!(namespace, key),
    };
    return readCurationSettings(reader);
  }

  /**
   * Lee un namespace completo (paginado con cursor) hasta agotarlo o hasta
   * alcanzar el techo de lectura.
   *
   * @returns los registros leídos y si el barrido quedó truncado.
   */
  private async readNamespace(
    namespace: string,
    pageSize: number,
    maxScan: number,
  ): Promise<{ items: CuratorListItem[]; truncated: boolean }> {
    const items: CuratorListItem[] = [];

    if (typeof this.gateway.listPaged === 'function') {
      let cursor: number | string | undefined = undefined;
      // Tope de iteraciones: defensive (un cursor que no avanza se corta
      // antes) y para que un motor con cursor defectuoso no itere sin fin.
      const maxIterations = Math.max(1, Math.ceil(maxScan / pageSize)) + 1;
      for (let i = 0; i < maxIterations; i++) {
        const limit = Math.max(1, Math.min(pageSize, maxScan - items.length));
        const page = await this.gateway.listPaged(namespace, limit, cursor);
        const records = page?.records ?? [];
        if (records.length > 0) items.push(...records);
        const next = page?.nextCursor;
        if (!next || next === cursor || records.length === 0) {
          return { items, truncated: false };
        }
        if (items.length >= maxScan) {
          // Techo alcanzado y queda página siguiente ⇒ el namespace NO se
          // ha visto entero: se declara (nunca se disimula).
          return { items: items.slice(0, maxScan), truncated: true };
        }
        cursor = next;
      }
      return { items, truncated: true };
    }

    // Sin `listPaged` (adapter legacy): una sola lectura acotada.
    const records = await this.gateway.list(namespace, maxScan);
    const list = records ?? [];
    return { items: list, truncated: list.length >= maxScan };
  }

  /**
   * Barre un namespace: lee, ordena por antigüedad, examina los más antiguos
   * hasta el presupuesto y marca los stale (soft-replace, nunca borra).
   */
  private async sweepNamespace(
    namespace: string,
    now: number,
    settings: CurationSettings,
    pageSize: number,
    maxScan: number,
  ): Promise<{
    examinedKeys: string[];
    consolidated: number;
    scanned: number;
    truncated: boolean;
  }> {
    const cutoff = now - settings.staleAfterDays * 24 * 60 * 60 * 1000;
    const { items, truncated } = await this.readNamespace(namespace, pageSize, maxScan);

    // 1) ¿Accionable? (no terminal, no en cuarentena, con timestamp)
    const actionable: Array<{ item: CuratorListItem; ts: number }> = [];
    for (const item of items) {
      if (isQuarantined(item.metadata)) continue;
      if (isTerminalState(item.metadata)) continue;
      const ts = readRecordTimestamp(item);
      if (ts === null) continue;
      actionable.push({ item, ts });
    }

    // 2) Orden por ANTIGÜEDAD (el motor no indexa por `ts`: se ordena en
    //    memoria tras traer la ventana leída). Desempate por clave para que
    //    el orden sea determinista.
    actionable.sort((a, b) => a.ts - b.ts || compareKeys(a.item.key, b.item.key));

    // 3) Presupuesto: los más antiguos primero.
    const examined = actionable.slice(0, settings.maxRecordsPerRun);

    // 4) Marca los stale. Se ESCRIBE EN LOTE: medido (Ola 10), un `put`
    //    individual cuesta ~25-33 ms/registro (500 marcas = 16 s), mientras
    //    que un `putMulti` de 500 cuesta ~0,6 s (~1,2 ms/registro): 27× más
    //    barato. Sin lote, el presupuesto de la curaduría sería inviable.
    const toMark: CuratorPut[] = [];
    for (const { item, ts } of examined) {
      if (ts > cutoff) continue;

      let payload: Record<string, unknown>;
      if (typeof item.payload === 'string') {
        try {
          const parsed: unknown = JSON.parse(item.payload);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
          payload = parsed as Record<string, unknown>;
        } catch {
          continue;
        }
      } else if (item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload)) {
        payload = { ...(item.payload as Record<string, unknown>) };
      } else {
        continue;
      }

      toMark.push({
        namespace,
        key: item.key,
        payload: {
          ...payload,
          is_latest: false,
          superseded_by: 'curator:stale',
        },
        metadata: {
          ...(item.metadata ?? {}),
          state: 'superseded',
          superseded_by: 'curator:stale',
          superseded_at: now,
        },
      });
    }

    const consolidated = await this.writeStale(toMark);

    return {
      examinedKeys: examined.map((e) => `${namespace}:${e.item.key}`),
      consolidated,
      scanned: items.length,
      truncated,
    };
  }

  /**
   * Escribe las marcas stale (soft-replace). Usa `putMulti` cuando el adapter
   * lo expone (lote: ~1 ms/registro) y cae a `put` secuencial si no lo expone
   * o si el lote falla (fail-soft: un registro problemático no puede tumbar
   * la curaduría entera).
   *
   * Sólo cuenta lo que ha quedado **vivo**: un ítem que el borde de escritura
   * enrutó a `quarantine/pending` **no** está curado (y no se debe contar como
   * si lo estuviera).
   *
   * @returns cuántos registros se marcaron de verdad.
   */
  private async writeStale(records: CuratorPut[]): Promise<number> {
    if (records.length === 0) return 0;

    if (typeof this.gateway.putMulti === 'function') {
      try {
        let written = 0;
        for (let i = 0; i < records.length; i += WRITE_BATCH_SIZE) {
          const batch = records.slice(i, i + WRITE_BATCH_SIZE);
          const reports = await this.gateway.putMulti(batch);
          written += countLive(reports, batch.length);
        }
        return written;
      } catch (err) {
        console.warn(
          `[MemoryCurator] el lote de marcado falló, se reintenta registro a registro: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    let written = 0;
    for (const record of records) {
      try {
        const report = await this.gateway.put(record);
        written += countLive(report, 1);
      } catch (err) {
        console.warn(
          `[MemoryCurator] no se pudo marcar ${record.namespace}:${record.key}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    return written;
  }

  public async runOnce(now: number = Date.now()): Promise<CuratorRunStats> {
    const startTime = Date.now();
    let dream: DreamConsolidationStats | undefined;
    if (this.consolidator) {
      dream = await this.consolidator.runCycle(now);
    }

    const settings = await this.resolveSettings();
    const pageSize = this.options.scanPageSize ?? DEFAULT_SCAN_PAGE_SIZE;
    const maxScan = this.options.maxScanRecordsPerRun ?? DEFAULT_MAX_SCAN_RECORDS;

    let staleConsolidatedCount = 0;
    let scannedCount = 0;
    let examinedCount = 0;
    let partial = false;
    const scanned: string[] = [];
    const examinedKeys: string[] = [];

    for (const ns of settings.staleNamespaces) {
      let result: Awaited<ReturnType<MemoryCurator['sweepNamespace']>>;
      try {
        result = await this.sweepNamespace(ns, now, settings, pageSize, maxScan);
      } catch {
        continue;
      }
      scanned.push(ns);
      staleConsolidatedCount += result.consolidated;
      scannedCount += result.scanned;
      examinedCount += result.examinedKeys.length;
      examinedKeys.push(...result.examinedKeys);
      if (result.truncated) partial = true;
    }

    if (this.gateway.recordAudit) {
      try {
        await this.gateway.recordAudit('curator_run', 'ego.memory_curator', {
          staleConsolidatedCount,
          staleNamespacesScanned: scanned,
          staleAfterDays: settings.staleAfterDays,
          timestamp: now,
          scannedCount,
          examinedCount,
          maxRecordsPerRun: settings.maxRecordsPerRun,
          partial,
        });
      } catch (err) {
        console.warn(
          `[MemoryCurator] auditoría de corrida falló (resultado intacto): ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return {
      timestamp: now,
      durationMs: Date.now() - startTime,
      staleConsolidatedCount,
      staleNamespacesScanned: scanned,
      scannedCount,
      examinedCount,
      examinedKeys,
      partial,
      maxRecordsPerRun: settings.maxRecordsPerRun,
      staleAfterDays: settings.staleAfterDays,
      ...(dream !== undefined ? { dream } : {}),
    };
  }

  /**
   * Inicia la corrida periódica (idempotente; cada `intervalHours`).
   *
   * El temporizador **no retiene el proceso** (`unref`): en Electron, un
   * `setInterval` vivo impediría que la app cerrase.
   *
   * Una corrida fallida **no** detiene la programación: se registra y el
   * siguiente tick sigue igual (fail-soft).
   *
   * La cadencia se relee de `gov/settings` en cada tick: si el ajuste
   * guardado cambia, el temporizador se reprograma (así la cadencia sale de
   * la configuración del producto y no de un literal).
   */
  public start(onRun?: (stats: CuratorRunStats) => void): void {
    if (this.timer !== null) return;
    this.onRun = onRun;
    this.stopped = false;
    const initialHours = this.options.intervalHours ?? DEFAULT_CURATION_SETTINGS.intervalHours;
    this.schedule(initialHours);
    // La cadencia persistida puede ser distinta: se aplica en cuanto se lee.
    void this.refreshSchedule();
  }

  /** Programa el temporizador con la cadencia dada (sin `unref` → sí, con). */
  private schedule(hours: number): void {
    this.scheduledHours = hours;
    const intervalMs = hours * 60 * 60 * 1000;
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    const t = this.timer as unknown as { unref?: () => void };
    if (typeof t.unref === 'function') {
      t.unref();
    }
  }

  /** Relee la cadencia persistida y reprograma si ha cambiado. */
  private async refreshSchedule(): Promise<void> {
    if (this.stopped || this.timer === null) return;
    let persisted: CurationSettings;
    try {
      persisted = await this.readPersistedSettings();
    } catch {
      return;
    }
    const effective = this.options.intervalHours ?? persisted.intervalHours;
    if (this.stopped || this.timer === null) return;
    if (effective !== this.scheduledHours) {
      clearInterval(this.timer);
      this.timer = null;
      this.schedule(effective);
    }
  }

  /** Un tick: reevalúa la cadencia y lanza la corrida (fail-soft). */
  private async tick(): Promise<void> {
    if (this.stopped) return;
    await this.refreshSchedule();
    try {
      const stats = await this.runOnce();
      this.onRun?.(stats);
    } catch (err: unknown) {
      // Defensive: una corrida fallida no detiene la programación.
      console.warn(
        `[MemoryCurator] corrida fallida (resultado intacto): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  public stop(): void {
    this.stopped = true;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

/** Tamaño de página del bucle de cursor (por defecto 100). */
export const DEFAULT_SCAN_PAGE_SIZE = 100;

/** Techo de registros LEÍDOS por namespace y corrida (por defecto 5000). */
export const DEFAULT_MAX_SCAN_RECORDS = 5000;

/** Tamaño del lote de escritura (`putMulti`): medido, 500 ≈ 0,6 s. */
export const WRITE_BATCH_SIZE = 500;

function isPositive(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isPositiveInteger(value: number): boolean {
  return isPositive(value) && Number.isInteger(value);
}
