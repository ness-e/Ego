# check-agents-refs.ps1 — anti-drift de referencias en AGENTS.md
#
# Extrae las rutas citadas entre backticks de AGENTS.md (raíz) y .agents/AGENTS.md
# y valida que existan en el repo. Reporta las que faltan y sale con exit 1 si hay stale.
#
# Filtro anti-falsos-positivos (solo valida rutas relativas que parecen archivos del repo):
#   - descarta whitespace (comandos/prosa), URLs (://), ~ (externo), / inicial (absoluto),
#     placeholders/globs ([<>*?#]), tokens sin separador de ruta, leaves placeholder (X.md)
#   - valida SOLO rutas con extensión de archivo (evita marcar directorios/comandos)
#
# Uso: pwsh -NoProfile dev-tools/check-agents-refs.ps1

$ErrorActionPreference = "Stop"

# Resolución dinámica de la raíz del proyecto
$ProjectRoot = $PSScriptRoot
while ($ProjectRoot -and -not (Test-Path "$ProjectRoot\AGENTS.md") -and -not (Test-Path "$ProjectRoot\.git")) {
    $parent = Split-Path -Parent $ProjectRoot
    if ($parent -eq $ProjectRoot) { break }
    $ProjectRoot = $parent
}

$files = @("$ProjectRoot\AGENTS.md")
$stale = [System.Collections.Generic.List[string]]::new()
$checked = 0

foreach ($f in $files) {
    if (-not (Test-Path -LiteralPath $f)) { continue }
    $rawContent = Get-Content -LiteralPath $f -Raw
    # Eliminar bloques de código cercados con triple backtick
    $content = [regex]::Replace($rawContent, '(?s)```.*?```', '')

    foreach ($m in [regex]::Matches($content, '`([^`\r\n]+)`')) {
        $tok = $m.Groups[1].Value.Trim()
        $p = $tok -replace ':\d+.*$', ''   # quita "archivo:linea"
        $p = $p.TrimEnd('/', '\')
        $p = $p -replace '^["'']|["'']$', '' # quita comillas externas

        if ($p -match '\s')          { continue }  # comando o prosa
        if ($p -match '^[a-z]+://')  { continue }  # URL
        if ($p -match '^~')          { continue }  # ruta externa (~/.config/...)
        if ($p -match '^/')          { continue }  # absoluta (/pipeline)
        if ($p -match '[<>*?#|":]')  { continue }  # caracteres inválidos o glob
        if ($p -notmatch '[/\\]')    { continue }  # no es ruta con separador
        $leaf = Split-Path -Leaf $p
        if ($leaf -cmatch '^[A-Z]\.[A-Za-z0-9]+$') { continue }  # placeholder X.md (case-sensitive)
        
        $ext = ""
        try { $ext = [System.IO.Path]::GetExtension($p) } catch { continue }
        if (-not $ext) { continue } # solo archivos con extensión

        # Resuelve alias documentados (prompts/X.md -> .agents/task-system/prompts/X.md)
        if ($p -match '^prompts[/\\]') {
            $p = ".agents/task-system/" + $p
        }

        $checked++
        if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $p))) {
            $stale.Add($p)
        }
    }
}

if ($stale.Count -gt 0) {
    Write-Host "check-agents-refs: $($stale.Count) stale ref(s) of $checked checked" -ForegroundColor Red
    $stale | Sort-Object -Unique | ForEach-Object { Write-Host "  MISSING: $_" -ForegroundColor Red }
    exit 1
}

Write-Host "check-agents-refs: OK ($checked refs)" -ForegroundColor Green
exit 0
