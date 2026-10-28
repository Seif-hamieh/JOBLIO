# Creates (or replaces) the "JOBLIO tunnel watchdog" task: every 5 minutes, as SYSTEM (allowed to restart the
# cloudflared service), even when nobody is signed in. Run once from an Administrator PowerShell:
#   powershell -ExecutionPolicy Bypass -File C:\Server\joblio-new\joblio\scripts\install-tunnel-watchdog.ps1
$name = 'JOBLIO tunnel watchdog'
$script = Join-Path $PSScriptRoot 'tunnel-watchdog.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 4)
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
  -Description 'Restarts the Cloudflare Tunnel when www.getjoblio.app is unreachable from outside but up locally' | Out-Null
Get-ScheduledTask -TaskName $name | Get-ScheduledTaskInfo | Select-Object TaskName, NextRunTime
