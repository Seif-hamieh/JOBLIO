# Daily backup of the live database (local PostgreSQL), run by Windows Task Scheduler.
# Writes a compressed copy to C:\Server\backups\joblio-backup-YYYY-MM-DD.dump, checks it can be read back,
# and deletes copies older than $KeepDays days. The database password is read from .env.production.local
# and passed through PGPASSWORD, so it never appears in a command line or in the log.
#
# Off-site copy: every backup the Google Drive folder does not have yet is copied there (so days missed while
# G: was not connected are caught up on the next run), and Drive copies older than $DriveKeepDays are removed.
# If Google Drive is not available the local backup still counts as a success; the log says WARN.
#
# Restore a backup (into an empty database):
#   & "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" --no-owner -U postgres -d joblio C:\Server\backups\joblio-backup-2026-10-26.dump
param(
  [string]$BackupDir = 'C:\Server\backups',
  [int]$KeepDays = 7,
  [string]$DriveDir = 'G:\My Drive\JoblioBackups',
  [int]$DriveKeepDays = 30
)

$root = Split-Path -Parent $PSScriptRoot
$bin = 'C:\Program Files\PostgreSQL\18\bin'
$log = Join-Path $BackupDir 'backup.log'
New-Item -ItemType Directory -Force $BackupDir | Out-Null
function Write-Log($msg) { "$(Get-Date -Format s)  $msg" | Add-Content $log }

$line = Get-Content (Join-Path $root '.env.production.local') | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $line) { Write-Log 'FAILED  DATABASE_URL is missing from .env.production.local'; exit 1 }
$url = [uri](($line -replace '^DATABASE_URL=', '').Trim('"', "'", ' '))
$user, $pass = $url.UserInfo.Split(':', 2)
$db = $url.AbsolutePath.TrimStart('/')
$port = if ($url.Port -gt 0) { $url.Port } else { 5432 }

$file = Join-Path $BackupDir "joblio-backup-$(Get-Date -Format yyyy-MM-dd).dump"
$env:PGPASSWORD = [uri]::UnescapeDataString($pass)
try {
  # -Fc = PostgreSQL's compressed backup format (restore it with pg_restore).
  & "$bin\pg_dump.exe" -h $url.Host -p $port -U ([uri]::UnescapeDataString($user)) -d $db -Fc --no-owner --no-acl -f $file
  if ($LASTEXITCODE -ne 0) { throw "pg_dump exited with code $LASTEXITCODE" }
  # Make sure the file is a complete, readable backup.
  & "$bin\pg_restore.exe" --list $file | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'the backup file could not be read back' }
} catch {
  Write-Log "FAILED  $($_.Exception.Message)"
  exit 1
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

$sizeMb = [math]::Round((Get-Item $file).Length / 1MB, 2)
$old = Get-ChildItem $BackupDir -Filter 'joblio-backup-*.dump' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) }
$old | Remove-Item -Force
Write-Log "OK  $(Split-Path -Leaf $file)  $sizeMb MB  (removed $(@($old).Count) old)"

# Off-site copy to Google Drive. Never fails the task: the local backup above is already safe.
try {
  if (-not $DriveDir -or -not (Test-Path (Split-Path -Qualifier $DriveDir))) { throw "$(Split-Path -Qualifier $DriveDir) is not connected (is Google Drive running and signed in?)" }
  New-Item -ItemType Directory -Force $DriveDir -ErrorAction Stop | Out-Null
  $copied = 0
  foreach ($f in Get-ChildItem $BackupDir -Filter 'joblio-backup-*.dump') {
    $target = Join-Path $DriveDir $f.Name
    $existing = Get-Item $target -ErrorAction SilentlyContinue
    # Google Drive keeps times to the millisecond only, so allow a small difference.
    if (-not $existing -or $existing.Length -ne $f.Length -or [math]::Abs(($existing.LastWriteTime - $f.LastWriteTime).TotalSeconds) -gt 2) {
      Copy-Item $f.FullName $target -Force -ErrorAction Stop
      $copied++
    }
  }
  $oldDrive = Get-ChildItem $DriveDir -Filter 'joblio-backup-*.dump' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$DriveKeepDays) }
  $oldDrive | Remove-Item -Force -ErrorAction Stop
  Write-Log "OK  Google Drive: copied $copied, removed $(@($oldDrive).Count) old  ($DriveDir)"
} catch {
  Write-Log "WARN  Google Drive copy skipped: $($_.Exception.Message)"
}
