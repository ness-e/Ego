// smoke-mcp-sdp.mjs — smoke E2E del campaign MCP (post SDP v3):
// spawn del server + initialize + tools/call v2 (sdpVersion "v3") + tools/call v1 (regresión H-01).
// Uso: bun .agents/task-system/scripts/smoke-mcp-sdp.mjs
import { spawn } from "node:child_process"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..", "..", "..")
const SERVER = join(ROOT, ".agents", "task-system", "mcp", "campaign-server.mjs")

const child = spawn(process.execPath, [SERVER], { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] })
let buf = ""
const responses = []
let stderrTail = ""

child.stdout.on("data", d => {
  buf += d.toString()
  let idx
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim()
    buf = buf.slice(idx + 1)
    if (!line) continue
    try { responses.push(JSON.parse(line)) } catch { /* non-JSON line */ }
  }
})
child.stderr.on("data", d => { stderrTail = (stderrTail + d.toString()).slice(-800) })

function send(obj) { child.stdin.write(JSON.stringify(obj) + "\n") }
function waitFor(id, ms = 12000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now()
    const iv = setInterval(() => {
      const r = responses.find(x => x.id === id)
      if (r) { clearInterval(iv); resolve(r) }
      else if (Date.now() - t0 > ms) { clearInterval(iv); reject(new Error("timeout esperando respuesta " + id)) }
    }, 100)
  })
}

try {
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke-sdp", version: "0.1" } } })
  await waitFor(1)
  send({ jsonrpc: "2.0", method: "notifications/initialized" })

  // v2 → sdpVersion v3
  send({
    jsonrpc: "2.0", id: 2, method: "tools/call",
    params: {
      name: "campaign_discover_skills_v2",
      arguments: { archivosClave: ".github/workflows/ci-rust.yml, dev-tools/verify.ps1", phase: "BUILD", contractKeywords: ["gates", "coverage"], taskId: "HARD-02", maxSkills: 8 },
    },
  })
  const r2 = await waitFor(2)
  if (r2.error || r2.result?.isError) throw new Error("v2 error: " + JSON.stringify(r2.error || r2.result).slice(0, 300))
  const d2 = JSON.parse(r2.result?.content?.[0]?.text || "")
  if (d2.sdpVersion !== "v3" || !d2.skills?.length || !d2.pinned?.length) throw new Error("v2 output inesperado: " + JSON.stringify(d2).slice(0, 300))

  // v1 → regresión H-01 (firma de grepSkillsManifest)
  send({
    jsonrpc: "2.0", id: 3, method: "tools/call",
    params: { name: "campaign_discover_skills", arguments: { archivosClave: ".github/workflows/ci-rust.yml", phase: "BUILD", contractKeywords: ["gates"], maxSkills: 6 } },
  })
  const r3 = await waitFor(3)
  if (r3.error || r3.result?.isError) throw new Error("v1 error: " + JSON.stringify(r3.error || r3.result).slice(0, 300))
  const d3 = JSON.parse(r3.result?.content?.[0]?.text || "")
  if (!Array.isArray(d3.skills) || !d3.skills.length) throw new Error("v1 sin skills")

  console.log(`SMOKE OK — v3: sdpVersion=${d2.sdpVersion} · skills=${d2.skills.length} · pinned=${d2.pinned.map(p => p.skill).join(",")} · minScore=${d2.minScore} | v1: skills=${d3.skills.length} OK`)
  child.kill()
  process.exit(0)
} catch (e) {
  console.error("SMOKE FAIL —", e.message)
  if (stderrTail) console.error("stderr:", stderrTail)
  child.kill()
  process.exit(1)
}
