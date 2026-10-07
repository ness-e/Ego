// Golden Path Alpha — Test E2E Automatizado (Pasos 1 al 7)
// Valida: Apertura -> Proyecto -> Memoria Contextual -> Persistencia en disco -> Cierre -> Reinicio -> Recuperación intacta
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { EgoMemoryAdapter } from "../EgoMemoryAdapter.js";
import { EgoMemoryLifecycle } from "../EgoMemoryLifecycle.js";

describe("Golden Path Alpha — Durabilidad y Recuperación E2E (CORE-11)", () => {
  const testDir = path.join(os.tmpdir(), `ego-golden-path-${Date.now()}`);
  const dumpPath = path.join(os.tmpdir(), `ego-golden-dump-${Date.now()}.vdbdump`);
  let activeAdapter: EgoMemoryAdapter | null = null;

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    if (activeAdapter && activeAdapter.ready) {
      await activeAdapter.close();
      activeAdapter = null;
    }
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
      await fs.rm(dumpPath, { force: true });
    } catch {
      // Ignorar limpieza en caso de bloqueo transitorio del SO
    }
  });

  it("Paso 1: Inicializa EgoMemoryAdapter con persistencia real Fjall LSM", async () => {
    activeAdapter = new EgoMemoryAdapter(testDir);
    await activeAdapter.init();
    expect(activeAdapter.ready).toBe(true);
    await activeAdapter.close();
    activeAdapter = null;
  });

  it("Pasos 2 al 5: Crea proyecto, almacena contexto, procesa turno y genera .vdbdump", async () => {
    activeAdapter = new EgoMemoryAdapter(testDir);
    await activeAdapter.init();

    // Paso 2: Crear proyecto en namespace canónico
    await activeAdapter.put({
      namespace: "projects/default",
      key: "project:metadata",
      payload: {
        id: "proj_alpha",
        name: "Proyecto Alpha",
        description: "Validación de memoria continua y operativa",
        created_at: Date.now(),
      },
      metadata: { org_id: "org_ego", state: "active" },
    });

    // Paso 3: Guardar hechos de contexto persistente con términos clave
    await activeAdapter.putMulti([
      {
        namespace: "kb/docs",
        key: "arch:core_principles",
        payload: "Principios de Ego: Sistema Operativo Cognitivo con memoria local persistente en VantaDB.",
        metadata: { category: "architecture", confidence: 1.0 },
      },
      {
        namespace: "projects/default/context",
        key: "ctx:user_preference",
        payload: "El usuario prefiere respuestas estructuradas en español técnico.",
        metadata: { source: "user_directive" },
      },
    ]);

    // Paso 4: Ciclo de vida completo del turno (EgoMemoryLifecycle)
    const lifecycle = new EgoMemoryLifecycle(activeAdapter);
    const preTurn = await lifecycle.assemblePreTurn("principios Ego", [
      "kb/docs",
      "projects/default/*",
    ]);

    expect(preTurn.recallStatus.glyph).toContain("🧠");
    expect(preTurn.recallStatus.hits.length).toBeGreaterThan(0);

    // Registro de turno en historial de sesión
    await lifecycle.syncTurnToDisk({
      sessionId: "session_alpha_01",
      turnIndex: 1,
      userMessage: "¿Cuáles son los principios de Ego?",
      assistantResponse: "Ego es un SOC con memoria persistente local.",
      recalledKeys: preTurn.recallStatus.hits.map((h) => h.key),
    });

    // Paso 5: Exportar snapshot .vdbdump con cabecera VDBJSON
    const dumpReport = await activeAdapter.exportDump(dumpPath);
    expect(dumpReport.recordsExported).toBeGreaterThanOrEqual(4);
    expect(dumpReport.checksum).toBeDefined();

    const dumpContent = await fs.readFile(dumpPath, "utf8");
    expect(dumpContent.startsWith("VDBJSON\n")).toBe(true);

    // Cierre forzoso de la sesión simulando cierre de la aplicación
    await activeAdapter.flush();
    await activeAdapter.close();
    activeAdapter = null;
  });

  it("Pasos 6 y 7: Reabre la app y valida recuperación intacta de datos y búsqueda híbrida", async () => {
    // Paso 6: Reabrir EgoMemoryAdapter en la MISMA ruta de disco
    activeAdapter = new EgoMemoryAdapter(testDir);
    await activeAdapter.init();
    expect(activeAdapter.ready).toBe(true);

    // Paso 7: Recuperar proyecto intacto tras reinicio
    const projRecord = (await activeAdapter.get("projects/default", "project:metadata")) as {
      id: string;
      name: string;
    };
    expect(projRecord).toBeDefined();
    expect(projRecord.name).toBe("Proyecto Alpha");

    // Validar recuperación de turno de sesión
    const turnRecord = (await activeAdapter.get("session/turns", "session_alpha_01:turn:1")) as {
      payload: { userPrompt: string };
    } | { userPrompt: string };
    expect(turnRecord).toBeDefined();

    // Validar búsqueda federada multi-namespace concurrente (CORE-09)
    const hits = await activeAdapter.searchMulti(
      ["kb/docs", "projects/default/*"],
      "Sistema Operativo Cognitivo",
      { topK: 5 }
    );

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].score).toBeGreaterThan(0);

    // Validar restauración e importDump en base de datos secundaria limpia
    const restoreDir = path.join(os.tmpdir(), `ego-golden-restore-${Date.now()}`);
    await fs.mkdir(restoreDir, { recursive: true });
    const restoreAdapter = new EgoMemoryAdapter(restoreDir);
    await restoreAdapter.init();

    const importReport = await restoreAdapter.importDump(dumpPath);
    expect(importReport.recordsImported).toBeGreaterThanOrEqual(4);

    const restoredProj = (await restoreAdapter.get("projects/default", "project:metadata")) as {
      name: string;
    };
    expect(restoredProj.name).toBe("Proyecto Alpha");

    await restoreAdapter.close();
    await activeAdapter.close();
    activeAdapter = null;
    await fs.rm(restoreDir, { recursive: true, force: true });
  });
});
