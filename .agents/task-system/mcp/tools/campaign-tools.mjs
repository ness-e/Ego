// tools/campaign-tools.mjs — Dominio de Campañas y Ejecución Autónoma Unificada (.agents)
// Fusiona capacidades avanzadas de campañas (SDP v3, traits de modelo, salud y monitoreo) en agent-system.

import { z } from "zod"
import { discoverSkillsV3, detectType } from "../sdp-v3.mjs"
import { getHealth } from "../../traces/tracer.mjs"
import { getTraits, listModels, escalateTier } from "../../config/model-traits.mjs"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { resolve, join } from "node:path"

export function registerCampaignTools(server, { AGENTS_ROOT, PROJECT_ROOT, config }) {
  // 1. campaign_discover_skills (SDP v3: Skill Discovery Protocol)
  server.tool(
    "campaign_discover_skills",
    {
      phase: z.enum(["PLAN", "ACT", "VERIFY", "SHIP"]).optional().default("PLAN").describe("Fase del ciclo de vida"),
      taskType: z.string().optional().describe("Tipo de tarea (feature-add, bugfix, refactor, doc, etc.)"),
      taskTitle: z.string().optional().describe("Título de la tarea para auto-detección semántica"),
      keyFiles: z.array(z.string()).optional().default([]).describe("Archivos clave a tocar (blast radius)")
    },
    async ({ phase, taskType, taskTitle, keyFiles = [] }) => {
      try {
        const detected = taskType || (taskTitle ? detectType(taskTitle).type : "feature-add")
        const archivosClave = Array.isArray(keyFiles) ? keyFiles.join(", ") : (keyFiles || "")
        const sdpInput = {
          archivosClave,
          phase,
          taskType: detected,
          contractKeywords: taskTitle ? [taskTitle] : []
        }
        const sdpCtx = {
          projectRoot: PROJECT_ROOT,
          taskSystemDir: join(AGENTS_ROOT, "task-system")
        }
        const sdpResult = discoverSkillsV3(sdpInput, sdpCtx)
        const skillsList = sdpResult?.skills || []
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ phase, detectedType: detected, skillsCount: skillsList.length, skills: skillsList, metadata: sdpResult?.metadata }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error en discovery de skills: ${err.message}` }] }
      }
    }
  )

  // 2. campaign_model_traits
  server.tool(
    "campaign_model_traits",
    {
      model: z.string().optional().describe("ID de modelo a consultar o listar todos si se omite")
    },
    async ({ model }) => {
      try {
        if (!model) {
          return { content: [{ type: "text", text: JSON.stringify({ models: listModels() }, null, 2) }] }
        }
        const traits = getTraits(model)
        return { content: [{ type: "text", text: JSON.stringify({ model, traits }, null, 2) }] }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error consultando model traits: ${err.message}` }] }
      }
    }
  )

  // 3. campaign_health_status
  server.tool(
    "campaign_health_status",
    {},
    async () => {
      try {
        const health = getHealth ? getHealth() : { status: "healthy" }
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              server: "agent-system (unified)",
              status: "operational",
              health,
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error verificando salud: ${err.message}` }] }
      }
    }
  )

  // 4. campaign_stalled_tasks
  server.tool(
    "campaign_stalled_tasks",
    {
      maxRounds: z.number().optional().default(15).describe("Umbral de rondas para considerar una tarea estancada")
    },
    async ({ maxRounds }) => {
      try {
        const tasksDir = resolve(PROJECT_ROOT, config?.paths?.tasks || "docs/agent-ops/tasks")
        const stalled = []
        if (existsSync(tasksDir)) {
          const files = readdirSync(tasksDir).filter(f => f.endsWith(".md"))
          for (const f of files) {
            const content = readFileSync(join(tasksDir, f), "utf-8")
            if (/⏳|IN PROGRESS/i.test(content)) {
              stalled.push({ taskFile: f, status: "IN PROGRESS" })
            }
          }
        }
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ stalledCount: stalled.length, stalled }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error consultando stalled tasks: ${err.message}` }] }
      }
    }
  )
}
