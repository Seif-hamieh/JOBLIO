# Tunnel watchdog, run every 5 minutes by Windows Task Scheduler (as SYSTEM, which may restart services).
# The Cloudflare Tunnel service can stay "Running" while it has lost its connection (the site answers 1033 / 530
# from outside). Windows only restarts services that crash, so this checks the site from the internet and, when it
# is unreachable from outside but fine on this computer, restarts the cloudflared service.
#   - two checks 20 s apart before acting (a short network blip isn't a failure)
#   - only the tunnel is restarted, and only if the site itself answers locally
#   - at most one restart every 10 minutes
# Restarts and problems are written to tunnel-watchdog.log in the project folder (quiet when all is well).
$root = Split-Path -Parent $PSScriptRoot
$log = Join-Path $root 'tunnel-watchdog.log'
$stamp = Join-Path $root 'tunnel-watchdog.last-restart'
function Write-Log($msg) { "$(Get-Date -Format s)  $msg" | Add-Content $log }

function Test-Url($url) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20 -Headers @{ 'Cache-Control' = 'no-cache' }
    return $r.StatusCode -lt 500
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    return ($code -and $code -lt 500)
  }
}

$public = 'https://www.getjoblio.app/api/mobile/app-version'
if (Test-Url $public) { exit 0 }
Start-Sleep -Seconds 20
if (Test-Url $public) { exit 0 }

# Unreachable from outside twice. Is the site itself up on this computer?
if (-not (Test-Url 'http://localhost:3001/api/mobile/app-version')) {
  Write-Log 'site down locally too (PM2 / Next.js) - not restarting the tunnel'
  exit 1
}

if ((Test-Path $stamp) -and ((Get-Date) - (Get-Item $stamp).LastWriteTime).TotalMinutes -lt 10) {
  Write-Log 'unreachable from outside, but the tunnel was restarted less than 10 minutes ago - waiting'
  exit 1
}

try {
  Restart-Service cloudflared -Force -ErrorAction Stop
  Set-Content -Path $stamp -Value (Get-Date -Format s)
  Start-Sleep -Seconds 30
  Write-Log "unreachable from outside - restarted cloudflared; reachable again: $(Test-Url $public)"
} catch {
  Write-Log "unreachable from outside - could not restart cloudflared: $($_.Exception.Message)"
  exit 1
}
