/**
 * BUGFIX — siembra de los sub-egos canónicos (IDs opacos DSEK-03).
 *
 * ## Contexto del bug
 * El sembrado del main construía el manifiesto **a mano** con `id: se.id`,
 * donde `se.id` es el ID de *plantilla* ("researcher", "code_reviewer"…),
 * desnudo. El esquema canónico `SubEgoManifestSchema` (regla DSEK-03) exige
 * `^(ego\.[a-z0-9_-]+|sub_[a-z0-9_-]+)$`, así que los 5 especialistas
 * canónicos fallaban con `ZodError` en `parseSubEgoManifest` y NO llegaban a
 * registrarse: el catálogo `gov/sub_egos` quedaba vacío y la app caía al
 * fallback del renderer.
 *
 * Además, el namespace privado se declaraba como `egos/<id-de-plantilla>/*`
 * mientras que `SubEgoMemoryGuard` calcula el estado privado del Sub-Ego
 * como `egos/<callerId>` (= `egos/<manifestId>`): el manifiesto no podía
 * operar sobre su propio namespace.
 *
 * ## Qué afirma este test (por COMPORTAMIENTO, no leyendo el código)
 *  - los IDs resultantes cumplen DSEK-03 y los manifiestos parsean con Zod;
 *  - el sembrado deja los especialistas en el catálogo `gov/sub_egos`;
 *  - el namespace privado del manifiesto y el del perfil en memoria
 *    coinciden (`egos/<manifestId>/*`);
 *  - el sembrado es idempotente, fail-soft y seguro ante llamadas
 *    concurrentes.
 *
 * ## Nota de coste (importante)
 * Cada `EgoMemoryAdapter` abre una base VantaDB real (≈1,5 s) y los tests
 * pesados de la suite (`canvas-interaction`, `sessions-resume`) tienen un
 * timeout de 5 s: añadir carga en paralelo los hace fallar por flake. Por
 * eso este fichero usa **UNA sola** base de datos (compartida por los casos
 * que no necesitan aislamiento) y resuelve el caso fail-soft con dobles de
 * prueba, sin base de datos.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { EgoMemoryAdapter, type PutRouteReport } from "@ego/memory";
import { SubEgoRegistry, SubEgoManifestSchema, createSubEgoId } from "@ego/subegos";
import { createScratchDir, removeScratchDir } from "./helpers/test-scratch.js";

/** `electron` no existe fuera del proceso Electron: se mockea (patrón T03/T13). */
vi.mock("electron", () => ({
  app: undefined,
  BrowserWindow: class {},
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  safeStorage: undefined,
  Tray: class {},
  Menu: {},
  nativeImage: {},
  session: {},
  shell: {},
  contextBridge: { exposeInMainWorld: vi.fn() },
}));

const {
  seedCanonicalSubEgos,
  buildCanonicalSubEgoManifest,
  CANONICAL_SPECIALIST_SUBEGOS,
} = await import("../src/main/ipc/register-ipc.js");

/** Regla DSEK-03: identificadores opacos con prefijo. */
const DSEK03_ID = /^(ego\.[a-z0-9_-]+|sub_[a-z0-9_-]+)$/;

describe("@ego/desktop — siembra de sub-egos canónicos (DSEK-03)", () => {
  describe("1. Construcción del manifiesto (sin base de datos)", () => {
    it("los IDs de plantilla desnudos NO valen como ID de manifiesto (origen del bug)", () => {
      expect(CANONICAL_SPECIALIST_SUBEGOS.length).toBeGreaterThan(0);
      for (const spec of CANONICAL_SPECIALIST_SUBEGOS) {
        expect(spec.id, `el ID de plantilla '${spec.id}' debe quedar desnudo`).not.toMatch(DSEK03_ID);
      }
    });

    it("cada especialista produce un manifiesto con ID DSEK-03 válido y parseable", () => {
      for (const spec of CANONICAL_SPECIALIST_SUBEGOS) {
        const manifest = buildCanonicalSubEgoManifest(spec);

        expect(manifest.id, `ID inválido para '${spec.id}'`).toMatch(DSEK03_ID);
        // El ID se deriva del ID de PLANTILLA (estable), no del nombre visible.
        expect(manifest.id).toBe(createSubEgoId(spec.id));
        expect(manifest.name).toBe(spec.name);

        const parsed = SubEgoManifestSchema.safeParse(manifest);
        expect(
          parsed.success,
          `manifiesto inválido de '${spec.id}': ${JSON.stringify(parsed.success ? [] : parsed.error.issues)}`
        ).toBe(true);
      }
    });

    it("el namespace privado del manifiesto apunta a egos/<manifestId>/* (coherencia con SubEgoMemoryGuard)", () => {
      for (const spec of CANONICAL_SPECIALIST_SUBEGOS) {
        const manifest = buildCanonicalSubEgoManifest(spec);
        expect(manifest.namespaces.read).toContain(`egos/${manifest.id}/*`);
        expect(manifest.namespaces.write).toContain(`egos/${manifest.id}/*`);
        expect(manifest.namespaces.write).toContain("quarantine/pending");
      }
    });
  });

  describe("2. Siembra real sobre VantaDB (una única base compartida)", () => {
    let tmpDir: string;
    let adapter: EgoMemoryAdapter;
    let registry: SubEgoRegistry;

    beforeAll(async () => {
      tmpDir = createScratchDir("ego-subegos-seed");
      adapter = new EgoMemoryAdapter(tmpDir);
      await adapter.init();
      registry = new SubEgoRegistry(adapter);
    });

    afterAll(async () => {
      try {
        await adapter.close();
        removeScratchDir(tmpDir);
      } catch {
        // ignore
      }
    });

    // Este caso va PRIMERO a propósito: necesita que los perfiles aún no
    // existan para poder contar las escrituras.
    it("dos siembras concurrentes comparten la promesa en vuelo (no se siembra dos veces)", async () => {
      const profileWrites: string[] = [];
      const spy = vi.spyOn(adapter, "put").mockImplementation(async (item) => {
        // Solo los perfiles: `SubEgoRegistry.register` también escribe vía
        // `adapter.put` (namespace `gov/sub_egos`) y no cuenta como perfil.
        if (item.namespace.startsWith("egos/")) {
          profileWrites.push(`${item.namespace}:${item.key}`);
        }
        return {
          namespace: item.namespace,
          key: item.key,
          routedTo: "live",
          destinationNamespace: item.namespace,
          destinationKey: item.key,
          reason: "live",
          notice: "",
          unencryptedAtRest: false,
        } as PutRouteReport;
      });
      try {
        await Promise.all([
          seedCanonicalSubEgos(adapter, registry),
          seedCanonicalSubEgos(adapter, registry),
        ]);
        // Un perfil por especialista (5), no 10: el renderer invoca
        // `ipc.subegos.list` varias veces al arrancar y sin cerrojo dos llamadas
        // simultáneas sembrarían dos veces.
        expect(profileWrites.length).toBe(CANONICAL_SPECIALIST_SUBEGOS.length);
      } finally {
        spy.mockRestore();
      }
    });

    it("la siembra registra los especialistas canónicos con IDs válidos", async () => {
      await seedCanonicalSubEgos(adapter, registry);

      const list = await registry.list();
      expect(list.length).toBe(CANONICAL_SPECIALIST_SUBEGOS.length);

      for (const manifest of list) {
        expect(manifest.id, `ID inválido registrado: '${manifest.id}'`).toMatch(DSEK03_ID);
        expect(SubEgoManifestSchema.safeParse(manifest).success).toBe(true);
        expect(manifest.namespaces.write).toContain(`egos/${manifest.id}/*`);
      }

      // Los 5 IDs esperados, derivados del ID de plantilla.
      const ids = list.map((m) => m.id).sort();
      expect(ids).toEqual(CANONICAL_SPECIALIST_SUBEGOS.map((s) => createSubEgoId(s.id)).sort());
    });

    it("el perfil en memoria vive en egos/<manifestId>/profile (mismo prefijo que el manifiesto)", async () => {
      await seedCanonicalSubEgos(adapter, registry);

      for (const spec of CANONICAL_SPECIALIST_SUBEGOS) {
        const manifestId = createSubEgoId(spec.id);
        const record = await adapter.getWithQuarantine(`egos/${manifestId}/profile`, "profile");
        expect(record, `falta el perfil de '${manifestId}'`).not.toBeNull();
        // `egos/*` es namespace sensible (SEC-09): sin cifrado at-rest el perfil
        // se enruta a `quarantine/pending` (VantaDB FIND-249 pendiente).
        expect(record?.quarantined).toBe(true);
      }
    });

    it("la siembra es idempotente: repetirla no duplica ni registra errores", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        await seedCanonicalSubEgos(adapter, registry);
        await seedCanonicalSubEgos(adapter, registry);

        const list = await registry.list();
        expect(list.length).toBe(CANONICAL_SPECIALIST_SUBEGOS.length);

        const fallos = warn.mock.calls.filter((c) => String(c[0]).includes("Error sembrando"));
        expect(fallos).toEqual([]);
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe("3. Fail-soft (dobles de prueba: sin base de datos)", () => {
    it("un fallo al registrar uno NO impide sembrar el resto", async () => {
      const registrados: string[] = [];
      const plannerId = createSubEgoId("planner");

      // Doble de adaptador: no toca disco, solo cuenta escrituras de perfil.
      const fakeAdapter = {
        getWithQuarantine: async () => null,
        put: async () => ({
          namespace: "egos/x/profile",
          key: "profile",
          routedTo: "live",
          destinationNamespace: "egos/x/profile",
          destinationKey: "profile",
          reason: "live",
          notice: "",
          unencryptedAtRest: false,
        } as PutRouteReport),
      } as unknown as EgoMemoryAdapter;

      // Doble de registro: rechaza SOLO al planner y anota el resto.
      const fakeRegistry = {
        get: async () => null,
        register: async (manifest: { id: string }) => {
          if (manifest.id === plannerId) {
            throw new Error("fallo simulado");
          }
          registrados.push(manifest.id);
          return manifest;
        },
      } as unknown as SubEgoRegistry;

      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        // No debe lanzar: el fallo de un especialista se loguea y se continúa.
        await expect(seedCanonicalSubEgos(fakeAdapter, fakeRegistry)).resolves.toBeUndefined();

        // Los otros 4 se registran; el planner falla y no impide el resto.
        expect(registrados.length).toBe(CANONICAL_SPECIALIST_SUBEGOS.length - 1);
        expect(registrados).not.toContain(plannerId);
        const avisos = warn.mock.calls.filter((c) => String(c[0]).includes("Error registrando"));
        expect(avisos.length).toBe(1);
      } finally {
        warn.mockRestore();
      }
    });
  });
});
