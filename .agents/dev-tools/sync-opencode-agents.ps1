<#
.SYNOPSIS
  Genera la capa `.opencode/` de OpenCode a partir de las fuentes canónicas de
  `.agents/` (agentes + comandos), traduciendo el esquema de `permission` para que
  OpenCode lo entienda.

.DESCRIPTION
  OpenCode registra los subagentes leyendo markdown de:
    - Global:      ~/.config/opencode/agents/
    - Por proyecto: .opencode/agents/
  El nombre del archivo ES el nombre del agente. `description` es OBLIGATORIO.
  Claves de `permission` válidas: read, edit, glob, grep, list, bash, task,
  external_directory, webfetch, websearch, lsp, skill, question, doom_loop.

  Las fuentes de `.agents/agents/*.md` usan `shell:` (en vez de `bash:`),
  `subagent:` (en vez de `task:`) y `name:` (el nombre lo deriva el archivo).
  Este script traduce esas claves y elimina `name:`.

  Mismo criterio para comandos: `.agents/commands/*.md` → `.opencode/command/*.md`.

.EXAMPLE
  pwsh -ExecutionPolicy Bypass -File .agents/dev-tools/sync-opencode-agents.ps1
#>
[CmdletBinding()]
param(
    [switch]$Check   # Solo informa: no escribe. Salida 1 si hay drift.
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$SrcAgents   = Join-Path $RepoRoot ".agents\agents"
$SrcCommands = Join-Path $RepoRoot ".agents\commands"
$DstAgents   = Join-Path $RepoRoot ".opencode\agents"
$DstCommands = Join-Path $RepoRoot ".opencode\command"

# Traduccion de claves de permission no soportadas nativamente por OpenCode.
$KeyMap = @{
    "shell"    = "bash"
    "subagent" = "task"
}
# Claves que no existen en OpenCode y se descartan (con aviso).
$DropKeys = @("todowrite", "push", "pull_request")

function Split-Frontmatter {
    param([string]$Content)
    if ($Content -notmatch '(?s)^---\r?\n(.*?)\r?\n---\r?\n?(.*)$') {
        return @{ Has = $false; Raw = ""; Body = $Content }
    }
    return @{ Has = $true; Raw = $matches[1]; Body = $matches[2] }
}

function Convert-PermissionBlock {
    param([string]$Raw)
    $out = New-Object System.Collections.Generic.List[string]
    $inPerm = $false
    foreach ($line in ($Raw -split "`r?`n")) {
        if ($line -match '^\s*permission:\s*$') { $inPerm = $true; continue }
        if ($inPerm) {
            if ($line -match '^\S') { $inPerm = $false }   # sale del bloque
            else {
                $m = [regex]::Match($line, '^\s+"?([A-Za-z0-9_*\-]+)"?\s*:\s*(.+?)\s*$')
                if ($m.Success) {
                    $key = $m.Groups[1].Value
                    $val = $m.Groups[2].Value
                    if ($DropKeys -contains $key) {
                        Write-Warning "  ! clave no soportada por OpenCode, descartada: '$key'"
                        continue
                    }
                    if ($KeyMap.ContainsKey($key)) { $key = $KeyMap[$key] }
                    $out.Add(("  {0}: {1}" -f $key, $val))
                    continue
                }
                if ($line.Trim() -eq "") { continue }
            }
        }
    }
    return ($out -join "`n")
}

function Get-Description {
    param([string]$Raw, [string]$Fallback)
    $m = [regex]::Match($Raw, '(?s)description:\s*(?:>-\s*)?(.*?)(?=\n[a-zA-Z_-]+:|\z)')
    if ($m.Success) {
        $d = ($m.Groups[1].Value -replace '\r?\n\s+', ' ').Trim().Trim('"')
        if ($d) { return $d }
    }
    return $Fallback
}

$written = 0; $drift = @()

# ---------- AGENTES ----------
if (-not (Test-Path $DstAgents)) { New-Item -ItemType Directory -Path $DstAgents -Force | Out-Null }
Get-ChildItem $SrcAgents -Filter *.md | ForEach-Object {
    $agentName = $_.BaseName
    $content = Get-Content $_.FullName -Raw -Encoding UTF8
    $fm = Split-Frontmatter $content
    $desc = Get-Description $fm.Raw "Agente Ego: $agentName"

    $newFm = @()
    $newFm += "---"
    $newFm += "description: $desc"
    $mode = "subagent"
    if ($fm.Has -and $fm.Raw -match '(?m)^mode:\s*(.+?)\s*$') { $mode = $matches[1] }
    $newFm += "mode: $mode"
    if ($fm.Has -and $fm.Raw -match '(?m)^model:\s*(.+?)\s*$') { $newFm += "model: $($matches[1])" }
    if ($fm.Has -and $fm.Raw -match '(?m)^temperature:\s*(.+?)\s*$') { $newFm += "temperature: $($matches[1])" }
    if ($fm.Has) {
        $perm = Convert-PermissionBlock $fm.Raw
        if ($perm.Trim()) { $newFm += "permission:"; $newFm += $perm }
    }
    $newFm += "---"

    $out = (($newFm -join "`n") + "`n" + $fm.Body).TrimEnd() + "`n"
    $dst = Join-Path $DstAgents "$agentName.md"
    $existing = if (Test-Path $dst) { Get-Content $dst -Raw -Encoding UTF8 } else { "" }
    if ($existing -ne $out) {
        if ($Check) { $drift += $dst } else { Set-Content -Path $dst -Value $out -Encoding UTF8 -NoNewline; $written++ }
    }
}

# ---------- COMANDOS ----------
if (-not (Test-Path $DstCommands)) { New-Item -ItemType Directory -Path $DstCommands -Force | Out-Null }
Get-ChildItem $SrcCommands -Filter *.md | ForEach-Object {
    $cmdName = $_.BaseName
    $content = Get-Content $_.FullName -Raw -Encoding UTF8
    $fm = Split-Frontmatter $content
    $desc = Get-Description $fm.Raw "Comando /$cmdName de Ego (ver .agents/commands/$cmdName.md)"

    $body = $fm.Body
    # Fuentes sin frontmatter: las primeras lineas son un bloquequote de entrada.
    $head = (($body -split "`r?`n") | Where-Object { $_.Trim() -ne "" } | Select-Object -First 3) -join " "
    $head = ($head -replace '(?m)^>\s*', '') -replace '\s+', ' '

    $newFm = @("---", "description: $desc", "---")
    $out = (($newFm -join "`n") + "`n" + $body).TrimEnd() + "`n"
    $dst = Join-Path $DstCommands "$cmdName.md"
    $existing = if (Test-Path $dst) { Get-Content $dst -Raw -Encoding UTF8 } else { "" }
    if ($existing -ne $out) {
        if ($Check) { $drift += $dst } else { Set-Content -Path $dst -Value $out -Encoding UTF8 -NoNewline; $written++ }
    }
}

if ($Check) {
    if ($drift.Count -gt 0) {
        Write-Output "DRIFT: $($drift.Count) archivo(s) desincronizados:"
        $drift | ForEach-Object { Write-Output "  $_" }
        exit 1
    }
    Write-Output "OK: .opencode/ sincronizado con .agents/"
    exit 0
}
Write-Output "Sincronizado: $written archivo(s) escrito(s) en .opencode/agents y .opencode/command"
