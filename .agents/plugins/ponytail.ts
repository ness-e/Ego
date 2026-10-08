// Ponytail — OpenCode v2 plugin.
//
// V2 port of the v1 server plugin (ponytail.mjs). Injects the ponytail
// ruleset into every agent model request at the active intensity, persists
// `/ponytail` mode switches, and registers the ponytail slash commands plus
// the ponytail skills. The shared instruction builder and mode files stay in
// ~/.agents/ponytail (single source of truth); this file only adapts them to
// the v2 Plugin.define API.

// NOTE: no se importa "@opencode/plugin" a propósito — el loader v2 no lo
// resuelve desde plugins locales (ni .agents/node_modules ni global).
// El schema v2 solo exige un default export con `id` + `setup`, y
// `Plugin.define` es solo un helper de tipos. Objeto plano = cero deps.

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"

// PONYTAIL_BASE: env var primero (portable), luego ~/.agents/ponytail, luego legacy absoluto.
// No vendorizar: single source of truth fuera del repo.
const PONYTAIL_BASE =
  process.env.PONYTAIL_BASE ||
  path.join(os.homedir(), ".agents", "ponytail")

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getPonytailInstructions } = require(
  path.join(PONYTAIL_BASE, "hooks", "ponytail-instructions.js"),
)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultMode, normalizePersistedMode } = require(
  path.join(PONYTAIL_BASE, "hooks", "ponytail-config.js"),
)

function statePath(): string {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config")
  return path.join(base, "opencode", ".ponytail-active")
}

function readMode(): string {
  try {
    return (
      normalizePersistedMode(fs.readFileSync(statePath(), "utf8").trim()) ||
      getDefaultMode()
    )
  } catch {
    return getDefaultMode()
  }
}

function writeMode(mode: string): void {
  fs.mkdirSync(path.dirname(statePath()), { recursive: true })
  fs.writeFileSync(statePath(), mode)
}

interface ParsedCommand {
  description: string
  template: string
}

function parseCommandFile(filePath: string): ParsedCommand | null {
  let content: string
  try {
    content = fs.readFileSync(filePath, "utf8")
  } catch {
    return null
  }
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return null
  const description = match[1].match(/description:\s*(.+)/)?.[1]?.trim() ?? ""
  return { description, template: match[2].trim() }
}

interface SkillDef {
  id: string
  name: string
  description: string
  path: string
  location: string
  content: string
}

// Minimal frontmatter reader for `name:` + folded `description:`.
// Skips files it can't parse instead of failing plugin setup.
function parseSkillFile(filePath: string): SkillDef | null {
  let content: string
  try {
    content = fs.readFileSync(filePath, "utf8")
  } catch {
    return null
  }
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return null
  const head = match[1]
  const body = match[2]
  const name = head.match(/^name:\s*(.+)$/m)?.[1]?.trim()
  if (!name) return null
  let description = ""
  const descMatch = head.match(/^description:\s*([|>])?\s*(.*)$/m)
  if (descMatch) {
    if (descMatch[1]) {
      // Folded/literal block: collect following indented lines.
      const lines = head.split(/\r?\n/)
      const start = lines.findIndex((l) => /^description:/.test(l))
      const collected: string[] = []
      for (let i = start + 1; i < lines.length; i++) {
        if (/^\s+\S/.test(lines[i])) collected.push(lines[i].trim())
        else break
      }
      description =
        descMatch[1] === ">"
          ? collected.filter(Boolean).join(" ")
          : descMatch[1]
            ? [descMatch[2], ...collected].filter(Boolean).join("\n")
            : descMatch[2].trim()
    } else {
      description = descMatch[2].trim()
    }
  }
  return { id: name, name, description, path: filePath, location: path.dirname(filePath), content: body }
}

const PonytailPlugin = {
  id: "ponytail",
  async setup(ctx: any) {
    // --- Slash commands (read once at setup; reload on file change) ---
    const commandDir = path.join(PONYTAIL_BASE, ".agents", "command")
    const commands: ({ name: string } & ParsedCommand)[] = []
    try {
      for (const file of fs
        .readdirSync(commandDir)
        .filter((f) => f.endsWith(".md"))) {
        const parsed = parseCommandFile(path.join(commandDir, file))
        if (parsed) commands.push({ name: path.basename(file, ".md"), ...parsed })
      }
    } catch {
      // No command dir — plugin still provides the system-prompt injection.
    }

    await ctx.command.transform((editor) => {
      for (const c of commands) {
        const template = c.template
        const isModeSwitch = c.name === "ponytail"
        editor.add({
          name: c.name,
          description: c.description || undefined,
          execute: async ({ sessionID, prompt, delivery }) => {
            const raw = String(prompt.text ?? "")
            // Strip the "/command" invocation head; the rest are the arguments
            // (v1 substituted the same trailing text into $ARGUMENTS).
            const args = raw.replace(/^\s*\/\S+\s*/, "").trim()
            let text = template
            if (isModeSwitch) {
              // Persist `/ponytail <level>` (bare `/ponytail` = default mode,
              // same as v1); applies from this turn onward (the context hook
              // below reads the file every request).
              const candidate = args.split(/\s+/).filter(Boolean).pop() ?? ""
              const mode = normalizePersistedMode(candidate) || getDefaultMode()
              if (mode) {
                writeMode(mode)
                text = template.replace("$ARGUMENTS", candidate || mode)
              } else {
                text = template.replace("$ARGUMENTS", args)
              }
            }
            await ctx.session.prompt({ ...prompt, sessionID, text, delivery })
          },
        })
      }
    })

    // --- Skills (same set the v1 plugin exposed via config.skills.paths) ---
    const skillsRoot = path.join(PONYTAIL_BASE, "skills")
    const skills: SkillDef[] = []
    try {
      for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const parsed = parseSkillFile(
          path.join(skillsRoot, entry.name, "SKILL.md"),
        )
        if (parsed) skills.push(parsed)
      }
    } catch {
      // No skills dir — not fatal.
    }
    if (skills.length > 0) {
      await ctx.skill.transform((editor) => {
        for (const s of skills) editor.add(s)
      })
    }

    // --- System-prompt injection (v1: experimental.chat.system.transform) ---
    await ctx.session.hook("context", (event: any) => {
      const mode = readMode()
      if (mode === "off") return
      event.system.push({
        type: "text",
        text: getPonytailInstructions(mode),
      })
    })
  },
}

export default PonytailPlugin
