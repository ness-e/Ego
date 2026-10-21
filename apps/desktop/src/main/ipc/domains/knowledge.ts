/**
 * T3 (Ola 5) — Canal IPC `ipc.knowledge.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import {
  KnowledgeIngestSchema,
  KnowledgeHybridSearchSchema,
  KnowledgeGraphRagSchema,
  KnowledgeQuarantineActionSchema,
  KnowledgeAsOfSchema,
  KnowledgeExplainArtifactSchema,
  KnowledgeExportSchema,
  KnowledgeImportSchema,
} from "../../../ipc/schema.js";
import { assertPathInScope } from "../../path-scope.js";
import { activeProjectId } from ".././ipc-state.js";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.knowledge.*`. */
export function registerKnowledgeIpc(deps: IpcDeps): void {
  const {
    bitemporalQueries,
    currentScopeDirs,
    documentParser,
    factLifecycle,
    graphRagEngine,
    hybridSearch,
    knowledgeExport,
    knowledgeIndexer,
    projectMemoryGraph,
    quarantineManager,
  } = deps;

  ipcMain.handle("ipc.knowledge.ingest", async (_e, rawReq: unknown) => {
    const parseResult = KnowledgeIngestSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const req = parseResult.data;

    // T2 (EGO-FIND-26): `filePath` viene del renderer (untrusted) y
    // `documentParser.parseFile` hace `fs.readFile` de esa ruta → sin
    // validación de scope, el renderer leía CUALQUIER archivo del SO y lo
    // indexaba en la base de conocimiento. Fail-closed.
    let sourceFilePath: string | undefined;
    if (req.filePath) {
      const scopeVerdict = assertPathInScope(req.filePath, currentScopeDirs(), "filePath");
      if (!scopeVerdict.ok) {
        return { ok: false, error: scopeVerdict.reason };
      }
      sourceFilePath = scopeVerdict.path;
    }

    const parsed = sourceFilePath
      ? await documentParser.parseFile(sourceFilePath)
      : documentParser.parseContent(req.content || "", req.title || "inline", req.mimeType);

    const indexResult = await knowledgeIndexer.indexDocument(parsed, {
      projectId: req.projectId,
    });
    return { ok: true, ...indexResult };
  });

  ipcMain.handle("ipc.knowledge.hybridSearch", async (_e, rawReq: unknown) => {
    const parseResult = KnowledgeHybridSearchSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const req = parseResult.data;
    const hits = await hybridSearch.search(req.query, {
      topK: req.topK,
      minConfidence: req.minConfidence,
      namespaces: req.namespaces,
    });
    return { ok: true, hits };
  });

  ipcMain.handle("ipc.knowledge.graphRag", async (_e, rawReq: unknown) => {
    const parseResult = KnowledgeGraphRagSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const req = parseResult.data;
    const context = await graphRagEngine.search(req.query, {
      maxDepth: req.maxDepth,
      maxDegreePerNode: req.maxDegreePerNode,
      maxTotalNodes: req.maxTotalNodes,
      minSimilarity: req.minSimilarity,
    });
    return { ok: true, context };
  });

  ipcMain.handle("ipc.knowledge.quarantine", async (_e, rawReq: unknown) => {
    const parseResult = KnowledgeQuarantineActionSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const req = parseResult.data;
    if (req.action === "list") {
      const pending = await quarantineManager.listPending();
      return { ok: true, pending };
    }
    if (req.action === "promote" && req.factId) {
      try {
        const promoted = await factLifecycle.promoteFromQuarantine(req.factId, {
          promotedBy: req.promotedBy,
        });
        return { ok: true, promoted };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message || "Error al promover fact" };
      }
    }
    if (req.action === "reject" && req.factId) {
      const deleted = await quarantineManager.reject(req.factId);
      return { ok: true, deleted };
    }
    if (req.action === "purge") {
      const purged = await quarantineManager.purgeExpired();
      return { ok: true, purged };
    }
    return { ok: false, error: "Acción de cuarentena no soportada" };
  });

  ipcMain.handle("ipc.knowledge.asOf", async (_e, rawReq: unknown) => {
    const parseResult = KnowledgeAsOfSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const req = parseResult.data;
    const facts = await bitemporalQueries.asOf(req.targetTime, {
      namespace: req.namespace,
      subject: req.subject,
      limit: req.limit,
    });
    return { ok: true, facts };
  });

  ipcMain.handle("ipc.knowledge.explainArtifact", async (_e, rawReq: unknown) => {
    const parseResult = KnowledgeExplainArtifactSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const req = parseResult.data;
    // T2 (EGO-FIND-26): `filePath` viene del renderer. La traza se busca en
    // el grafo de memoria, pero la ruta se usa como clave hex y la búsqueda
    // recorre `proj/file_traces` — sin validación de scope, el renderer
    // podía interrogar trazas de rutas arbitrarias. Fail-closed.
    const scopeVerdict = assertPathInScope(req.filePath, currentScopeDirs(), "filePath");
    if (!scopeVerdict.ok) {
      return { ok: false, error: scopeVerdict.reason };
    }
    const explanation = await projectMemoryGraph.explainArtifact(scopeVerdict.path);
    return { ok: true, explanation };
  });

  ipcMain.handle("ipc.knowledge.export", async (_e, rawReq: unknown) => {
    const parseResult = KnowledgeExportSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const pId = parseResult.data ?? activeProjectId;
    const pkg = await knowledgeExport.exportPackage(pId);
    return { ok: true, pkg };
  });

  ipcMain.handle("ipc.knowledge.import", async (_e, rawReq: unknown) => {
    // SEC-02: solo se acepta paquete inline. Un `string` llegaría a
    // `fs.readFile` dentro de `importPackage` (lectura arbitraria de
    // archivos desde el renderer, que es untrusted).
    const parseResult = KnowledgeImportSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const pkg = parseResult.data;
    const result = await knowledgeExport.importPackage({
      version: pkg.version,
      projectId: pkg.projectId,
      exportedAt: pkg.exportedAt ?? Date.now(),
      checksum: pkg.checksum,
      totalRecords: pkg.totalRecords ?? pkg.records.length,
      records: pkg.records.map((rec) => ({
        namespace: rec.namespace,
        key: rec.key,
        payload: rec.payload as unknown,
        metadata: rec.metadata,
      })),
    });
    return { ok: true, result };
  });
}
