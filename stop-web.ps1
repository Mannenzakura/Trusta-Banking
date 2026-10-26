$ErrorActionPreference='Stop'
$target=Join-Path $PSScriptRoot 'data/supervisor.stop'
New-Item -ItemType File -Path $target -Force | Out-Null
Write-Host '已请求停止 TRUSTA 守护进程及它启动的服务。不会结束其他 Python 程序。'
