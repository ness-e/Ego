# clean-artifacts.ps1 — Limpieza de artefactos transitorios y caches (.agents)
param(
    [switch]$Clean,
    [switch]$Yes
)

$ErrorActionPreference = 'Stop'

# Resuelve raíz del proyecto (fuera de .agents)
$ProjectRoot = $PSScriptRoot
while ($ProjectRoot -and (Split-Path -Leaf $ProjectRoot) -ne ".agents") {
    $parent = Split-Path -Parent $ProjectRoot
    if ($parent -eq $ProjectRoot -or [string]::IsNullOrEmpty($parent)) { break }
    $ProjectRoot = $parent
}
if ($ProjectRoot -and (Split-Path -Leaf $ProjectRoot) -eq ".agents") {
    $ProjectRoot = Split-Path -Parent $ProjectRoot
}

Write-Host "=== Limpieza de Artefactos de Build y Caches ===" -ForegroundColor Cyan
Write-Host "Workspace: $ProjectRoot" -ForegroundColor DarkGray

$candidates = @(
    "dist",
    "out",
    ".turbo",
    "target/debug/incremental",
    "node_modules/.cache"
)

$found = @()
foreach ($rel in $candidates) {
    $p = Join-Path $ProjectRoot $rel
    if (Test-Path $p) {
        $size = (Get-ChildItem $p -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $sizeMB = if ($size) { [math]::Round($size / 1MB, 2) } else { 0 }
        $found += [PSCustomObject]@{
            RelPath = $rel
            FullPath = $p
            SizeMB = $sizeMB
        }
    }
}

if ($found.Count -eq 0) {
    Write-Host "No se encontraron artefactos temporales acumulados." -ForegroundColor Green
    exit 0
}

Write-Host "Artefactos encontrados:" -ForegroundColor Yellow
$found | Format-Table RelPath, SizeMB

if ($Clean) {
    if (-not $Yes) {
        $ans = Read-Host "¿Deseas eliminar estos directorios transitorios? [y/N]"
        if ($ans -notmatch '^[yY]') {
            Write-Host "Operación cancelada." -ForegroundColor Yellow
            exit 0
        }
    }
    foreach ($item in $found) {
        Write-Host "Eliminando $($item.RelPath)..." -ForegroundColor Yellow -NoNewline
        Remove-Item -LiteralPath $item.FullPath -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host " eliminado." -ForegroundColor Green
    }
    Write-Host "Limpieza completada con éxito." -ForegroundColor Green
} else {
    Write-Host "Modo reporte: pasa -Clean para eliminar estos artefactos." -ForegroundColor DarkGray
}
