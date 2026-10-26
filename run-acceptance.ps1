$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:PYTHONUTF8='1'
# The acceptance runner must never inherit credentials or live connectors.
Get-ChildItem Env: | Where-Object { $_.Name -match '^(TRUSTA_|DEEPSEEK_)' } | ForEach-Object { Remove-Item -LiteralPath ('Env:' + $_.Name) }
$env:TRUSTA_CHAT_LLM_API_KEY=''
$env:TRUSTA_CHAT_LLM_KEY_FILE=''
$env:TRUSTA_LLM_CONFIG=''
$env:TRUSTA_BANK_CONFIG=''
Write-Host '使用独立临时数据库和脚本模型测试，不请求付费模型，不操作真实资金。'
& ./.venv/Scripts/python.exe -m pytest tests/test_chat.py tests/test_chat_b8.py tests/test_finance.py tests/test_extensions.py tests/test_advanced.py tests/test_extension_agent.py tests/test_pages_wealth_bills.py tests/test_bank_mount.py tests/test_agent_upgrade.py tests/test_plan_bridge.py tests/test_personal_plans.py tests/test_retail.py tests/test_release_security.py -q
if($LASTEXITCODE -ne 0){throw '验收未通过，请检查上方失败项。'}
