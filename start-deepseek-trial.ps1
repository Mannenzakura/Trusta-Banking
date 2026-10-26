param([string]$KeyFile='',[string]$TunnelConfig='',[string]$Cloudflared='cloudflared')
$ErrorActionPreference='Stop'
if(!$KeyFile){$KeyFile=Join-Path (Split-Path $PSScriptRoot) 'private/deepseek-api-key.txt'}
if(!(Test-Path -LiteralPath $KeyFile)){throw '请先将 DeepSeek Key 保存到本机私有文件；不要填写到网页或聊天中。'}
$env:TRUSTA_CHAT_LLM_KEY_FILE=$KeyFile
$env:TRUSTA_CHAT_LLM_MODEL='deepseek-flash'
$env:TRUSTA_CHAT_LLM_ENDPOINT='https://api.deepseek.com/chat/completions'
$env:TRUSTA_CHAT_LLM_TRIAL_BUDGET_FILE=Join-Path (Split-Path $KeyFile) 'deepseek-trial.sqlite3'
$env:TRUSTA_CHAT_LLM_CONCURRENCY='1'
$env:TRUSTA_CHAT_LLM_TIMEOUT='40'
Write-Host '仅限首次 1 元预算测试：累计保守预留用完或 24 小时到期后停止调用；不会自动充值。'
Write-Host '请先停止已运行的 TRUSTA，再启动此模式。不要删除预算数据库来重置额度。'
& (Join-Path $PSScriptRoot 'start-web.ps1') -TunnelConfig $TunnelConfig -Cloudflared $Cloudflared -EnableModel
