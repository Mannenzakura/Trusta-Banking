param([string]$TunnelConfig = '', [string]$Cloudflared = 'cloudflared', [switch]$OpenBrowser, [switch]$EnableModel)
$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
$py=Join-Path $PSScriptRoot '.venv/Scripts/python.exe'
if (Test-Path (Join-Path $PSScriptRoot 'runtime/python/python.exe')) { $py=Join-Path $PSScriptRoot 'runtime/python/python.exe' }
if (!(Test-Path -LiteralPath $py)) { throw '请先运行 setup-package.ps1 安装依赖。' }
if (!$EnableModel) {
    # Plain startup must not reuse paid-model credentials from an earlier shell session.
    $env:TRUSTA_CHAT_LLM_API_KEY=''
    $env:DEEPSEEK_API_KEY=''
    $env:TRUSTA_CHAT_LLM_KEY_FILE=''
    $env:TRUSTA_LLM_CONFIG=''
}
$env:TRUSTA_ACCESS_MODE=if($TunnelConfig){'tunnel'}else{'local'}
$env:TRUSTA_PUBLIC_HOST='mannenzakura.cn'
$env:PYTHONIOENCODING='utf-8'
$env:TRUSTA_OPEN_BROWSER=if($OpenBrowser){'1'}else{'0'}
$argsList=@('-u','-m','scripts.web_supervisor')
if($TunnelConfig){$argsList+=@('--tunnel',$TunnelConfig,'--cloudflared',$Cloudflared)}
Write-Host 'TRUSTA 正在运行；异常会自动重启。关闭本窗口或运行 stop-web.ps1 可停止。'
& $py @argsList
