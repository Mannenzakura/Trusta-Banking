# TRUSTA 源码交付与验收

本包用于队友代码审阅和本地虚拟银行演示，不包含任何人的账户库、模型密钥、支付密钥、设备登录令牌或隧道凭据。完整验收结果见 [本次验收报告](docs/release-acceptance-20261026.md)。历史文档中的测试分数、模型状态和部署版本不代表本包全部通过。

## 启动

Windows 安装 Python 3.12 或更新版本。若要测试可选的 Windows AppContainer 财务进程隔离，需要完整的 Python 3.13；当前隔离实现只验证并允许该版本。常规网页和虚拟银行不依赖这个可选开关。

在本目录打开 PowerShell，首次安装：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\setup-package.ps1 -WithTests
```

启动本地网页：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-web.ps1 -OpenBrowser
```

保持窗口打开。关闭服务时运行 `stop-web.ps1`。首次启动会生成接收者自己的虚拟资料和本地密钥。预编译前端已包含；修改前端后，需要 Node.js，执行 `npm --prefix frontend-app ci`，设置 `TRUSTA_WEB_BASE=/bank/` 后执行 `npm --prefix frontend-app run build`。

默认不接入付费大模型、不连接真实银行、不需要 Cloudflare。请不要复制原开发者的运行目录或密钥来体验。线上域名依赖开发者电脑和隧道，本包不包含隧道授权。

## 业务边界

转账、存款、基金、黄金、外币、贷款分期、信用账单和心愿金均使用虚拟资金。AI 只能提出候选操作，交易须点击确认；高风险操作还要求绑定本笔交易的验证。外汇和黄金参考行情可能不可用或过期，不能把练习价格当成实时市场价格。

机票、火车票、酒店、演出、生活缴费、政务服务按当前产品设计跳转官方网站。本站没有真实出票、真实代缴和第三方退款能力，打开链接不代表已完成交易。会员权益只在本站练习记录中生效。

## 模型

普通启动没有 API Key 时使用明确标识的规则助手。启用 DeepSeek 需接收者自行提供普通 API Key。密钥只保存在本机私有文件，不填写进源码、前端或 GitHub。

`start-deepseek-trial.ps1` 是受限试用入口：读取指定私有密钥文件，使用持久化的首次 1 元累计保守预算，并在首次预留后 24 小时到期。预算预留不是供应商实际账单。不能删除预算数据库来扩额；重新使用前需要核实官方模型价格。新增 Key 不意味着调用免费。

此次仅对 DeepSeek 的余额查询、转账提议及拒绝、机票官网导航做了有限真实联调，并验证无关请求被拒绝。其他业务的自动化验证主要使用脚本模型，不代表所有自然语言说法都已通过真实模型测试。

## 重跑验收

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\run-acceptance.ps1
```

该清单使用临时数据库及脚本模型，不调用付费模型、不改变真实账户。更广泛的实验测试位于 `tests/`；可选链上测试另装 `requirements-phase6.txt`。部分实验测试依赖未随源码提供的原始评测记录；Groth16 开发产物现已提供独立 Release 附件，见 docs/proof-assets.md，不能伪造这些文件让测试变绿。

浏览器验收：在仓库同级目录安装 `npm install --prefix ../qa-tools playwright`，启动 `python -m scripts.release_qa_server`，另一个窗口执行 `node scripts/release_browser.cjs`。默认使用本机 Edge，可通过 `QA_BROWSER` 指定浏览器可执行文件；这里只测试独立的 8013 端口虚拟库，不启动模型、不操作线上账户。截图和报告保存在仓库同级 `private/release-qa`，不能上传。

## 上传 GitHub

只上传压缩包中的 `Trusta` 源码目录，保留 `.gitignore` 和原作者 LICENSE。包中没有 `.git` 历史。不要从开发者原工作目录整体上传，也不要添加 `data`、`private`、`.env`、`.wrangler`、密钥或运行日志。

`deployment/wrangler.json` 已移除原开发者的 Cloudflare 账号、路由和源站，不能直接部署到其账户。部署目标、HTTPS 源站变量 `TRUSTA_ORIGIN` 和隧道需接收者自行配置；未配置源站时 API 返回未连接，不会转发给原开发者。源码保留历史兼容模块及实验工具，但不应把默认未启用的能力表述为已经部署成功。

复核打包需先将源码纳入自己的 Git 仓库，然后运行 `python scripts/package_release.py --check`；生成新的带清单源码包运行 `python scripts/package_release.py`。输出采用新目录，不覆盖旧包。检查文件名规则、已知本机秘密及常见凭据格式仍不能替代人工代码审阅和后续持续安全维护。
