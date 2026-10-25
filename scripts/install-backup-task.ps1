# Creates (or replaces) the "JOBLIO database backup" task: every day at 03:00, as the signed-in Windows user, so
# the Google Drive folder (G:) is reachable. If the computer was off or nobody was signed in at 03:00, the task
# runs as soon as possible afterwards. Run once from an Administrator PowerShell:
#   powershell -ExecutionPolicy Bypass -File C:\Server\joblio-new\joblio\scripts\install-backup-task.ps1
param([string]$User = "$env:USERDOMAIN\$env:USERNAME")

$name = 'JOBLIO database backup'
$script = Join-Path $PSScriptRoot 'backup-db.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Daily -At 3:00AM
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)
$principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive

Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
  -Description 'Daily JOBLIO database backup to C:\Server\backups, copied to Google Drive' | Out-Null
Get-ScheduledTask -TaskName $name | Get-ScheduledTaskInfo | Select-Object TaskName, NextRunTime
