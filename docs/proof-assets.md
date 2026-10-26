# 可选证明实验产物

GitHub Release 的 `TRUSTA-proof-assets.zip` 包含两个电路清单及清单逐项校验过的 WASM、公开证明密钥、验证密钥和 M1 R1CS/验证合约。源码和重建脚本均在仓库。证明密钥是公开计算材料，不是账户私钥或 API Key。

下载后先与 Release 的 SHA256SUMS.txt 核对，再解压到源码根目录。若已有 `data/zkp-dev-v1` 或 `data/anchor-integration/m1-artifacts`，先使用新的源码目录，避免覆盖原来的验证信任配置。

```powershell
npm --prefix crypto_trust ci
python -m pytest tests/test_privacy_proof.py tests/test_anchor_capability.py
```

开发机本轮验证：隐私证明 6 项、能力证明 19 项通过（子测试不另计）。M1 使用 snarkjs 官方摘要固定的公开 Phase 1，再进行单机开发 Phase 2；隐私电路使用单机开发 Phase 1/2。两份清单都明确 `production_ready: false`。这些产物不能证明生产级可信设置，也不能代替未提供的真实 FISCO 回执或历史模型评测。

重建需要 Node.js、Circom 2.2.3 和相应磁盘/内存。参见 `scripts/build_anchor_capability.py` 与 `scripts/build_privacy_proof.py --help`。重建会产生不同的开发密钥，应使用新输出目录，并相应更新自己的信任摘要。大体积 Phase 1 下载文件、初始 zkey、调试符号和 node_modules 不随源码上传。
