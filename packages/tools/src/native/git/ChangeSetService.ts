/**
 * Tipos canónicos para el Servicio de ChangeSets y Diffs.
 * Extraído y adaptado de Coucou COUC-07 (DiffEngine / ChangeSetService).
 */

export type DiffLineKind = "context" | "added" | "removed";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  origLine: number; // 1-based, -1 para líneas puramente agregadas
  newLine: number;  // 1-based, -1 para líneas puramente removidas
}

export interface DiffHunk {
  origStart: number;
  newStart: number;
  lines: DiffLine[];
}

export interface FileDiff {
  id: string;
  path: string;
  name: string;
  added: number;
  removed: number;
  hunks: DiffHunk[];
  tooLarge: boolean;
  isNewFile: boolean;
}

export interface ChangeSet {
  id: string;
  timestamp: number;
  summary: string;
  files: FileDiff[];
  totalAdded: number;
  totalRemoved: number;
  tooLarge: boolean;
}

/**
 * ChangeSetService - Motor de diff in-memory defensivo con cotas de seguridad.
 * Protege contra explosión cuadrática O(N*M) y desbordamientos de memoria.
 */
export class ChangeSetService {
  public static readonly MAX_BYTES = 200 * 1024; // 200 KB
  public static readonly MAX_LINES = 4000;
  public static readonly MAX_LCS_PRODUCT = 1_000_000; // Cota O(N*M) defensiva

  /**
   * Genera un FileDiff comparando el contenido anterior (old) y el nuevo (new).
   */
  public static fromEdit(oldContent: string, newContent: string, filePath: string, contextLines: number = 3): FileDiff {
    const name = this.extractFileName(filePath);
    const id = `diff_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // 1. Cota de tamaño en bytes
    const totalBytes = Buffer.byteLength(oldContent, "utf8") + Buffer.byteLength(newContent, "utf8");
    if (totalBytes > this.MAX_BYTES) {
      return this.countFallback(oldContent, newContent, filePath, name, id, true, false);
    }

    const oldLines = this.splitLines(oldContent);
    const newLines = this.splitLines(newContent);

    // 2. Cota de cantidad de líneas
    if (oldLines.length + newLines.length > this.MAX_LINES) {
      return this.countFallback(oldContent, newContent, filePath, name, id, true, false);
    }

    // 3. Cota contra coste cuadrático LCS O(m*n)
    if (oldLines.length * newLines.length > this.MAX_LCS_PRODUCT) {
      return this.countFallback(oldContent, newContent, filePath, name, id, true, false);
    }

    // 4. Cálculo LCS determinista
    const flatLines = this.buildDiffLines(oldLines, newLines);
    const hunks = this.buildHunks(flatLines, contextLines);
    const added = flatLines.filter((l) => l.kind === "added").length;
    const removed = flatLines.filter((l) => l.kind === "removed").length;

    return {
      id,
      path: filePath,
      name,
      added,
      removed,
      hunks,
      tooLarge: false,
      isNewFile: false,
    };
  }

  /**
   * Genera un FileDiff para un archivo completamente nuevo.
   */
  public static fromNew(content: string, filePath: string): FileDiff {
    const name = this.extractFileName(filePath);
    const id = `diff_new_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    if (Buffer.byteLength(content, "utf8") > this.MAX_BYTES) {
      const lineCount = content.split("\n").length;
      return {
        id,
        path: filePath,
        name,
        added: lineCount,
        removed: 0,
        hunks: [],
        tooLarge: true,
        isNewFile: true,
      };
    }

    const lines = this.splitLines(content);
    if (lines.length > this.MAX_LINES) {
      return {
        id,
        path: filePath,
        name,
        added: lines.length,
        removed: 0,
        hunks: [],
        tooLarge: true,
        isNewFile: true,
      };
    }

    const diffLines: DiffLine[] = lines.map((text, idx) => ({
      kind: "added",
      text,
      origLine: -1,
      newLine: idx + 1,
    }));

    const hunks: DiffHunk[] = diffLines.length > 0 ? [{ origStart: 0, newStart: 1, lines: diffLines }] : [];

    return {
      id,
      path: filePath,
      name,
      added: diffLines.length,
      removed: 0,
      hunks,
      tooLarge: false,
      isNewFile: true,
    };
  }

  /**
   * Crea un ChangeSet agrupando múltiples diffs de archivos.
   */
  public static createChangeSet(files: FileDiff[], summary?: string): ChangeSet {
    const totalAdded = files.reduce((acc, f) => acc + f.added, 0);
    const totalRemoved = files.reduce((acc, f) => acc + f.removed, 0);
    const tooLarge = files.some((f) => f.tooLarge);
    const computedSummary = summary ?? `${files.length} files changed (+${totalAdded}, -${totalRemoved})`;

    return {
      id: `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      summary: computedSummary,
      files,
      totalAdded,
      totalRemoved,
      tooLarge,
    };
  }

  /**
   * Convierte texto markdown multilinea a un resumen de una sola línea plano.
   * Útil para chips de actividad en UI y resúmenes de commits.
   */
  public static toOneLine(text: string, maxChars: number = 200): string {
    if (!text || !text.trim()) return "";
    const lines = text.split(/\r?\n/);
    const firstParagraphLines: string[] = [];

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      const isHR =
        trimmed.length >= 3 &&
        (/^-+$/.test(trimmed) || /^\*+$/.test(trimmed) || /^_+$/.test(trimmed));
      const isSeparator = trimmed === "" || isHR || trimmed.startsWith("|");

      if (isSeparator) {
        if (firstParagraphLines.length > 0) break;
      } else {
        firstParagraphLines.push(trimmed);
      }
    }

    let joined = firstParagraphLines.join(" ");
    // Limpieza de marcadores markdown
    joined = joined
      .replace(/[*_~`]/g, "")
      .replace(/^#+\s*/, "")
      .replace(/^[-*+]\s+/, "")
      .replace(/\s+/g, " ")
      .trim();

    if (joined.length > maxChars) {
      return joined.slice(0, maxChars - 3) + "...";
    }
    return joined;
  }

  private static splitLines(text: string): string[] {
    const normalized = text.replace(/\r\n/g, "\n");
    const parts = normalized.split("\n");
    if (parts.length > 0 && parts[parts.length - 1] === "") {
      parts.pop();
    }
    return parts;
  }

  private static buildDiffLines(oldLines: string[], newLines: string[]): DiffLine[] {
    const m = oldLines.length;
    const n = newLines.length;

    // Matriz DP de LCS
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack para obtener emparejamientos
    const matches: [number, number][] = [];
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        matches.push([i - 1, j - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }
    matches.reverse();

    const result: DiffLine[] = [];
    let prevOld = -1;
    let prevNew = -1;

    for (const [oi, ni] of matches) {
      // Líneas eliminadas entre el match previo y este old match
      for (let k = prevOld + 1; k < oi; k++) {
        result.push({ kind: "removed", text: oldLines[k], origLine: k + 1, newLine: -1 });
      }
      // Líneas agregadas entre el match previo y este new match
      for (let k = prevNew + 1; k < ni; k++) {
        result.push({ kind: "added", text: newLines[k], origLine: -1, newLine: k + 1 });
      }
      // Línea de contexto común
      result.push({ kind: "context", text: oldLines[oi], origLine: oi + 1, newLine: ni + 1 });
      prevOld = oi;
      prevNew = ni;
    }

    // Líneas eliminadas restantes
    for (let k = prevOld + 1; k < m; k++) {
      result.push({ kind: "removed", text: oldLines[k], origLine: k + 1, newLine: -1 });
    }
    // Líneas agregadas restantes
    for (let k = prevNew + 1; k < n; k++) {
      result.push({ kind: "added", text: newLines[k], origLine: -1, newLine: k + 1 });
    }

    return result;
  }

  private static buildHunks(lines: DiffLine[], context: number): DiffHunk[] {
    if (lines.length === 0) return [];

    const changedIndices: number[] = [];
    for (let idx = 0; idx < lines.length; idx++) {
      if (lines[idx].kind !== "context") {
        changedIndices.push(idx);
      }
    }
    if (changedIndices.length === 0) return [];

    const ranges: [number, number][] = changedIndices.map((ci) => [
      Math.max(0, ci - context),
      Math.min(lines.length - 1, ci + context),
    ]);

    const merged: [number, number][] = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1] + 1) {
        last[1] = Math.max(last[1], r[1]);
      } else {
        merged.push([...r]);
      }
    }

    const hunks: DiffHunk[] = [];
    for (const [start, end] of merged) {
      const hunkLines = lines.slice(start, end + 1);
      const origStart = hunkLines.find((l) => l.origLine > 0)?.origLine ?? 1;
      const newStart = hunkLines.find((l) => l.newLine > 0)?.newLine ?? 1;
      hunks.push({ origStart, newStart, lines: hunkLines });
    }
    return hunks;
  }

  private static countFallback(
    oldContent: string,
    newContent: string,
    filePath: string,
    name: string,
    id: string,
    tooLarge: boolean,
    isNewFile: boolean
  ): FileDiff {
    const oldLines = oldContent.split(/\r?\n/);
    const newLines = newContent.split(/\r?\n/);
    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);

    const added = newLines.filter((l) => l.length > 0 && !oldSet.has(l)).length;
    const removed = oldLines.filter((l) => l.length > 0 && !newSet.has(l)).length;

    return {
      id,
      path: filePath,
      name,
      added,
      removed,
      hunks: [],
      tooLarge,
      isNewFile,
    };
  }

  private static extractFileName(filePath: string): string {
    const parts = filePath.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || filePath;
  }
}
