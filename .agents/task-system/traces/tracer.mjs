import { mkdirSync, writeFileSync, existsSync, appendFileSync, readFileSync } from "node:fs"
import { resolve, join } from "node:path"

const TRACES_DIR = "task-system/traces"
const METRICS_FILE = "metrics.json"

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function getTracesDir(worktree) {
  const wt = worktree || process.cwd()
  if (existsSync(resolve(wt, "task-system", "traces"))) {
    return resolve(wt, "task-system", "traces")
  }
  if (existsSync(resolve(wt, "traces"))) {
    return resolve(wt, "traces")
  }
  if (existsSync(resolve(wt, "task-system"))) {
    return resolve(wt, "task-system", "traces")
  }
  return resolve(wt, "traces")
}

function logFile(campaignId, worktree) {
  const dir = getTracesDir(worktree)
  ensureDir(dir)
  return join(dir, `${campaignId}.jsonl`)
}

function metricsFile(worktree) {
  const dir = getTracesDir(worktree)
  ensureDir(dir)
  return join(dir, METRICS_FILE)
}

function loadMetrics(worktree) {
  const f = metricsFile(worktree)
  try {
    return JSON.parse(readFileSync(f, "utf-8"))
  } catch {
    return { tasks: { total: 0, completed: 0, failed: 0, stalled: 0 }, durations: [], byType: {} }
  }
}

function saveMetrics(m, worktree) {
  if (m.durations.length > 1000) m.durations = m.durations.slice(-1000)
  writeFileSync(metricsFile(worktree), JSON.stringify(m, null, 2), "utf-8")
}

function emit(campaignId, event, data = {}, worktree) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    campaignId,
    ...data,
  }
  const filePath = logFile(campaignId, worktree || process.cwd())
  try { appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf-8") } catch {}

  if (event === "task.completed" || event === "task.failed" || event === "task.stalled") {
    const wt = worktree || process.cwd()
    const m = loadMetrics(wt)
    m.tasks.total++
    if (event === "task.completed") m.tasks.completed++
    if (event === "task.failed") m.tasks.failed++
    if (event === "task.stalled") m.tasks.stalled++
    if (data.duration) m.durations.push(data.duration)
    if (data.taskType) {
      if (!m.byType[data.taskType]) m.byType[data.taskType] = { total: 0, completed: 0, failed: 0 }
      m.byType[data.taskType].total++
      if (event === "task.completed") m.byType[data.taskType].completed++
      if (event === "task.failed") m.byType[data.taskType].failed++
    }
    saveMetrics(m, wt)
  }

  return entry
}

function getHealth(worktree) {
  const m = loadMetrics(worktree || process.cwd())
  const errorRate = m.tasks.total > 0 ? (m.tasks.failed + m.tasks.stalled) / m.tasks.total : 0
  const durations = m.durations.sort((a, b) => a - b)
  const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0
  const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0
  const p99 = durations.length > 0 ? durations[Math.floor(durations.length * 0.99)] : 0
  return { metrics: m, errorRate: Math.round(errorRate * 10000) / 100, p50, p95, p99, healthy: errorRate < 0.05 }
}

export { emit, ensureDir, getHealth }
