/**
 * Auto-updater de Ego — DIST-05 (esqueleto sin firma).
 *
 * Alcance: detección de nueva versión contra un feed JSON + aviso discreto
 * (`system.alert` → `ipc.event`, canal push ya existente). NO descarga ni
 * instala: eso requiere `electron-updater` + bloque `publish` + artefactos
 * firmados (DIST-04, bloqueado por owner) — ver `downloadUpdate()`.
 *
 * Diseño: módulo PURO, sin imports de `electron` ni de `@ego/*`, para que
 * los tests corran en vitest sin mocks de Electron. Todo efecto colateral
 * (fetch, notify, versión, packaged) se inyecta por parámetros.
 *
 * Contrato del feed JSON (inyectable; sin red real en tests):
 *   `{ "version": "0.2.0", "url"?: "...", "notes"?: "..." }`
 * En prod la URL del feed sale de `EGO_UPDATE_FEED_URL`; sin ella el
 * updater queda idle (Gate D-3) en vez de golpear un endpoint inexistente.
 */

/** Entrada mínima del feed de releases. */
export interface UpdateFeed {
  version: string;
  url?: string;
  notes?: string;
}

/** Estado observable del chequeo. */
export type UpdateCheckStatus =
  | "up-to-date"
  | "available"
  | "error"
  | "idle";

/** Resultado de un chequeo (nunca lanza: el error viaja aquí). */
export interface UpdateCheckResult {
  status: UpdateCheckStatus;
  currentVersion: string;
  latestVersion?: string;
  feedUrl?: string;
  error?: string;
}

/** Aviso discreto entregado a `main.ts` para su retransmisión. */
export interface UpdateNotice {
  code: "EGO_UPDATE_AVAILABLE";
  currentVersion: string;
  latestVersion: string;
  url?: string;
  notes?: string;
}

/** Resultado del intento de descarga (stub hasta DIST-04). */
export interface UpdateDownloadResult {
  status: "deferred";
  reason: string;
}

/** Dependencias inyectables del chequeo. */
export interface UpdateCheckDeps {
  currentVersion: string;
  feedUrl: string | undefined;
  fetchFeed: (url: string) => Promise<unknown>;
  notify: (notice: UpdateNotice) => void;
}

/**
 * Compara versiones `major.minor.patch`. Tolera prefijo `v` y sufijos
 * `-prerelease`/`+build` (se ignoran para el orden). Retorna >0 si `a`
 * es más nueva, <0 si es más vieja, 0 si empatan. Componentes no
 * numéricos se tratan como 0 (fail-closed hacia "no actualizar").
 */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string): number[] =>
    v
      .trim()
      .replace(/^v/i, "")
      .split(/[-+]/)[0]
      ?.split(".")
      .map((p) => {
        const n = Number.parseInt(p, 10);
        return Number.isNaN(n) ? 0 : n;
      }) ?? [0];
  const pa = parts(a);
  const pb = parts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/** Valida la forma mínima del feed (fail-closed: retorna `null`). */
export function parseUpdateFeed(raw: unknown): UpdateFeed | null {
  if (typeof raw !== "object" || raw === null) return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.version !== "string" || rec.version.trim().length === 0) {
    return null;
  }
  const feed: UpdateFeed = { version: rec.version.trim() };
  if (typeof rec.url === "string" && rec.url.length > 0) feed.url = rec.url;
  if (typeof rec.notes === "string" && rec.notes.length > 0) {
    feed.notes = rec.notes;
  }
  return feed;
}

/** Resuelve la URL del feed: env explícito o `undefined` (idle). */
export function resolveUpdateFeedUrl(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): string | undefined {
  const raw = env.EGO_UPDATE_FEED_URL;
  if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  return undefined;
}

/**
 * Chequea el feed una vez. Si hay versión más nueva, emite UN aviso
 * discreto vía `notify` y retorna `available`. Errores de red/parseo
 * → `error` con motivo; sin `feedUrl` → `idle`. Nunca lanza.
 */
export async function checkForUpdates(
  deps: UpdateCheckDeps
): Promise<UpdateCheckResult> {
  const { currentVersion, feedUrl, fetchFeed, notify } = deps;
  if (!feedUrl) {
    return { status: "idle", currentVersion };
  }
  let raw: unknown;
  try {
    raw = await fetchFeed(feedUrl);
  } catch (err) {
    return {
      status: "error",
      currentVersion,
      feedUrl,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  const feed = parseUpdateFeed(raw);
  if (!feed) {
    return {
      status: "error",
      currentVersion,
      feedUrl,
      error: "feed inválido: falta `version`",
    };
  }
  if (compareVersions(feed.version, currentVersion) > 0) {
    notify({
      code: "EGO_UPDATE_AVAILABLE",
      currentVersion,
      latestVersion: feed.version,
      ...(feed.url ? { url: feed.url } : {}),
      ...(feed.notes ? { notes: feed.notes } : {}),
    });
    return {
      status: "available",
      currentVersion,
      latestVersion: feed.version,
      feedUrl,
    };
  }
  return {
    status: "up-to-date",
    currentVersion,
    latestVersion: feed.version,
    feedUrl,
  };
}

/**
 * Descarga diferencial — STUB hasta DIST-04.
 *
 * La diferencial real la provee `electron-updater` (blockmap NSIS) al
 * configurar `publish` + artefactos firmados; implementarla a mano aquí
 * reinventaría ese stack con riesgo de seguridad. Retorna `deferred`
 * explícito para que ningún caller asuma instalación silenciosa.
 */
export function downloadUpdate(): UpdateDownloadResult {
  return {
    status: "deferred",
    reason:
      "BLOQUEO parcial DIST-04: requiere electron-updater + bloque `publish` " +
      "activo + artefactos firmados del owner. El esqueleto DIST-05 solo " +
      "detecta y avisa.",
  };
}

/** Opciones del controlador de arranque. */
export interface AutoUpdaterOptions {
  currentVersion: string;
  isPackaged: boolean;
  feedUrl: string | undefined;
  fetchFeed: (url: string) => Promise<unknown>;
  notify: (notice: UpdateNotice) => void;
  /** Retardo del primer chequeo (defecto 30s para no competir con el arranque). */
  initialDelayMs?: number;
  /** Intervalo de re-chequeo (defecto 6h; 0 = solo el inicial). */
  intervalMs?: number;
  scheduleFn?: (fn: () => void, ms: number) => unknown;
}

/** Controlador con chequeo diferido + re-chequeos programados. */
export interface AutoUpdater {
  checkSoon: (delayMs?: number) => void;
  checkNow: () => Promise<UpdateCheckResult>;
  dispose: () => void;
  lastResult: UpdateCheckResult | null;
}

const DEFAULT_INITIAL_DELAY_MS = 30_000;
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1_000;

/**
 * Inicializa el updater. No-op total si no es build empaquetada
 * (dev/test jamás tocan red). El caller programa `checkSoon()`.
 */
export function initAutoUpdater(opts: AutoUpdaterOptions): AutoUpdater {
  const timers: unknown[] = [];
  let lastResult: UpdateCheckResult | null = null;
  let disposed = false;

  const schedule =
    opts.scheduleFn ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));

  const doCheck = async (): Promise<UpdateCheckResult> => {
    if (disposed || !opts.isPackaged) {
      lastResult = { status: "idle", currentVersion: opts.currentVersion };
      return lastResult;
    }
    lastResult = await checkForUpdates({
      currentVersion: opts.currentVersion,
      feedUrl: opts.feedUrl,
      fetchFeed: opts.fetchFeed,
      notify: opts.notify,
    });
    return lastResult;
  };

  return {
    checkSoon(delayMs: number = DEFAULT_INITIAL_DELAY_MS): void {
      if (disposed || !opts.isPackaged) return;
      timers.push(
        schedule(() => {
          void doCheck();
          const interval = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
          if (interval > 0) {
            timers.push(
              schedule(() => {
                void doCheck();
              }, interval)
            );
          }
        }, delayMs)
      );
    },
    checkNow(): Promise<UpdateCheckResult> {
      return doCheck();
    },
    dispose(): void {
      disposed = true;
      for (const t of timers) {
        if (
          typeof t === "object" &&
          t !== null &&
          "unref" in t &&
          typeof (t as { unref: unknown }).unref === "function"
        ) {
          (t as { unref: () => void }).unref();
        }
      }
      timers.length = 0;
    },
    get lastResult(): UpdateCheckResult | null {
      return lastResult;
    },
  };
}
