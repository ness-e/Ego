// catalog-tools.mjs — Herramientas de catálogo de artefactos (.agents/rules, references, agents, skills)
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"

export function registerCatalogTools(server, { AGENTS_ROOT, PROJECT_ROOT }) {
  const RULES_DIR = join(AGENTS_ROOT, "rules")
  const REFS_DIR = join(AGENTS_ROOT, "references")
  const AGENTS_DIR = join(AGENTS_ROOT, "agents")
  const SKILLS_DIR = join(AGENTS_ROOT, "skills")

  // 1. catalog_list_rules
  server.tool(
    "catalog_list_rules",
    {},
    async () => {
      try {
        if (!existsSync(RULES_DIR)) {
          return { content: [{ type: "text", text: "No rules directory found in .agents/rules" }] }
        }
        const files = readdirSync(RULES_DIR)
          .filter(f => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
          .map(f => {
            const fullPath = join(RULES_DIR, f)
            const stat = statSync(fullPath)
            const content = readFileSync(fullPath, "utf-8")
            const firstLine = content.split("\n").find(l => l.startsWith("# ") || l.startsWith("> ")) || ""
            return {
              rule: f.replace(/\.md$/, ""),
              file: f,
              title: firstLine.replace(/^[#> ]+/, "").trim(),
              sizeBytes: stat.size
            }
          })
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ count: files.length, rules: files }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error listing rules: ${err.message}` }] }
      }
    }
  )

  // 2. catalog_get_rule
  server.tool(
    "catalog_get_rule",
    {
      ruleName: z.string().describe("Nombre de la regla (ej: electron-ipc, api-contract, gobernanza-desktop, memory-budget)")
    },
    async ({ ruleName }) => {
      try {
        const cleanName = ruleName.endsWith(".md") ? ruleName : `${ruleName}.md`
        const target = join(RULES_DIR, cleanName)
        if (!existsSync(target)) {
          return { isError: true, content: [{ type: "text", text: `Regla no encontrada: ${cleanName}. Use catalog_list_rules para ver las disponibles.` }] }
        }
        const content = readFileSync(target, "utf-8")
        return { content: [{ type: "text", text: content }] }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error reading rule: ${err.message}` }] }
      }
    }
  )

  // 3. catalog_list_references
  server.tool(
    "catalog_list_references",
    {},
    async () => {
      try {
        if (!existsSync(REFS_DIR)) {
          return { content: [{ type: "text", text: "No references directory found in .agents/references" }] }
        }
        const files = readdirSync(REFS_DIR)
          .filter(f => f.endsWith(".md"))
          .map(f => {
            const fullPath = join(REFS_DIR, f)
            const stat = statSync(fullPath)
            return {
              reference: f.replace(/\.md$/, ""),
              file: f,
              sizeBytes: stat.size
            }
          })
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ count: files.length, references: files }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error listing references: ${err.message}` }] }
      }
    }
  )

  // 4. catalog_get_reference
  server.tool(
    "catalog_get_reference",
    {
      referenceName: z.string().optional().describe("Nombre de la referencia (ej: definition-of-done, backlog-format, dev-tools)"),
      refName: z.string().optional().describe("Alias corto de referenceName")
    },
    async ({ referenceName, refName }) => {
      try {
        const rawName = referenceName || refName
        if (!rawName) {
          return { isError: true, content: [{ type: "text", text: "Debe proporcionar 'referenceName' (o 'refName')." }] }
        }
        const cleanName = rawName.endsWith(".md") ? rawName : `${rawName}.md`
        const target = join(REFS_DIR, cleanName)
        if (!existsSync(target)) {
          return { isError: true, content: [{ type: "text", text: `Referencia no encontrada: ${cleanName}. Use catalog_list_references para ver las disponibles.` }] }
        }
        const content = readFileSync(target, "utf-8")
        return { content: [{ type: "text", text: content }] }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error reading reference: ${err.message}` }] }
      }
    }
  )

  // 5. catalog_list_agents
  server.tool(
    "catalog_list_agents",
    {},
    async () => {
      try {
        if (!existsSync(AGENTS_DIR)) {
          return { content: [{ type: "text", text: "No agents directory found in .agents/agents" }] }
        }
        const files = readdirSync(AGENTS_DIR)
          .filter(f => f.endsWith(".md"))
          .map(f => {
            const fullPath = join(AGENTS_DIR, f)
            const content = readFileSync(fullPath, "utf-8")
            const descMatch = content.match(/description:\s*>?-?\s*([^\n\r]+)/)
            let description = "Sub-Ego role"
            if (descMatch) {
              description = descMatch[1].trim()
            } else {
              const bodyWithoutTitle = content.replace(/^#\s+[^\n]+\n+/, "").trim()
              const firstPara = bodyWithoutTitle.split(/\n\s*\n/)[0]?.replace(/\n/g, " ").trim()
              if (firstPara) {
                description = firstPara.slice(0, 160) + (firstPara.length > 160 ? "..." : "")
              }
            }
            return {
              role: f.replace(/\.md$/, ""),
              file: f,
              description
            }
          })
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ count: files.length, agents: files }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error listing agents: ${err.message}` }] }
      }
    }
  )

  // 6. catalog_get_agent (con resolución preferente a ego-*)
  server.tool(
    "catalog_get_agent",
    {
      agentRole: z.string().describe("Nombre del subagente (ej: lead, coder, reviewer, researcher, documenter, harness o ego-*)")
    },
    async ({ agentRole }) => {
      try {
        const cleanName = agentRole.endsWith(".md") ? agentRole : `${agentRole}.md`

        // Mapeo preferencial: si piden un rol genérico (ej: lead, coder, reviewer),
        // preferir siempre la especialización canónica de Ego si existe.
        const preferEgoMap = {
          "lead.md": "ego-lead.md",
          "coder.md": "ego-desktop.md",
          "desktop.md": "ego-desktop.md",
          "reviewer.md": "ego-review.md",
          "researcher.md": "ego-research.md",
          "documenter.md": "ego-docs.md",
          "harness.md": "ego-harness.md"
        }

        let target = null
        if (preferEgoMap[cleanName] && existsSync(join(AGENTS_DIR, preferEgoMap[cleanName]))) {
          target = join(AGENTS_DIR, preferEgoMap[cleanName])
        } else if (existsSync(join(AGENTS_DIR, cleanName))) {
          target = join(AGENTS_DIR, cleanName)
        } else {
          const fallbackMap = {
            "ego-lead.md": "lead.md",
            "ego-desktop.md": "coder.md",
            "ego-review.md": "reviewer.md",
            "ego-research.md": "researcher.md",
            "ego-docs.md": "documenter.md",
            "ego-harness.md": "harness.md"
          }
          if (fallbackMap[cleanName] && existsSync(join(AGENTS_DIR, fallbackMap[cleanName]))) {
            target = join(AGENTS_DIR, fallbackMap[cleanName])
          }
        }

        if (!target || !existsSync(target)) {
          return { isError: true, content: [{ type: "text", text: `Subagente no encontrado: ${cleanName}. Use catalog_list_agents para ver los disponibles.` }] }
        }
        const content = readFileSync(target, "utf-8")
        return { content: [{ type: "text", text: content }] }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error reading agent: ${err.message}` }] }
      }
    }
  )

  // 7. catalog_list_skills
  server.tool(
    "catalog_list_skills",
    {
      filter: z.string().optional().describe("Filtro opcional por texto en el nombre de la skill")
    },
    async ({ filter }) => {
      try {
        if (!existsSync(SKILLS_DIR)) {
          return { content: [{ type: "text", text: "No skills directory found in .agents/skills" }] }
        }
        let skills = readdirSync(SKILLS_DIR, { withFileTypes: true })
          .filter(d => d.isDirectory() && existsSync(join(SKILLS_DIR, d.name, "SKILL.md")))
          .map(d => d.name)

        if (filter) {
          const lower = filter.toLowerCase()
          skills = skills.filter(s => s.toLowerCase().includes(lower))
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ count: skills.length, skills }, null, 2)
          }]
        }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error listing skills: ${err.message}` }] }
      }
    }
  )

  // 8. catalog_get_skill
  server.tool(
    "catalog_get_skill",
    {
      skillName: z.string().describe("Nombre de la skill (ej: systematic-debugging, campaign-executor, shadcn-ui, context7)")
    },
    async ({ skillName }) => {
      try {
        const skillPath = join(SKILLS_DIR, skillName, "SKILL.md")
        if (!existsSync(skillPath)) {
          return { isError: true, content: [{ type: "text", text: `Skill no encontrada: ${skillName}. Verifique con catalog_list_skills.` }] }
        }
        const content = readFileSync(skillPath, "utf-8")
        return { content: [{ type: "text", text: content }] }
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Error reading skill: ${err.message}` }] }
      }
    }
  )
}
