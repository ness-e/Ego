#Requires -Version 5.1
<#
.SYNOPSIS
  Rotacion automatica de memoria task-system (MEM-ROTATE-04, D9+D10).
.DESCRIPTION
  - lessons.md / decisions.md: si >50KB o >200 lineas, mueve entradas viejas a
    archive/<base>-archive-YYYY-MM-DD.md y deja header + recientes (<=200L, <50KB).
  - opencode-loop/ses_*.json: borra >30d y excedente sobre cap 50 (keep newest).
    Nunca toca goals/ ni loop.log.
  - enforcement/sessions: TTL 30d + cap 20. verify-log.jsonl: cap 200L/50KB.
  - Idempotente. Soporta -WhatIf (dry-run).
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param()

$ErrorActionPreference = 'Stop'
$archiveDir = Join-Path $PSScriptRoot 'archive'
$loopRaw = Join-Path $PSScriptRoot '../../opencode-loop'
$loopDir = if (Test-Path $loopRaw) { (Resolve-Path $loopRaw).Path } else { $null }
$sessionsDir = (Resolve-Path (Join-Path $PSScriptRoot '../enforcement/sessions')).Path
$verifyLog = (Join-Path (Split-Path $sessionsDir -Parent) 'verify-log.jsonl')
$today = Get-Date -Format 'yyyy-MM-dd'
$maxBytes = 50KB
$maxLines = 200

function Rotate-MemoryFile($path) {
  $item = Get-Item $path
  $lines = @(Get-Content $path)
  if ($item.Length -le $maxBytes -and $lines.Count -le $maxLines) {
    Write-Output ("OK (sin rotacion): {0} {1}B {2}L" -f $item.Name, $item.Length, $lines.Count)
    return
  }
  $base = [IO.Path]::GetFileNameWithoutExtension($item.Name)
  # Header = todo hasta la primera entrada '- YYYY-'
  $firstEntry = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^- \d{4}-\d{2}-\d{2} \|') { $firstEntry = $i; break }
  }
  if ($firstEntry -lt 0) { Write-Output ("SKIP (sin entradas): {0}" -f $item.Name); return }
  $header = $lines[0..($firstEntry - 1)]
  $entries = $lines[$firstEntry..($lines.Count - 1)]
  # Keep recientes que quepan en umbrales (header fijo + ultimas N entradas)
  $keep = @()
  for ($n = $entries.Count; $n -ge 0; $n--) {
    $cand = if ($n -eq 0) { @() } else { $entries[($entries.Count - $n)..($entries.Count - 1)] }
    $total = $header.Count + $cand.Count
    $bytes = ([Text.Encoding]::UTF8.GetByteCount(($header + $cand) -join "`n") + 1)
    if ($total -le $maxLines -and $bytes -le $maxBytes) { $keep = $cand; break }
  }
  $moved = $entries.Count - $keep.Count
  if ($moved -le 0) { Write-Output ("OK (cabe en umbral): {0}" -f $item.Name); return }
  $movedLines = $entries[0..($moved - 1)]
  $dest = Join-Path $archiveDir ("{0}-archive-{1}.md" -f $base, $today)
  $archiveHeader = "# Archive {0} — {1} (auto-rotacion MEM-ROTATE-04)" -f $base, $today
  if ($PSCmdlet.ShouldProcess($dest, "archivar $moved entradas de $($item.Name)")) {
    if (Test-Path $dest) { Add-Content $dest ("`n---`n`n" + ($movedLines -join "`n")) }
    else { Set-Content $dest ($archiveHeader + "`n`n" + ($movedLines -join "`n") + "`n") }
    Set-Content $path (($header + $keep) -join "`n" + "`n")
  }
  Write-Output ("ROTADO: {0}: {1} entradas -> {2} (quedan {3}L)" -f $item.Name, $moved, (Split-Path $dest -Leaf), ($header.Count + $keep.Count))
}

function Clear-OldFiles($dir, $filter, $ttlDays, $keepNewest, $label) {
  $files = @(Get-ChildItem $dir -Filter $filter -File | Sort-Object LastWriteTime, Name)
  if ($files.Count -eq 0) { Write-Output ("OK (vacio): {0}" -f $label); return }
  $cutoff = (Get-Date).AddDays(-$ttlDays)
  $byAge = @($files | Where-Object { $_.LastWriteTime -lt $cutoff })
  $rest = @($files | Where-Object { $_.LastWriteTime -ge $cutoff } | Sort-Object LastWriteTime, Name)
  $overCap = @()
  if ($rest.Count -gt $keepNewest) { $overCap = @($rest[0..($rest.Count - $keepNewest - 1)]) }
  $toDelete = @($byAge) + @($overCap)
  foreach ($f in $toDelete) {
    if ($PSCmdlet.ShouldProcess($f.FullName, "borrar $label TTL/cap")) { Remove-Item -LiteralPath $f.FullName -Force }
  }
  $remain = (Get-ChildItem $dir -Filter $filter -File | Measure-Object).Count
  Write-Output ("{0}: borrados {1}, quedan {2} (cap {3}, TTL {4}d)" -f $label, $toDelete.Count, $remain, $keepNewest, $ttlDays)
}

Rotate-MemoryFile (Join-Path $PSScriptRoot 'lessons.md')
Rotate-MemoryFile (Join-Path $PSScriptRoot 'decisions.md')
if ($loopDir) { Clear-OldFiles $loopDir 'ses_*.json' 30 50 'opencode-loop/ses_*.json' }
else { Write-Output "SKIP (sin opencode-loop)" }
Clear-OldFiles $sessionsDir '*.json' 30 20 'enforcement/sessions'

if (Test-Path $verifyLog) {
  $v = Get-Item $verifyLog
  $vl = @(Get-Content $verifyLog)
  if ($v.Length -gt $maxBytes -or $vl.Count -gt $maxLines) {
    if ($PSCmdlet.ShouldProcess($verifyLog, "truncar a ultimas $maxLines lineas")) {
      Set-Content $verifyLog (($vl | Select-Object -Last $maxLines) -join "`n" + "`n")
    }
    Write-Output ("ROTADO: verify-log.jsonl -> ultimas {0}L" -f $maxLines)
  } else {
    Write-Output ("OK (sin rotacion): verify-log.jsonl {0}B {1}L" -f $v.Length, $vl.Count)
  }
}
