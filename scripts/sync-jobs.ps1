# The nightly job import that Vercel Cron used to run (/api/cron/sync-jobs), for the self-hosted website.
# Windows Task Scheduler runs it every night; it calls the local server with the CRON_SECRET from
# .env.production.local (the secret never leaves this computer).
$root = Split-Path -Parent $PSScriptRoot
$line = Get-Content (Join-Path $root '.env.production.local') | Where-Object { $_ -match '^CRON_SECRET=' } | Select-Object -First 1
if (-not $line) { Write-Error 'CRON_SECRET is missing from .env.production.local'; exit 1 }
$secret = ($line -replace '^CRON_SECRET=', '').Trim('"', "'", ' ')
$log = Join-Path $root 'sync-jobs.log'
try {
  $res = Invoke-WebRequest -Uri 'http://localhost:3001/api/cron/sync-jobs' -Headers @{ Authorization = "Bearer $secret" } -UseBasicParsing -TimeoutSec 300
  "$(Get-Date -Format s)  $($res.StatusCode)  $($res.Content)" | Add-Content $log
} catch {
  "$(Get-Date -Format s)  FAILED  $($_.Exception.Message)" | Add-Content $log
  exit 1
}
