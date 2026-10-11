import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { ChangeSetService, FileDiff } from "@ego/tools";

export interface ConfigMutationPlan {
  id: string;
  targetPath: string;
  originalContent: string;
  newContent: string;
  diff: FileDiff;
  fingerprintOriginal: string;
  fingerprintNew: string;
  backupPath?: string;
  confirmedBy?: string;
  createdAt: number;
  status: "previewed" | "confirmed" | "applied" | "rolled_back" | "failed";
}

/**
 * Pipeline de Mutación Segura de Configuración (Patrón Coucou COUC-10 / SafeConfigMutation).
 * Ejecuta el protocolo estricto de 12 pasos para alterar archivos de configuración
 * sin riesgo de corrupción, pérdida de datos de terceros ni colisiones concurrentes.
 */
export class SafeConfigMutationService {
  private readonly plans = new Map<string, ConfigMutationPlan>();

  /**
   * Paso 1 al 7: Lee, valida, transforma, calcula diff, fingerprint y genera preview.
   */
  public async preview(
    targetPath: string,
    transformOrNewContent: string | ((current: string) => string | Promise<string>)
  ): Promise<ConfigMutationPlan> {
    const resolvedPath = path.resolve(targetPath);
    let originalContent = "";
    let exists = false;

    try {
      originalContent = await fs.readFile(resolvedPath, "utf8");
      exists = true;
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        throw new Error(`[SafeConfigMutation] Error leyendo archivo de destino: ${err.message}`);
      }
      originalContent = "";
      exists = false;
    }

    // Validación de formato previo si es JSON
    if (exists && resolvedPath.endsWith(".json") && originalContent.trim().length > 0) {
      try {
        JSON.parse(originalContent);
      } catch (err: any) {
        throw new Error(
          `[SafeConfigMutation] El archivo original contiene JSON corrupto o malformado: ${err.message}`
        );
      }
    }

    // Cómputo del nuevo estado
    const newContent =
      typeof transformOrNewContent === "function"
        ? await transformOrNewContent(originalContent)
        : transformOrNewContent;

    // Validación de formato del nuevo contenido si es JSON
    if (resolvedPath.endsWith(".json") && newContent.trim().length > 0) {
      try {
        JSON.parse(newContent);
      } catch (err: any) {
        throw new Error(
          `[SafeConfigMutation] La mutación propuesta genera un JSON inválido: ${err.message}`
        );
      }
    }

    // Cómputo del Diff y de los Fingerprints SHA-256
    const diff = exists
      ? ChangeSetService.fromEdit(originalContent, newContent, resolvedPath)
      : ChangeSetService.fromNew(newContent, resolvedPath);

    const fingerprintOriginal = this.calculateFingerprint(originalContent);
    const fingerprintNew = this.calculateFingerprint(newContent);

    const id = `plan_${Date.now()}_${randomBytes(4).toString("hex")}`;
    const plan: ConfigMutationPlan = {
      id,
      targetPath: resolvedPath,
      originalContent,
      newContent,
      diff,
      fingerprintOriginal,
      fingerprintNew,
      createdAt: Date.now(),
      status: "previewed",
    };

    this.plans.set(id, plan);
    return plan;
  }

  /**
   * Paso 8: Confirmación humana o de política aprobada.
   */
  public confirm(planId: string, approver: string = "user"): boolean {
    const plan = this.plans.get(planId);
    if (!plan) return false;
    if (plan.status !== "previewed") return false;

    plan.status = "confirmed";
    plan.confirmedBy = approver;
    return true;
  }

  /**
   * Paso 9 y 10: Vuelve a comprobar fingerprint, crea backup y escribe atómicamente.
   */
  public async apply(
    planId: string,
    options: { requireConfirmation?: boolean } = {}
  ): Promise<{ success: boolean; backupPath?: string }> {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`[SafeConfigMutation] Plan con ID '${planId}' no encontrado.`);
    }

    const requireConfirmation = options.requireConfirmation ?? true;
    if (requireConfirmation && plan.status !== "confirmed") {
      throw new Error(
        `[SafeConfigMutation] El plan '${planId}' no ha sido confirmado antes de su aplicación.`
      );
    }

    // 9. Comprobación de fingerprint contra disco (anti-race condition)
    let currentOnDisk = "";
    try {
      currentOnDisk = await fs.readFile(plan.targetPath, "utf8");
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
      currentOnDisk = "";
    }

    const currentFingerprint = this.calculateFingerprint(currentOnDisk);
    if (currentFingerprint !== plan.fingerprintOriginal) {
      plan.status = "failed";
      throw new Error(
        `[SafeConfigMutation] Conflicto de mutación concurrente: el archivo en disco fue modificado después de generar el preview.`
      );
    }

    // 10. Creación de backup previo seguro
    const parentDir = path.dirname(plan.targetPath);
    await fs.mkdir(parentDir, { recursive: true });

    let backupPath: string | undefined;
    if (currentOnDisk.length > 0) {
      backupPath = `${plan.targetPath}.ego_bak.${Date.now()}`;
      await fs.writeFile(backupPath, currentOnDisk, "utf8");
      plan.backupPath = backupPath;
    }

    // Escritura atómica vía archivo temporal + rename
    const tmpPath = path.join(
      parentDir,
      `.tmp_${path.basename(plan.targetPath)}_${randomBytes(6).toString("hex")}`
    );

    try {
      await fs.writeFile(tmpPath, plan.newContent, "utf8");
      await fs.rename(tmpPath, plan.targetPath);
      plan.status = "applied";
      return { success: true, backupPath };
    } catch (err: any) {
      // Limpieza de temporal ante fallo
      try {
        await fs.unlink(tmpPath);
      } catch {
        // Ignorar si el temporal no se llegó a crear
      }
      plan.status = "failed";
      throw new Error(`[SafeConfigMutation] Falló la escritura atómica: ${err.message}`);
    }
  }

  /**
   * Paso 12: Rollback garantizado restaurando el backup previo.
   */
  public async rollback(planId: string): Promise<boolean> {
    const plan = this.plans.get(planId);
    if (!plan || plan.status !== "applied") {
      return false;
    }

    if (!plan.backupPath) {
      // Si no había archivo original (era nuevo), el rollback consiste en eliminar el archivo creado
      try {
        await fs.unlink(plan.targetPath);
        plan.status = "rolled_back";
        return true;
      } catch {
        return false;
      }
    }

    try {
      const backupContent = await fs.readFile(plan.backupPath, "utf8");
      const parentDir = path.dirname(plan.targetPath);
      const tmpPath = path.join(
        parentDir,
        `.tmp_rb_${path.basename(plan.targetPath)}_${randomBytes(6).toString("hex")}`
      );

      await fs.writeFile(tmpPath, backupContent, "utf8");
      await fs.rename(tmpPath, plan.targetPath);
      plan.status = "rolled_back";
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Paso 11 y 12: Remueve únicamente claves que pertenecen a Ego, preservando
   * las propiedades de terceros en configuraciones compartidas.
   */
  public async removeOwnedEntries(
    targetPath: string,
    ownedKeys: string[]
  ): Promise<ConfigMutationPlan> {
    return this.preview(targetPath, (current) => {
      if (!current.trim()) return current;
      try {
        const parsed = JSON.parse(current);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          return current;
        }

        const modified = { ...parsed };
        for (const key of ownedKeys) {
          delete modified[key];
        }

        return JSON.stringify(modified, null, 2);
      } catch {
        return current;
      }
    });
  }

  public getPlan(planId: string): ConfigMutationPlan | undefined {
    return this.plans.get(planId);
  }

  public clearPlans(): void {
    this.plans.clear();
  }

  private calculateFingerprint(content: string): string {
    return createHash("sha256").update(content, "utf8").digest("hex");
  }
}
