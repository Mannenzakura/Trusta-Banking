$status=Join-Path $PSScriptRoot 'data/supervisor-status.json'
if(Test-Path -LiteralPath $status){Get-Content -LiteralPath $status | ConvertFrom-Json | Format-List}else{Write-Host '暂无运行状态，请启动 TRUSTA。'}
