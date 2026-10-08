#!/usr/bin/env node
// workflow-server.mjs — Servidor MCP Universal y Desacoplado (.agents)
// Agnóstico de proyecto: Lee agents.config.json y resuelve dinámicamente el workspace.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { fileURLToPath } from "node:url"
import { dirname, resolve, join } from "node:path"
import { existsSync, readFileSync } from "node:fs"

import { registerWorkflowTools } from "./tools/workflow-tools.mjs"
import { registerTaskTools } from "./tools/task-tools.mjs"
import { registerCatalogTools } from "./tools/catalog-tools.mjs"
import { registerMemoryTools } from "./tools/memory-tools.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Resolución dinámica del Workspace Root y Agents Root
const PROJECT_ROOT = process.env.MCP_WORKSPACE_ROOT || resolve(__dirname, "..", "..", "..")
const AGENTS_ROOT = resolve(__dirname, "..", "..")

// Carga dinámica de agents.config.json con fallback defensivo
let config = {
  project: { name: "generic-project", stack: "auto", packageManager: "npm" },
  paths: {
    baseOps: "docs/agent-ops",
    backlog: "docs/backlog.md",
    plans: "docs/agent-ops/plans",
    tasks: "docs/agent-ops/tasks",
    reviews: "docs/agent-ops/reviews",
    research: "docs/agent-ops/research",
    reports: "docs/agent-ops/reports",
    state: "docs/agent-ops/state"
  },
  commands: {
    test: "npm test",
    lint: "npm run lint",
    build: "npm run build"
  },
  budget: { maxRoundsPerTask: 15, maxDurationMinutes: 45 }
}

const configPath = join(AGENTS_ROOT, "agents.config.json")
if (existsSync(configPath)) {
  try {
    config = JSON.parse(readFileSync(configPath, "utf-8"))
  } catch (err) {
    console.error(`[workflow-server] Advertencia: Error parseando agents.config.json: ${err.message}`)
  }
}

// Inicializar Servidor MCP Agnóstico
const server = new McpServer({
  name: "agent-system",
  version: "2.0.0"
})

// Registrar los 4 dominios con contexto universal
const context = { AGENTS_ROOT, PROJECT_ROOT, config }
registerWorkflowTools(server, context)
registerTaskTools(server, context)
registerCatalogTools(server, context)
registerMemoryTools(server, context)

// Conectar transporte Stdio
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`[workflow-server] Servidor MCP inicializado con éxito. Proyecto: ${config.project?.name || "Agnóstico"}. Root: ${PROJECT_ROOT}`)
}

process.on("uncaughtException", (err) => {
  console.error(`[workflow-server] Excepción no capturada: ${err.message}`, err.stack)
})

process.on("unhandledRejection", (reason) => {
  console.error(`[workflow-server] Rechazo de promesa no manejado:`, reason)
})

process.on("SIGINT", () => {
  console.error("[workflow-server] Señal SIGINT recibida, cerrando...")
  process.exit(0)
})

process.on("SIGTERM", () => {
  console.error("[workflow-server] Señal SIGTERM recibida, cerrando...")
  process.exit(0)
})

main().catch((err) => {
  console.error(`[workflow-server] Error fatal en inicialización: ${err.message}`)
  process.exit(1)
})
