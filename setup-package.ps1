param([switch]$WithTests)
$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
python -c "import sys; sys.exit(0 if sys.version_info >= (3,12) else 1)"
if($LASTEXITCODE -ne 0){throw '需要 Python 3.12 或更高版本。'}
python -m venv .venv
if($LASTEXITCODE -ne 0){throw '无法创建 Python 虚拟环境。'}
& ./.venv/Scripts/python.exe -m pip install -r requirements.txt
if($LASTEXITCODE -ne 0){throw '依赖安装失败；请检查网络后重试。'}
if($WithTests){
    & ./.venv/Scripts/python.exe -m pip install -r requirements-evaluation.txt
    if($LASTEXITCODE -ne 0){throw '测试依赖安装失败。'}
}
Write-Host '安装完成。运行 start-web.ps1 -OpenBrowser 即可本地体验。无需 API Key，不调用付费模型。'
