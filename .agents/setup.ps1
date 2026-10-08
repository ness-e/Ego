<#
.SYNOPSIS
  setup.ps1 — Script de inicialización y auto-detección del Agent Harness (.agents)
  Permite inicializar este harness en cualquier proyecto nuevo en un solo comando.
#>

param(
    [string]$ProjectName,
    [string]$Stack
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Inicializando Agent Harness Universal (.agents)         " -ForegroundColor Cyan
Write-Host "  Directorio del proyecto: $ProjectRoot                   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Comprobar Node.js
try {
    $nodeVer = & node --version
    Write-Host "✅ Node.js detectado: $nodeVer" -ForegroundColor Green
} catch {
    Write-Error "❌ Node.js no está instalado o no se encuentra en el PATH. Es requerido para el servidor MCP."
    exit 1
}

# 2. Instalar dependencias locales en .agents si no existen
$nodeModulesPath = Join-Path $ScriptDir "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "📦 Instalando dependencias del MCP (@modelcontextprotocol/sdk, zod)..." -ForegroundColor Yellow
    Push-Location $ScriptDir
    try {
        & npm install --no-audit --no-fund
        Write-Host "✅ Dependencias instaladas en .agents/node_modules" -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Host "✅ Dependencias de .agents ya presentes." -ForegroundColor Green
}

# 3. Auto-detección del Stack
$ConfigPath = Join-Path $ScriptDir "agents.config.json"
if (-not (Test-Path $ConfigPath)) {
    Write-Host "🔍 Detectando stack tecnológico del proyecto..." -ForegroundColor Yellow
    
    $detectedStack = "generic"
    $pkgManager = "npm"
    $testCmd = "npm test"
    $lintCmd = "npm run lint"
    $buildCmd = "npm run build"
    
    if (Test-Path (Join-Path $ProjectRoot "package.json")) {
        $detectedStack = "node-typescript"
        if (Test-Path (Join-Path $ProjectRoot "pnpm-lock.yaml")) { $pkgManager = "pnpm"; $testCmd = "pnpm test"; $lintCmd = "pnpm lint"; $buildCmd = "pnpm build" }
        elseif (Test-Path (Join-Path $ProjectRoot "bun.lockb") -or (Test-Path (Join-Path $ProjectRoot "bun.lock"))) { $pkgManager = "bun"; $testCmd = "bun test"; $lintCmd = "bun run lint"; $buildCmd = "bun run build" }
        elseif (Test-Path (Join-Path $ProjectRoot "yarn.lock")) { $pkgManager = "yarn"; $testCmd = "yarn test"; $lintCmd = "yarn lint"; $buildCmd = "yarn build" }
    } elseif (Test-Path (Join-Path $ProjectRoot "Cargo.toml")) {
        $detectedStack = "rust"
        $pkgManager = "cargo"
        $testCmd = "cargo test"
        $lintCmd = "cargo clippy"
        $buildCmd = "cargo build --release"
    } elseif ((Test-Path (Join-Path $ProjectRoot "pyproject.toml")) -or (Test-Path (Join-Path $ProjectRoot "requirements.txt"))) {
        $detectedStack = "python"
        $pkgManager = "uv"
        $testCmd = "pytest"
        $lintCmd = "ruff check"
        $buildCmd = "python -m build"
    } elseif (Test-Path (Join-Path $ProjectRoot "go.mod")) {
        $detectedStack = "go"
        $pkgManager = "go"
        $testCmd = "go test ./..."
        $lintCmd = "golangci-lint run"
        $buildCmd = "go build ./..."
    }

    $finalName = if ($ProjectName) { $ProjectName } else { (Split-Path -Leaf $ProjectRoot) }
    $finalStack = if ($Stack) { $Stack } else { $detectedStack }

    $newConfig = @{
        project = @{
            name = $finalName
            stack = $finalStack
            packageManager = $pkgManager
        }
        paths = @{
            baseOps = "docs/agent-ops"
            backlog = "docs/backlog.md"
            plans = "docs/agent-ops/plans"
            tasks = "docs/agent-ops/tasks"
            reviews = "docs/agent-ops/reviews"
            research = "docs/agent-ops/research"
            reports = "docs/agent-ops/reports"
            state = "docs/agent-ops/state"
            rules = ".agents/rules"
            references = ".agents/references"
            agents = ".agents/agents"
            skills = ".agents/skills"
            memory = ".agents/task-system/memory"
            history = ".agents/task-system/history"
        }
        commands = @{
            test = $testCmd
            lint = $lintCmd
            build = $buildCmd
        }
        budget = @{
            maxRoundsPerTask = 15
            maxDurationMinutes = 45
        }
    }

    $newConfig | ConvertTo-Json -Depth 5 | Set-Content -Path $ConfigPath -Encoding UTF8
    Write-Host "✅ agents.config.json generado automáticamente para $finalName ($finalStack)." -ForegroundColor Green
} else {
    Write-Host "✅ agents.config.json ya existe. Configuración respetada." -ForegroundColor Green
}

# 4. Asegurar carpetas base
@("docs/agent-ops/plans", "docs/agent-ops/tasks", "docs/agent-ops/reviews", "docs/agent-ops/research", "docs/agent-ops/reports", "docs/agent-ops/state") | ForEach-Object {
    $dir = Join-Path $ProjectRoot $_
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
}

Write-Host "`n🎉 Agent Harness inicializado con éxito!" -ForegroundColor Cyan
Write-Host "Para registrar el MCP en Antigravity (~/.gemini/config/mcp_config.json):" -ForegroundColor Yellow
Write-Host @"
{
  "mcpServers": {
    "agent-system": {
      "command": "node",
      "args": [
        "`$ProjectRoot\.agents\task-system\mcp\workflow-server.mjs"
      ]
    }
  }
}
"@ -ForegroundColor Gray
