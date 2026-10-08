#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Switch MCP profiles for Ego OpenCode.
.DESCRIPTION
    Changes which MCP servers are enabled in opencode.jsonc based on profile.
    Schema: mcp.servers.<name>.disabled (false = ON). Legacy {mcp:{<name>:{enabled}}}
    profiles are auto-converted (enabled -> -not disabled).
    Restart OpenCode after switching for changes to take effect.
.PARAMETER Profile
    Profile name: core, design, full
.PARAMETER Status
    Show current MCP status
.PARAMETER List
    List available profiles
.EXAMPLE
    .agents/mcp-profiles/switch-profile.ps1 -Profile core
    .agents/mcp-profiles/switch-profile.ps1 -Status
#>

param(
    [string]$Profile,
    [switch]$Status,
    [switch]$List
)

$ConfigPath = Join-Path $PSScriptRoot ".." ".." "opencode.jsonc"
$ProfilesDir = $PSScriptRoot

# Resolve absolute paths
$ConfigPath = Resolve-Path $ConfigPath -ErrorAction Stop

function Get-ProfileServers($profileObj) {
    if ($profileObj.mcp.servers) { return $profileObj.mcp.servers }
    if ($profileObj.mcp) { return $profileObj.mcp }  # legacy fallback
    return $null
}

function Get-TargetDisabled($serverNode) {
    if ($null -ne $serverNode.disabled) { return [bool]$serverNode.disabled }
    if ($null -ne $serverNode.enabled) { return -not [bool]$serverNode.enabled }  # legacy
    return $true
}

if ($List) {
    Write-Host "Perfiles disponibles:" -ForegroundColor Cyan
    Get-ChildItem "$ProfilesDir\*.json" | ForEach-Object {
        $name = $_.BaseName
        $content = Get-Content $_ -Raw | ConvertFrom-Json
        $servers = Get-ProfileServers $content
        $props = @($servers.PSObject.Properties)
        $total = $props.Count
        $enabled = ($props | Where-Object { -not (Get-TargetDisabled $_.Value) }).Count
        Write-Host "  $name  ($enabled/$total MCPs activos)" -ForegroundColor Yellow
    }
    return
}

if ($Status) {
    Write-Host "Estado actual de MCPs:" -ForegroundColor Cyan
    $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    $config.mcp.servers.PSObject.Properties | Sort-Object Name | ForEach-Object {
        if (-not $_.Value.disabled) {
            Write-Host "  [ON]  $($_.Name)" -ForegroundColor Green
        } else {
            Write-Host "  [OFF] $($_.Name)" -ForegroundColor DarkGray
        }
    }
    return
}

if (-not $Profile) {
    Write-Host "Uso: switch-profile.ps1 -Profile <nombre> | -Status | -List" -ForegroundColor Yellow
    Write-Host "Perfiles: core, design, full" -ForegroundColor Gray
    exit 1
}

$ProfilePath = Join-Path $ProfilesDir "$Profile.json"
if (-not (Test-Path $ProfilePath)) {
    Write-Host "Perfil '$Profile' no encontrado." -ForegroundColor Red
    Write-Host "Disponibles: " -NoNewline
    Get-ChildItem "$ProfilesDir\*.json" | ForEach-Object { Write-Host "$($_.BaseName) " -NoNewline -ForegroundColor Yellow }
    Write-Host ""
    exit 1
}

# Read current config
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json

# Read profile
$profileConfig = Get-Content $ProfilePath -Raw | ConvertFrom-Json
$profileServers = Get-ProfileServers $profileConfig

# Apply profile settings (only servers present in opencode.jsonc; others untouched)
$changed = @()
foreach ($mcpName in $profileServers.PSObject.Properties.Name) {
    $targetDisabled = Get-TargetDisabled $profileServers.$mcpName
    if ($config.mcp.servers.$mcpName) {
        if ([bool]$config.mcp.servers.$mcpName.disabled -ne $targetDisabled) {
            $config.mcp.servers.$mcpName.disabled = $targetDisabled
            $changed += $mcpName
        }
    } else {
        Write-Host "  Aviso: '$mcpName' no existe en opencode.jsonc, se omite." -ForegroundColor DarkYellow
    }
}

# Write back with pretty formatting
$json = $config | ConvertTo-Json -Depth 10
Set-Content $ConfigPath -Value $json -Encoding UTF8

if ($changed.Count -eq 0) {
    Write-Host "Perfil '$Profile' ya está activo. Sin cambios." -ForegroundColor Gray
} else {
    Write-Host "Perfil '$Profile' aplicado. MCPs modificados:" -ForegroundColor Green
    foreach ($mcp in $changed) {
        if (-not $profileServers.$mcp.disabled -and $null -eq $profileServers.$mcp.disabled) {
            $isOn = -not (Get-TargetDisabled $profileServers.$mcp)
        } else {
            $isOn = -not [bool]$profileServers.$mcp.disabled
            if ($null -eq $profileServers.$mcp.disabled) { $isOn = -not (Get-TargetDisabled $profileServers.$mcp) }
        }
        if ($isOn) {
            Write-Host "  $mcp -> [ON] habilitado" -ForegroundColor Yellow
        } else {
            Write-Host "  $mcp -> [OFF] deshabilitado" -ForegroundColor Yellow
        }
    }
    Write-Host ""
    Write-Host "Reinicie OpenCode (o recargue MCPs) para que los cambios surtan efecto." -ForegroundColor Cyan
}
