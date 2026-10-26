import{n as e,r as t,t as n}from"./jsx-runtime-C-U_F7Cb.js";import{a as r,i,l as a,n as o,r as s,t as c,u as l}from"./theme-BCHjS0TM.js";var u=t(),d=e(),f=`# Signed agent messaging\r
\r
The worst case for a multi-agent system is an agent that gets prompt-injected or compromised, impersonates another, alters messages or proposes things beyond its role — and afterwards nobody can say what happened. TRUSTA makes every message between agents **verifiable, traceable and non-repudiable**.\r
\r
![Figure 1: the AI can only propose; every step between agents is signed and verifiable](/figs/fig1-en.webp)\r
\r
## The six agents\r
\r
| Agent | Responsible for |\r
|---|---|\r
| Supervisor | Understanding intent, extracting parameters, summarising results |\r
| Planner | Turning a request into steps (a task graph) checked by a validator |\r
| Transaction | Queries and proposals about transfers, payees and balances |\r
| Finance | Statements, spending analysis, anomaly detection |\r
| Wealth | Product filtering, comparison, purchase and redemption proposals |\r
| Service | Card management, subscriptions, knowledge questions |\r
\r
A separate audit checkpoint worker produces signed checkpoints for the audit chain.\r
\r
**Agents can only propose.** Money moves only through a deterministic executor and a sealed execution contract; a compromised agent can't touch funds directly.\r
\r
## How each message is signed\r
\r
Each agent has its own **ECDSA P-256** identity with an encrypted private key. Agents exchange V3 signed message envelopes, and the receiver checks every field:\r
\r
| Mechanism | Stops |\r
|---|---|\r
| Separate key identity per agent; registered as an on-chain WeID for cross-institution work | Impersonating another agent |\r
| Canonical payload hash, task revision, 5-minute validity, one-time nonce, bound recipient | Tampering, replay, stale messages, misdelivery |\r
| Capability snapshot: a commitment to the sender's current permissions, rejected if it differs from the registry | Privilege escalation, quietly widened permissions |\r
| Communication edges: each task type only allows the planned (sender, receiver, message type) combinations | e.g. the Finance agent suddenly sending a “transfer proposal” |\r
| Hand-off evidence chain: the runtime signs every hand-off again and points to the evidence before it | Denial afterwards, reordered steps |\r
| Intent provenance: a hash of your words, how they were understood and the model call record go into the Supervisor's signed request | Not being able to show which sentence a proposal came from |\r
| Key rotation, revocation, identity suspension | Handling a leaked key |\r
\r
## Evidence chain and audit\r
\r
1. For every hand-off the runtime issues **hand-off evidence**: the full message envelope, input and output hashes, the hashes of the evidence it depends on, and hashes of each stage of the related money operation (proposal, authorisation, contract, verification, receipt).\r
2. Evidence and audit events go into an **append-only** audit hash chain: change any record and every later hash breaks.\r
3. A separate audit worker regularly seals new records with a **signed Merkle checkpoint**; any single record can be verified offline with its inclusion proof.\r
\r
## See it yourself\r
\r
- Turn on **Developer mode** under 设置 → 外观 (Settings → Appearance). Each reply gets “查看决策过程” (View decision process), listing every signed message between agents and re-verifying it on the spot (message signatures, evidence signatures, causal parents).\r
- Download a **signed evidence bundle** from a result card and verify it on the command line; see [Verifying evidence offline](#/evidence).\r
- Re-run the attack benchmark:\r
\r
\`\`\`bash\r
python -m benchmarks.security_benchmark --banking-version 5\r
\`\`\`\r
\r
See [Security benchmarks](#/benchmarks).\r
\r
## Managing keys\r
\r
\`\`\`bash\r
python -m scripts.manage_crypto_identity --agent transaction --rotate          # rotate an agent's key\r
python -m scripts.manage_crypto_identity --agent transaction --status SUSPENDED # suspend an identity\r
python -m scripts.manage_crypto_identity --revoke-key KEY_ID                    # revoke a key\r
\`\`\`\r
\r
After rotation the old key has a grace period (300 seconds by default, \`--grace-seconds\`); after that it's rejected.\r
`,p='# HTTP API\r\n\r\nThe web app, the terminal client and Feishu all work through the same local HTTP API, which you can use for your own interface too.\r\n\r\n## Conventions\r\n\r\n- Address: `http://127.0.0.1:8000`.\r\n- Everything except `/health` and static pages needs `Authorization: Bearer <token>`. The token is printed at start-up and saved in `data/api.token` by default; paired phones use their own device tokens.\r\n- The server checks `Host` and `Origin`; the customer identity is decided server-side and clients **cannot** send a `user_id`.\r\n- POST bodies are `Content-Type: application/json`.\r\n- Amounts are always **integer minor units** of the account currency (fen for CNY); there is no implicit currency conversion.\r\n\r\n## Chat\r\n\r\n| Method | Path | Purpose |\r\n|---|---|---|\r\n| POST | `/api/chat/sessions` | Create a session |\r\n| GET | `/api/chat/sessions/{sid}` | Read a session: messages, current plan, pending cards (for reconnecting) |\r\n| POST | `/api/chat/sessions/{sid}/messages` | Send a message |\r\n| POST | `/api/chat/sessions/{sid}/actions/{action_id}/decision` | Decide on a confirmation card |\r\n| POST | `/api/chat/sessions/{sid}/actions/{action_id}/sms` | Send a simulated SMS code for a red card |\r\n| POST | `/api/chat/sessions/{sid}/interrupt` | Interrupt the current plan |\r\n| POST | `/api/chat/sessions/{sid}/close` | Close the session |\r\n\r\n### Sending a message\r\n\r\n```json\r\nPOST /api/chat/sessions/{sid}/messages\r\n{\r\n  "message_id": "m_01J…",\r\n  "revision": 3,\r\n  "text": "给我妈转两千，备注生活费"\r\n}\r\n```\r\n\r\n- `message_id` is generated by the client (1–64 characters); retrying with the same ID returns the original result without reprocessing.\r\n- `revision` is the version from the previous response; a mismatch returns `CHAT_STALE`.\r\n- `Accept: text/event-stream` streams Server-Sent Events; `Accept: application/json` returns once the whole turn is done.\r\n\r\nSSE events include `turn.started`, `guard.result`, `intent.recognized`, `plan.created` / `plan.updated`, `tool.started` / `tool.finished`, `message.delta`, `card`, `turn.completed` and `turn.failed`. Treat the full result in `turn.completed` as final.\r\n\r\n### Deciding on a card\r\n\r\n```json\r\nPOST /api/chat/sessions/{sid}/actions/{action_id}/decision\r\n{\r\n  "action_hash": "sha256:…",\r\n  "approve": true,\r\n  "verification": { "method": "SMS", "code": "123456" }\r\n}\r\n```\r\n\r\n`action_hash` must match the card exactly; `verification` is only needed for red operations (`TOTP` or `SMS`).\r\n\r\n## Tasks (lower level)\r\n\r\nUnderneath the chat layer is the task API, where every money action lands with its hash binding, expiry and anti-replay rules intact:\r\n\r\n| Method | Path | Purpose |\r\n|---|---|---|\r\n| POST | `/api/tasks` | Create a task, e.g. `{"text":"给张三转 2000 元"}` |\r\n| GET | `/api/tasks` | Summary of the customer\'s tasks |\r\n| GET | `/api/tasks/{id}` | Status, task graph, authorisation and evidence |\r\n| POST | `/api/tasks/{id}/authorize` | Authorise: `{"action_hash":"…","approve":true}` |\r\n| GET | `/api/balance` | Account balance |\r\n| GET | `/api/transactions?account_id=…&month=YYYY-MM` | Transactions for an account and month |\r\n| GET | `/api/audit` | Whether the audit chain is intact: `{"valid": true}` |\r\n| GET | `/api/audit/proof` | Merkle inclusion proof for an audit record |\r\n\r\nAn HTTP success doesn\'t mean the money moved; always check the task status:\r\n\r\n| Status | Meaning |\r\n|---|---|\r\n| `WAITING_USER` | Waiting for confirmation or missing details |\r\n| `COMPLETED` | Settled, and the bank-side state was verified |\r\n| `BLOCKED` | Stopped by a rule or safety gate |\r\n| `CANCELLED` | Declined by the user |\r\n| `FAILED` | Failed before execution or in the bank transaction |\r\n| `MANUAL_REVIEW` | May have executed and needs a human check — **do not repeat the transfer** |\r\n\r\n## Errors\r\n\r\n| Status | Meaning |\r\n|---|---|\r\n| 400 | Input or safety validation failed |\r\n| 403 | Identity, origin or ownership refused |\r\n| 404 | Unknown endpoint |\r\n| 500 | Unclassified error; refresh the original task\'s status instead of starting a new money operation |\r\n\r\nThere is no endpoint for clients to write to the bank directly, no execution endpoint for agents, and no automatic retry of money writes.\r\n\r\nThe full protocol is in `docs/chat-protocol-v1.md` and `docs/api.md` in the repository.\r\n',ee=`# Authorisation tiers\r
\r
TRUSTA puts every operation into one of three tiers. The backend policy engine decides the tier from bank rules; neither the model nor the app can set or change it.\r
\r
| Tier | How it's authorised | Typical operations |\r
|---|---|---|\r
| Green | Runs directly | Balances, spending, subscriptions, comparing investments, the risk questionnaire |\r
| Yellow | You tap Confirm on the card | Transfers, freezing a card, cancelling a subscription or direct debit, locking wish-fund money, updating your risk level |\r
| Red | Confirm + SMS or authenticator code | Large transfers, new payees, reporting a card lost and cancelling it, unfreezing, PIN reset, raising a limit, enabling a card control, buying or redeeming investments |\r
\r
## When a transfer turns red\r
\r
Any one of these requires a code:\r
\r
- A single amount of **¥5,000** or more (\`TRUSTA_HIGH_RISK_CENTS\`).\r
- Today's CNY transfers would exceed **¥1,000** in total (\`TRUSTA_DAILY_TRANSFER_CENTS\`).\r
- **3** transfers already in the last **10 minutes**.\r
- **¥500** or more to a payee added in the last 24 hours.\r
- Any foreign-currency transfer.\r
\r
Cards and other operations: unfreezing, reporting lost, cancelling a lost report, resetting a PIN, adding a payee, raising a spending limit, enabling a card control, and any amount of ¥5,000 or more are red. Under the \`competition\` safety profile, buying and redeeming investments are red too.\r
\r
## Codes\r
\r
- Use an authenticator code (TOTP) or an SMS code. In demo mode SMS is simulated and the code appears on the page's “simulated phone”.\r
- SMS codes are valid for **5 minutes**, allow **3** attempts and only work for that one operation.\r
- **5** failed verifications in a row lock the account for safety (\`TRUSTA_AUTH_FAILURE_LIMIT\`).\r
- Enter codes only on the confirmation card, never in chat.\r
\r
## Always refused\r
\r
Whatever the tier, these are refused outright: unknown payee, frozen source account, insufficient balance, account state changed since the card was created (preconditions differ), or transfer protection active.\r
\r
## 24-hour transfer protection\r
\r
If something feels wrong, say “开启24小时转账保护” (turn on 24-hour transfer protection). While it's on, transfers, new payees, wish-fund orders and investment purchases are all blocked, and only bank staff can lift it after checking with you (it needs the security operator token).\r
\r
## In Feishu\r
\r
Yellow operations can be confirmed on the Feishu card. Red operations come with a link back to the TRUSTA web app to finish verification. See [Feishu](#/feishu).\r
`,te=`# Security benchmarks\r
\r
TRUSTA ships a repeatable attack benchmark that checks whether multi-agent messaging and the execution chain stop forgery and tampering.\r
\r
\`\`\`bash\r
python -m benchmarks.security_benchmark --banking-version 5\r
\`\`\`\r
\r
Results are written as JSON (\`docs/phase4-security-benchmark.json\` by default; change it with \`--output\`). \`docs/phase5-security-benchmark.json\` in the repository is the latest formal run.\r
\r
## Results\r
\r
**18 attack classes, 5 runs each — 90 attempts, all blocked, 0 unintended transactions; 0 of 135 legitimate messages wrongly rejected.**\r
\r
| Attack | What it tries |\r
|---|---|\r
| Forged agent identity | Sending as an identity not in the registry |\r
| Invalid signature | A signature that doesn't match the message |\r
| Payload tampering | Changing the message after signing |\r
| Replay | Resending a message already used |\r
| Expired message | A message past its validity |\r
| Revoked key | Signing with a revoked key |\r
| Old key outside grace | Using the old key after rotation |\r
| Capability escalation | Claiming a capability the agent doesn't have |\r
| Capability snapshot tampering | Altering the permission commitment in a message |\r
| Unauthorised tool call | Calling a tool outside the plan |\r
| Authorisation hash mismatch | An authorisation that doesn't match the operation |\r
| Duplicate execution | Executing the same money operation twice |\r
| Audit event tampering | Altering an audit record |\r
| Merkle leaf tampering | Altering a proven record |\r
| Invalid Merkle proof | A forged inclusion proof |\r
| Checkpoint tampering | Altering a signed checkpoint |\r
| Anchor root mismatch | A checkpoint that doesn't match the anchored root |\r
| Signature algorithm downgrade | Coaxing the system into a weaker algorithm |\r
\r
## Performance\r
\r
| Operation | Median | P95 |\r
|---|---|---|\r
| Sign a message | 15.1 ms | 22.5 ms |\r
| Verify a message | 5.5 ms | 9.0 ms |\r
| Produce a checkpoint | 16.7 ms | 31.2 ms |\r
\r
Environment: Windows 11, Python 3.13, \`cryptography\` 47. Verification covers the signature, identity, capabilities and task context; a checkpoint covers whole-chain validation, Merkle batching, signing and persistence.\r
\r
## Six-scenario closed-loop audit\r
\r
\`\`\`bash\r
python -m benchmarks.scenario_audit\r
\`\`\`\r
\r
Runs **49** end-to-end checks across transfers, spending, investments, cards, subscriptions and cross-scenario plans.\r
\r
## Limits\r
\r
- These are local, controlled attacks — not a production penetration test, and not an estimate of the probability of being secure.\r
- They use a synthetic sandbox bank and audit records; timings depend on the host's filesystem and SQLite.\r
- Passing every test doesn't prove there are no unknown vulnerabilities.\r
`,ne=`# Changelog\r
\r
## 2026-10-25\r
\r
- Landing page: ink-fluid hero, product demo, trust layers, measured results and quick start; Chinese and English.\r
- Documentation site, including an Integrations page.\r
- Figures 1 and 2 redrawn (Chinese and English) to tell problem → full chain → measured results.\r
- Landing page: plain-language measured results, integrations section, light/dark switch; the demo now plays itself.\r
- One-line installers (Windows / macOS / Linux), \`start.sh\`, double-click \`TRUSTA.cmd\`.\r
- Windows portable package and automated build.\r
- Fix: \`requirements.txt\` now lists everything the server needs at start-up, so clean installs no longer fail.\r
\r
## 2026-10-24\r
\r
- Web and phone app: chat home, interactive cards, overview and records, feature switches, settings.\r
- Interactive water background, liquid-glass interface, new icon; light and dark follow the system.\r
- The decision trace moved behind developer mode.\r
- Feishu links for red operations open on phones too; conversations are named by what they did.\r
- README: figures for trusted multi-agent communication and cross-institution collaboration.\r
\r
## 2026-10-23\r
\r
- Access modes: this computer only / local network / tunnel; one-time phone pairing with device tokens.\r
- Feishu persistent-connection worker and binding codes.\r
- Setup wizard: validates pasted secrets; probe results show details.\r
- Chat text can never stand in for a confirmation card; Feishu rule-confirmation buttons.\r
\r
## 2026-10-22\r
\r
- Capability registry and setup wizard; automation rules engine; trip manager.\r
- Untrusted-text quarantine; anti-fraud cooling-off; money operations run one at a time.\r
- Six-scenario closed-loop audit.\r
\r
## 2026-10-21\r
\r
- Unified chat API and card protocol.\r
- Signed multi-agent messaging and the terminal client.\r
`,re=`# Conversations and cards\r
\r
Each TRUSTA reply is a short text plus one or more cards. The text explains; the cards are where you act.\r
\r
## Card types\r
\r
| Card | When it appears | What you can do |\r
|---|---|---|\r
| Clarify | Something required is missing, such as the amount | Answer, or tap an option |\r
| Confirmation | Any write operation on money or cards | Check it, edit the amount, tap Confirm or Decline; red operations also need a code |\r
| Report | Read-only queries: spending, investments, subscriptions | Tap a category for details, filter, compare |\r
| Risk alert | A scam script, injection or anomaly is detected | See why; switch on 24-hour transfer protection |\r
| Result | After an operation runs | See the bank's verification and receipt; export a signed evidence bundle |\r
| Plan | One request with several steps | Follow each step's status, interrupt at any time |\r
| Questionnaire | Risk assessment | Answer question by question; scoring is deterministic |\r
\r
## Confirmation cards\r
\r
A confirmation card is the only way to authorise anything:\r
\r
- The card is bound to an \`action_hash\` and covers exactly what it shows: amount, counterparty, account.\r
- It's valid for **15 minutes**. If it expires or anything changes, a new one is created.\r
- Typing “confirm” or “ok” in chat executes nothing; it just points you to the card.\r
- Before executing, the bank re-checks preconditions such as the balance and account version, and refuses if they no longer match.\r
\r
## Back-and-forth\r
\r
Add or change details the way you would with a person:\r
\r
- “Transfer to Zhang San” → asks for the amount → “500” → confirmation card\r
- “Make it 800” → a new confirmation card\r
- “Forget it” → the unexecuted card is voided\r
\r
## Multi-step plans\r
\r
A request like “I'm going to Japan for 5 days next week, sort it out” becomes a plan: check the balance, redeem an investment, enable overseas payments, switch them off after the trip, warn when over budget.\r
\r
- Every step that touches money or cards gets its own confirmation card and waits for you.\r
- Say “stop” to interrupt: unauthorised steps are cancelled; executed steps aren't rolled back and are listed in the reply.\r
\r
## Undo\r
\r
These can be reversed with a new operation (which you still confirm): freeze ↔ unfreeze, report lost ↔ cancel lost report, limit changes (back to the old value), card controls (back to the old setting), wish-fund locks (release), investment purchase ↔ redemption.\r
\r
These can't be undone directly:\r
\r
- A completed transfer can't be pulled back by the bank alone; ask the payee to return it.\r
- A paid merchant order needs a refund from the merchant.\r
- A cancelled subscription has to be renewed with the merchant.\r
\r
## Human hand-off\r
\r
Saying “转人工” (talk to a person) hands the conversation to a human: your messages stop going to the model and join a human queue; “取消转人工” returns you to the assistant. Human agents have no authorisation endpoint and can't confirm money operations for you.\r
\r
## Automation rules\r
\r
Set “when … then …” rules in a sentence, for example “remind me when takeaway goes over ¥800 a month” or “when my salary lands, put ¥1,000 in my wish fund”.\r
\r
- Triggers: a time, an incoming payment, balance below a value, a category over budget, a large purchase.\r
- Actions: remind, transfer, save to wish fund, buy an investment, freeze a card, switch off a card control, hand off to a human.\r
- A rule only takes effect after you confirm it; when it fires, money operations still wait for your confirmation one by one.\r
\r
## Bills, Wealth and Everyday services pages\r
\r
Three pages in the side navigation show things at a glance:\r
\r
- **Bills & subscriptions**: fixed monthly spend, a 30-day timeline of upcoming charges, and registered subscriptions and direct debits. TRUSTA also looks for repeating charges in your history: the same merchant and amount, 25–35 days apart, three times. Those appear as "possible subscriptions" and you are told once in the chat. You can confirm one (you will then be reminded 3 days before each charge), mark it as unknown (you get stop-loss options such as freezing the card or reaching a person), or dismiss it.\r
- **Wealth**: reference quotes for gold and USD, EUR, JPY and HKD against CNY (every number shows its source and time; refresh any time; when offline the last value is shown and labelled), your risk level, your holdings, and the bank's product shelf with term, minimum, liquidity, benchmark and risk notes. Products above your risk level are shown but cannot be bought. "为你推荐" keeps three months of your recent spending as a cash reserve and splits the rest by risk level, spreading across issuers; asking "根据我的消费推荐理财" in chat gives the same plan.\r
- **Everyday services**: official entry points for flights, trains, hotels, shows, films, utility bills and social insurance. Say "下周五北京到上海的机票" or "上海最近有什么演唱会" and the city and date are taken from your words into a card that opens the results directly (Ctrip, 12306, Damai and others); if the departure city is missing, you are asked. Only allow-listed sites are linked; the bank takes no part in the purchase.\r
\r
Every cancel, buy or redeem button on these pages goes back into the chat as a confirmation card, under the same authorisation as asking in words. TRUSTA does not recommend individual stocks and never promises returns.\r
\r
## Developer mode\r
\r
Turn on Developer mode under 设置 → 外观 (Settings → Appearance) and each reply gets “查看决策过程” (View decision process): every signed message between agents in that turn, re-verified on the page (message signatures, evidence signatures, causal parents). Result cards let you download a signed evidence bundle; see [Verifying evidence offline](#/evidence).\r
`,m="# Command line\r\n\r\nRun every command from the project folder. If you used an installer, activate the virtual environment first (`source .venv/bin/activate`, or `.venv\\Scripts\\activate` on Windows), or replace `python` with `.venv/bin/python`.\r\n\r\n## Everyday\r\n\r\n| Command | Does |\r\n|---|---|\r\n| `./start.sh` / `.\\start.ps1` / double-click `TRUSTA.cmd` | Start the server and background workers |\r\n| `python -m scripts.setup` | Setup wizard |\r\n| `python -m scripts.setup --status` | Show the feature table |\r\n| `python -m scripts.setup --probe` | Check model, bank and Feishu connectivity, then show the feature table |\r\n| `python -m scripts.pair` | Phone pairing code |\r\n| `python -m scripts.pair --feishu` | Feishu binding code |\r\n| `python -m scripts.pair --devices` | List paired devices |\r\n| `python -m scripts.pair --revoke ID` | Revoke a device |\r\n\r\n## Chat in a terminal\r\n\r\n```bash\r\npython -m scripts.chat_cli             # connect to the running server\r\npython -m scripts.chat_cli --sandbox   # in-process server + throw-away database; data/ untouched\r\n```\r\n\r\nCommands inside the chat:\r\n\r\n| Command | Does |\r\n|---|---|\r\n| `/y N` / `/n N` | Confirm / decline card N |\r\n| `/sms N` | Send a simulated SMS code for red card N |\r\n| `/otp N CODE` | Confirm red card N with an SMS code |\r\n| `/totp N CODE` | Confirm red card N with an authenticator code |\r\n| `/stop` | Interrupt the current plan |\r\n| `/trace` | Show the decision chain of the last turn |\r\n| `/events` | List scheduled plans |\r\n| `/advance ID` | Run a scheduled plan now (demo mode only) |\r\n| `/quit` | Exit |\r\n\r\n## Verification and audit\r\n\r\n| Command | Does |\r\n|---|---|\r\n| `python -m scripts.verify_handoff_evidence BUNDLE --trusted-registry REGISTRY` | Verify a signed evidence bundle offline |\r\n| `python -m scripts.verify_audit_record PROOF --trusted-public-key KEY` | Verify one audit record's Merkle inclusion proof |\r\n| `python -m scripts.manage_crypto_identity --agent NAME --rotate` | Rotate an agent's key |\r\n| `python -m scripts.manage_crypto_identity --agent NAME --status SUSPENDED` | Suspend an agent identity |\r\n| `python -m scripts.manage_crypto_identity --revoke-key KEY_ID` | Revoke a key |\r\n\r\n## Tests and evaluation\r\n\r\n| Command | Does |\r\n|---|---|\r\n| `python -m pytest -q` | All automated tests (about 1,400) |\r\n| `python -m benchmarks.scenario_audit` | 49 closed-loop checks across six scenarios |\r\n| `python -m benchmarks.security_benchmark --banking-version 5` | The 18-class attack benchmark |\r\n\r\n## Background workers\r\n\r\nThe start script runs these for you:\r\n\r\n| Command | Does |\r\n|---|---|\r\n| `python -m scripts.audit_worker --watch` | Produces signed Merkle checkpoints |\r\n| `python -m scripts.scheduled_worker --watch` | Runs due plans (birthday orders, recurring transfers…) |\r\n| `python -m scripts.feishu_worker` | Feishu persistent connection |\r\n\r\n## Packaging\r\n\r\n```bash\r\npython -m scripts.build_portable --python-embed python-3.12.10-embed-amd64.zip --out dist\r\n```\r\n\r\nBuilds the Windows portable package `dist/TRUSTA-windows-x64.zip`. The repository's `Packages` GitHub Actions workflow downloads the embeddable Python, builds the package, starts it on Windows as a smoke test, and attaches it to the release when a `v*` tag is pushed.\r\n",h="# Configuration\r\n\r\nTRUSTA is configured with environment variables kept in `.env` in the project folder (written by the [setup wizard](#/setup) and ignored by git). You can also set them in the environment before starting; environment values win. Money amounts are in **cents (fen)**.\r\n\r\n## Model\r\n\r\n| Variable | Default | Meaning |\r\n|---|---|---|\r\n| `DEEPSEEK_API_KEY` | — | Model API key; empty means the rule engine is used |\r\n| `TRUSTA_CHAT_LLM_ENDPOINT` | `https://api.deepseek.com/chat/completions` | OpenAI-compatible endpoint |\r\n| `TRUSTA_CHAT_LLM_MODEL` | `deepseek-flash` | Model name |\r\n| `TRUSTA_CHAT_LLM_PROXY` | — | HTTPS proxy |\r\n| `TRUSTA_CHAT_LLM_TIMEOUT` | `30` | Per-call timeout (seconds) |\r\n| `TRUSTA_CHAT_LLM_CONCURRENCY` | `4` | Maximum concurrent calls |\r\n| `TRUSTA_CHAT_LLM_DAILY_CALLS` | `300` | Daily calls per user; once used up, the rule engine takes over for the day |\r\n| `TRUSTA_LLM_CONFIG` | — | Model configuration file used by evaluations |\r\n\r\n## Bank\r\n\r\n| Variable | Default | Meaning |\r\n|---|---|---|\r\n| `TRUSTA_BANK_CONFIG` | — | External bank sandbox config (`config/bank.*.local.toml`); empty means the local sandbox bank |\r\n| `TRUSTA_BANKING_VERSION` | `5` | Bank action set version |\r\n| `TRUSTA_DISABLED_FEATURES` | — | Comma-separated features to switch off, e.g. `wealth,trip` |\r\n\r\n## Access and channels\r\n\r\n| Variable | Default | Meaning |\r\n|---|---|---|\r\n| `TRUSTA_ACCESS_MODE` | `local` | `local` this computer only / `lan` local network / `tunnel` |\r\n| `TRUSTA_PUBLIC_HOST` | — | Public hostname in tunnel mode (no `https://`) |\r\n| `TRUSTA_LAN_HOST` | auto-detected | This computer's address in local-network mode |\r\n| `TRUSTA_PORT` | `8000` | Port used in Feishu “back to the app” links (the server itself always listens on 8000) |\r\n| `TRUSTA_API_TOKEN` | generated | Local access token; saved in `data/api.token` by default |\r\n| `TRUSTA_APP_URL` | derived from access mode | Address used by “back to the app” links in Feishu |\r\n| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | — | Feishu app credentials |\r\n| `FEISHU_MODE` | `longconn` | `longconn` persistent connection / `webhook` |\r\n| `FEISHU_VERIFICATION_TOKEN` / `FEISHU_ENCRYPT_KEY` | — | For webhook mode |\r\n| `FEISHU_USER_BINDINGS` | — | Operator-preset bindings, `open_id:owner,open_id:owner` |\r\n\r\n## Safety\r\n\r\n| Variable | Default | Meaning |\r\n|---|---|---|\r\n| `TRUSTA_SAFETY_PROFILE` | `competition` | `competition` strong verification / `legacy` |\r\n| `TRUSTA_DEMO_MODE` | `false` (`true` in the wizard) | Demo mode: simulated SMS codes shown, plans can be fast-forwarded |\r\n| `TRUSTA_HIGH_RISK_CENTS` | `500000` | A single amount at or above this is red (¥5,000) |\r\n| `TRUSTA_DAILY_TRANSFER_CENTS` | `100000` | Daily total above this is red (¥1,000) |\r\n| `TRUSTA_ANOMALY_LARGE_CENTS` | `100000` | Threshold for flagging large purchases |\r\n| `TRUSTA_ANOMALY_DUPLICATE_SECONDS` | `300` | Window for flagging possible duplicate charges |\r\n| `TRUSTA_AUTH_FAILURE_LIMIT` | `5` | Failed verifications in a row before a safety lock |\r\n| `TRUSTA_EXECUTION_FAILURE_LIMIT` | `3` | Failed executions in a row before a safety lock |\r\n| `TRUSTA_SECURITY_OPERATOR_TOKEN` | — | Bank staff token: lifting transfer protection, human hand-off |\r\n| `TRUSTA_STRONG_AUTH_SECRET` | — | Strong-auth passphrase for red operations under the `legacy` profile |\r\n\r\n## Signed messaging and audit\r\n\r\n| Variable | Default | Meaning |\r\n|---|---|---|\r\n| `TRUSTA_COMMUNICATION_VERSION` | `3` | Signed messaging protocol version; at 3 the audit and scheduled-plan workers start |\r\n| `TRUSTA_CRYPTO_KEY_DIR` | `data/trusta.keys` | Agent private key folder (a `.keys` folder named after the database) |\r\n| `TRUSTA_AGENT_TIMEOUT_SECONDS` | `20` | Per-agent timeout |\r\n| `TRUSTA_FINANCE_PROCESS_ENABLED` | `false` | Run the Finance agent as a separate process |\r\n| `TRUSTA_BLOCKCHAIN_ANCHOR_ENABLED` | `false` | Anchor audit checkpoints on chain |\r\n| `TRUSTA_DID_ENABLED` | `true` | On-chain identities for cross-institution work |\r\n| `TRUSTA_ZKP_ENABLED` | `false` | Zero-knowledge capability admission |\r\n| `TRUSTA_ZKP_ARTIFACT_DIR` / `TRUSTA_ZKP_MANIFEST_SHA256` | — | ZK artefact folder and manifest hash |\r\n\r\n## Data\r\n\r\n| Variable | Default | Meaning |\r\n|---|---|---|\r\n| `TRUSTA_DB` | `data/trusta.sqlite3` | Database path |\r\n\r\n`data/` holds the database, the root signing key (`signing.key`), agent keys and logs; `.env` holds your secrets. Never commit or share either.\r\n",g=`# Cross-institution collaboration: WeID · ZK admission · on-chain commitments\r
\r
When agents from several institutions need to work on something together — say, banks' agents cross-checking the same risk conclusion — local signatures aren't enough. How does the other side know who you are, whether you're qualified to take part, and whether the final conclusion was altered? On top of [signed agent messaging](#/agent-communication), TRUSTA adds a trust layer that can be checked publicly on a consortium chain.\r
\r
![Figure 2: identity, qualification and conclusion, all checkable on chain](/figs/fig2-en.webp)\r
\r
## The parts\r
\r
### On-chain identity: WeID\r
\r
Each collaborating agent registers a **WeID** (WeBank's open-source decentralised identity) on a **FISCO BCOS** consortium chain, and its P-256 message key is bound to that WeID. Identities can be registered, resolved, deactivated and restored. Collaboration rounds accept only on-chain WeIDs; if the chain is unavailable they refuse outright rather than falling back to a locally self-signed \`did:key\`.\r
\r
### M1: zero-knowledge capability admission\r
\r
An agent proves with **Groth16** that its score on a fixed evaluation set (an F1 computed from TP / FP / FN by a fixed formula) meets the policy threshold, **without revealing the evaluation details or its predictions**. The proof is bound to the policy, the epoch, a model commitment and the evaluation record; it can be revoked and it expires. Agents can't simply declare a score to get in.\r
\r
### M2: binding collaboration messages\r
\r
Beyond the V3 signature, collaboration messages are bound to the on-chain identity, the admission credential, the round and the epoch. Bad signatures, cross-round / cross-task / cross-epoch messages, revoked identities, wrong models and replays are all rejected.\r
\r
### OTC: full-window collection\r
\r
Collaboration is k-of-n: evidence is frozen only at the deadline, and the round is voided if fewer than k valid conclusions arrived. Late messages are kept for telemetry only.\r
\r
### M3: on-chain decision commitment\r
\r
The **Merkle root** of the conclusion and the member snapshot are written to the \`CollaborationAnchor\` contract and read back over two nodes' RPC endpoints. If a submission's outcome is unknown, it is recovered by looking up the original hash — never blindly resubmitted.\r
\r
## Important limits\r
\r
- On-chain identities and signatures grant **no bank write permission**; money operations still need the user's authorisation on a confirmation card.\r
- The current environment is a **single-host, 8-node test consortium chain** (chain ID 101); the two verification RPCs belong to two nodes on the same host and don't represent independent institutions.\r
- Groth16 uses a **development trusted setup** (single-host Phase-2), not a production MPC ceremony.\r
- The zero-knowledge circuit proves a restricted statistical relation; it doesn't run model inference inside the circuit.\r
\r
All of this is recorded in \`docs/ANCHOR_Integration_Final_Acceptance.md\` in the repository.\r
\r
## Registered agents\r
\r
| Agent | WeID |\r
|---|---|\r
| Finance | \`did:weid:101:0xa968103852c7eae1a245b77e98660730d8ccc3d3\` |\r
| Wealth | \`did:weid:101:0xa8fac68a926fb16debb085af40a1bb5d840df7de\` |\r
| Transaction | \`did:weid:101:0xf9fb420c820cf567b5250f816dd9a21c80f88c31\` |\r
\r
## Turning it on\r
\r
This layer is off by default. Start the test consortium chain in WSL or Linux first:\r
\r
\`\`\`bash\r
bash scripts/anchor_network_lifecycle.sh run\r
\`\`\`\r
\r
Related settings: \`TRUSTA_DID_ENABLED\`, \`TRUSTA_ZKP_ENABLED\`, \`TRUSTA_ZKP_ARTIFACT_DIR\`, \`TRUSTA_ZKP_MANIFEST_SHA256\`; see [Configuration](#/configuration). Third parties can re-verify a public evidence package with \`python -m scripts.verify_anchor_collaboration\`.\r
`,ie=`# Verifying evidence offline\r
\r
Every TRUSTA result card can export a **signed evidence bundle**. Whoever holds it can check — without trusting the server, and without contacting the bank or the model — that the hand-offs between agents for that request really happened, completely and in order.\r
\r
## Export\r
\r
1. Turn on Developer mode under 设置 → 外观 (Settings → Appearance).\r
2. On a result card, open “查看决策过程” (View decision process) and click **下载证据包** (Download evidence bundle) to get \`trusta-evidence-xxxxxxxx.json\`.\r
\r
## Verify\r
\r
\`\`\`bash\r
python -m scripts.verify_handoff_evidence trusta-evidence-xxxxxxxx.json --trusted-registry registry.json\r
\`\`\`\r
\r
On success it prints:\r
\r
\`\`\`json\r
{"verified": true, "scope": "RUNTIME_CAUSAL_ATTESTATION_NOT_BANK_AUTHORIZATION"}\r
\`\`\`\r
\r
and exits with 0. On failure \`verified\` is \`false\` and the exit code is 1. Changing any byte of the bundle makes verification fail.\r
\r
The repository includes a sample you can try right away:\r
\r
\`\`\`bash\r
python -m scripts.verify_handoff_evidence docs/agent-communication-demo.json --trusted-registry docs/agent-communication-trusted-registry.json\r
\`\`\`\r
\r
## What it checks\r
\r
- The signature on every piece of hand-off evidence, and the signer's identity and key in the registry.\r
- The causal parent links between pieces of evidence: unknown or missing parents, duplicates, reordering and cross-task mixing are rejected.\r
- That identities, capability commitments and key ownership weren't swapped.\r
- The Merkle inclusion proofs of the audit records.\r
\r
## What it doesn't check\r
\r
- As \`scope\` says, this is a **runtime causal attestation**, not a bank authorisation. Authorisation for money operations comes from your decision on the confirmation card.\r
- Hidden payloads aren't exported; matching input and output hashes don't prove the content was semantically right.\r
\r
## Where the registry comes from\r
\r
\`--trusted-registry\` is the registry of agent public keys and capabilities. Verifiers should **obtain and pin it independently** (for example, fetch it once from a trusted channel and keep it), never read it from the bundle itself. A historical snapshot only describes that moment; it doesn't prove a key hasn't been revoked since.\r
`,_=`# FAQ\r
\r
## Will it touch my real bank account?\r
\r
Not by default. TRUSTA connects to a local virtual bank sandbox, and all demo data is fictional. Connecting a real bank needs an adapter configured under \`config/\` and authorisation on the bank's side.\r
\r
## Does it work without a language model?\r
\r
Yes. Without a model it uses the rule engine, which understands standard phrasings such as “给张三转500元” (send ¥500 to Zhang San) or “这个月花了多少钱” (how much did I spend this month). With a model it handles more casual wording and multi-step requests.\r
\r
## Can the model see my balance?\r
\r
No. The model sees your words, dates and resource names (such as payee or product names) — never balances, statements, card numbers or codes, and long digit strings are masked before sending. Numbers in replies are filled in from bank queries and checked against that turn's results.\r
\r
## I typed “confirm” in chat. Why didn't anything happen?\r
\r
By design. Authorisation only happens on a confirmation card and is bound to exactly what the card shows. That way, even a manipulated model or someone else at your chat window can't move money with a sentence.\r
\r
## The confirmation card expired.\r
\r
Cards are valid for 15 minutes. Ask again to get a fresh one.\r
\r
## Where do I find the code?\r
\r
In demo mode SMS is simulated: tap “发送验证码” (send code) on the confirmation card and the code appears on the page's simulated phone. An authenticator code works too.\r
\r
## The web page says I don't have access.\r
\r
Open the full link printed in the start-up window (the one with \`#token=…\`). Phones need to be [paired](#/mobile) first.\r
\r
## My phone can't open it.\r
\r
Check three things: access is set to local network and TRUSTA was restarted; the phone and computer are on the same Wi-Fi or hotspot; the phone has been paired with a code. Some public Wi-Fi networks isolate devices — try a phone hotspot.\r
\r
## The Feishu bot doesn't reply.\r
\r
Check \`data/feishu-worker.log\` for a successful connection; make sure \`requirements-channels.txt\` is installed; check that the persistent connection is selected and a version is published on the Feishu Open Platform; make sure you bound your account with \`python -m scripts.pair --feishu\`.\r
\r
## Windows says running scripts is disabled on this system.\r
\r
Start TRUSTA by double-clicking \`TRUSTA.cmd\`, which runs the start script with \`-ExecutionPolicy Bypass\`. Or in PowerShell:\r
\r
\`\`\`powershell\r
powershell -ExecutionPolicy Bypass -File .\\start.ps1\r
\`\`\`\r
\r
## Installing dependencies is slow or fails.\r
\r
From mainland China, a pip mirror helps, for example:\r
\r
\`\`\`bash\r
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple\r
\`\`\`\r
\r
then run the install command again.\r
\r
## Where is my data, and how do I uninstall?\r
\r
Everything lives in the TRUSTA folder: \`data/\` holds the database, keys and logs; \`.env\` holds your configuration. Delete the folder to uninstall completely.\r
\r
## Do I need the blockchain and zero-knowledge parts?\r
\r
No. That layer is for agents from several institutions working together and is off by default. On a single machine, signed messaging, the evidence chain and the audit trail are already fully active. See [Cross-institution collaboration](#/cross-institution).\r
`,v=`# Feishu\r
\r
Connect TRUSTA as a Feishu (Lark) bot and you can chat with it in Feishu. The default is a **long connection**: TRUSTA connects out to Feishu, so no public address is needed.\r
\r
## 1. Create an app on the Feishu Open Platform\r
\r
1. Create a custom app and enable the **Bot** capability.\r
2. Under Events & Callbacks, choose **receive events through a persistent connection**.\r
3. Add the \`im.message.receive_v1\` event and card callbacks.\r
4. Publish a version.\r
5. Find the **App ID** (starts with \`cli_\`) and **App Secret** under Credentials & Basic Info.\r
\r
## 2. Add it to TRUSTA\r
\r
\`\`\`bash\r
pip install -r requirements-channels.txt   # the long connection needs lark-oapi\r
python -m scripts.setup\r
\`\`\`\r
\r
Answer \`y\` to “connect a Feishu bot”, fill in the App ID and App Secret, and pick \`longconn\`. Restart TRUSTA; the window shows that the Feishu long connection has started, and logs go to \`data/feishu-worker.log\`.\r
\r
## 3. Bind your account\r
\r
A Feishu user must be bound before acting as you in TRUSTA:\r
\r
\`\`\`bash\r
python -m scripts.pair --feishu\r
\`\`\`\r
\r
It prints a message like “绑定 123456”. Send that message to the bot in a private chat. The code is valid for 5 minutes and works once.\r
\r
## What you can do in Feishu\r
\r
- All queries and conversation.\r
- **Yellow** operations: confirm on the Feishu card.\r
- **Red** operations: Feishu can't take codes, so the bot sends a link that opens the same conversation in the TRUSTA web app to finish verification. The link uses the address from your [access setting](#/setup) (local network or tunnel), so it opens on your phone too.\r
\r
## Webhook mode\r
\r
If you already have a public address, choose \`webhook\`: Feishu pushes events to \`POST /api/channels/feishu/webhook\`. You'll also need the Verification Token and, optionally, the Encrypt Key.\r
`,y="# Installation\r\n\r\nThere are four ways to install TRUSTA; they end up the same, so pick whichever suits you. Every option installs into a single folder and leaves your system untouched.\r\n\r\n| Option | Best for | Needs |\r\n|---|---|---|\r\n| Portable package | Just using it, without installing Python (Windows) | Nothing |\r\n| One-liner | Most people | Python 3.11+ |\r\n| From source | Changing code, running tests, wiring in your own bank or model | Python 3.11+, git |\r\n\r\n## Portable package (Windows)\r\n\r\n1. Download `TRUSTA-windows-x64.zip` from the [releases page](https://github.com/piggyz666/Trusta/releases).\r\n2. Unzip it anywhere, for example `D:\\TRUSTA`.\r\n3. Double-click `TRUSTA.cmd`. The first run opens the [setup wizard](#/setup); after that it starts straight away.\r\n\r\nThe zip carries its own Python runtime (under `runtime\\`) and every dependency, so nothing else needs installing. Data lives in the `data\\` folder next to it; deleting the folder uninstalls TRUSTA completely.\r\n\r\nOn macOS and Linux, use the one-liner (next section).\r\n\r\n## One-liner\r\n\r\n**Windows (PowerShell)**\r\n\r\n```powershell\r\nirm https://raw.githubusercontent.com/piggyz666/Trusta/main/install.ps1 | iex\r\n```\r\n\r\n**macOS / Linux**\r\n\r\n```bash\r\ncurl -fsSL https://raw.githubusercontent.com/piggyz666/Trusta/main/install.sh | bash\r\n```\r\n\r\nThe installer:\r\n\r\n1. Checks for Python 3.11+. On Windows, if it's missing, it offers to install Python 3.12 for the current user with `winget`; on macOS / Linux it explains how to install it and stops.\r\n2. Downloads the code to `~/TRUSTA` (`%USERPROFILE%\\TRUSTA` on Windows), with `git clone` when git is available and a source archive otherwise.\r\n3. Creates a private virtual environment `.venv` in that folder and installs dependencies.\r\n4. Opens the setup wizard.\r\n\r\nEnvironment variables you can set first:\r\n\r\n| Variable | Effect | Default |\r\n|---|---|---|\r\n| `TRUSTA_HOME` | Install folder | `~/TRUSTA` |\r\n| `TRUSTA_BRANCH` | Which branch to download | `main` |\r\n| `TRUSTA_NO_SETUP` | `1` skips the setup wizard | — |\r\n\r\nRunning the same command again updates the code (`git pull` for git installs) and keeps your configuration and data.\r\n\r\n## From source\r\n\r\n```bash\r\ngit clone https://github.com/piggyz666/Trusta.git && cd Trusta\r\npython -m venv .venv\r\nsource .venv/bin/activate            # Windows: .venv\\Scripts\\activate\r\npip install -r requirements.txt -r requirements-channels.txt\r\npython -m scripts.setup\r\n./start.sh                           # Windows: .\\start.ps1\r\n```\r\n\r\n- `requirements.txt` is what TRUSTA needs to run.\r\n- `requirements-channels.txt` is optional: Feishu long connection and terminal QR codes.\r\n- `requirements-llm.txt`, `requirements-phase6.txt` and `requirements-evaluation.txt` are for evaluation and external audit integrations; everyday use doesn't need them.\r\n\r\nAfter changing the web app, rebuild it (needs Node.js):\r\n\r\n```bash\r\ncd frontend-app\r\nnpm install\r\nnpm run build\r\n```\r\n\r\nThe build lands in `frontend/dist` and is served by the backend.\r\n\r\n## Starting and stopping\r\n\r\n| System | Start |\r\n|---|---|\r\n| Windows | Double-click `TRUSTA.cmd`, or `.\\start.ps1` in PowerShell |\r\n| macOS / Linux | `./start.sh` |\r\n\r\nThe start script runs the API server, the audit checkpoint worker and the scheduled-plan worker (birthday orders, recurring transfers and so on), plus the Feishu worker when a long connection is configured. Worker logs go to `data/*.log`. Closing the window or pressing `Ctrl+C` stops everything.\r\n\r\nThe start script picks Python in this order: the `TRUSTA_PYTHON` environment variable → the portable package's `runtime/python` → the installer's `.venv` → `python` on your PATH.\r\n\r\n## Uninstalling\r\n\r\nTRUSTA only writes to its own folder. Delete the folder; back up `data/` (database and keys) and `.env` (your configuration) first if you need them.\r\n",b=`# Integrations\r
\r
At its core TRUSTA is one trusted execution chain: the AI only proposes, agents hand off with signatures, and you authorise money movements. That chain can be reached from several channels, use different models and banks, and anchor its evidence on chain. This page lists only integrations that really work, with how far each was verified:\r
\r
- **Tested live**: run against a real service or network.\r
- **Local tests**: implemented and passing local tests, not yet connected to the official environment.\r
- **Built in**: part of TRUSTA itself, no outside service needed.\r
\r
## Channels\r
\r
Every channel shares the same conversation service and the same authorisation rules.\r
\r
| Integration | Notes | Status |\r
|---|---|---|\r
| Web | Desktop browser: interactive cards, overview, settings | Tested live |\r
| Phone | Pair once by QR on your network; add to home screen; see [Phone access](#/mobile) | Tested live |\r
| Feishu bot | Persistent connection, no public URL; yellow actions confirmed in-card, red ones finished in the web app; see [Feishu](#/feishu) | Tested live |\r
| Terminal | \`python -m scripts.chat_cli\`: chat, confirm and inspect the decision chain | Tested live |\r
| HTTP API | REST + SSE streaming for your own interface; see [HTTP API](#/api) | Tested live |\r
\r
## Models\r
\r
Models only understand and propose; whichever you use, the authorisation rules and signature chain stay the same.\r
\r
| Integration | Notes | Status |\r
|---|---|---|\r
| DeepSeek | Default conversation model \`deepseek-flash\` | Tested live |\r
| OpenAI-compatible models | Enter an endpoint and model name in the setup wizard | Built in |\r
| Kimi | \`kimi-k2.6\`, really called in the shared 40-scenario evaluation | Tested live |\r
| MiMo | \`mimo-v2.6-flash\`, really called in the shared evaluation | Tested live |\r
| Gemini | \`gemini-3.1-flash-lite\`, completed a transfer end to end on the local bank in evaluation | Tested live |\r
| GLM | \`glm-4-flash\`, really called in the shared evaluation | Tested live |\r
| Rule engine | Works with no model; understands standard phrasings | Built in |\r
\r
> The shared evaluation uses the same frozen prompt, business contract and 40 scenarios (20 normal, 20 attacks). Results differ a lot between models; the raw results are kept in \`docs/LLM_Final_Live_Acceptance.md\` and \`docs/LLM_Integration_Planning_Final_Acceptance.md\` in the repository.\r
\r
## Banks\r
\r
TRUSTA enables features based on what is actually connected and passes its checks.\r
\r
| Integration | Notes | Status |\r
|---|---|---|\r
| Local virtual bank | All six scenarios incl. incoming-payment push; all data fictional | Built in |\r
| Revolut sandbox | Official sandbox: real accounts and transactions read back, plus one individually authorised 0.01 EUR payment | Tested live |\r
| Starling | Adapter and request signing implemented, passing local protocol tests; not yet called against the official sandbox | Local tests |\r
\r
To connect an external bank sandbox, write a \`config/bank.*.local.toml\` based on \`config/bank.*.example.toml\` and choose an external bank at the bank step of the [setup wizard](#/setup).\r
\r
## Trust infrastructure\r
\r
| Integration | Notes | Status |\r
|---|---|---|\r
| ECDSA P-256 | A key per agent, signing every message; see [Signed agent messaging](#/agent-communication) | Built in |\r
| FISCO BCOS + WeID | Consortium-chain identity and the \`CollaborationAnchor\` contract; see [Cross-institution collaboration](#/cross-institution) | Tested live (single-host 8-node test chain) |\r
| Groth16 | Zero-knowledge admission proofs, really generated and verified | Tested live (development trusted setup) |\r
| Ethereum Sepolia | Audit roots written to the public testnet; public acceptance passed | Tested live (testnet, not mainnet) |\r
| MetaMask | Transactions signed in the wallet; the key never leaves it | Tested live |\r
\r
## Network and automation\r
\r
| Integration | Notes | Status |\r
|---|---|---|\r
| LAN pairing | One-time pairing codes, a token per device, revocable | Tested live |\r
| Cloudflare Tunnel | Public access if you already run a tunnel | Built in |\r
| Automation rules | “When … then …”: 5 triggers (a time, an incoming payment, balance below a value, a category over budget, a large purchase) × 7 actions (remind, transfer, save to wish fund, buy an investment, freeze a card, switch off a card control, hand off to a human); money actions still need each confirmation | Built in |\r
| Scheduled plans | Birthday orders, recurring transfers and more, started by a background worker when due and confirmed by you | Built in |\r
\r
## Adding a channel or a bank\r
\r
- New channel: follow \`backend/channels/feishu.py\` — pass messages to the unified chat endpoint \`/api/chat\` and render confirmation cards as that channel's interactive cards. A channel can never bypass the confirmation card.\r
- New bank: follow the adapters in \`backend/bank_sdk/\` and implement the read and execute interfaces; TRUSTA lights up the matching features from its capability checks.\r
`,x=`# Phone access\r
\r
The web app and the phone app are the same pages, adapting to the screen. By default TRUSTA only opens on the computer it runs on; to use a phone, switch access to local network or tunnel and pair once.\r
\r
## 1. Turn on local-network access\r
\r
\`\`\`bash\r
python -m scripts.setup\r
\`\`\`\r
\r
Choose **local network** at the access step, then restart TRUSTA.\r
\r
## 2. Pair your phone\r
\r
Either way works:\r
\r
- **In the web app**: open 设置 → 访问与设备 (Settings → Access & devices), generate a pairing code and scan it with your phone.\r
- **In a terminal**:\r
\r
\`\`\`bash\r
python -m scripts.pair\r
\`\`\`\r
\r
It shows the pairing address, a QR code (when the \`qrcode\` package is installed) and a 6-digit code. Put the phone on the same Wi-Fi or hotspot, then scan or open the address in the phone's browser. The code is valid for 5 minutes and works once.\r
\r
Once paired, the phone keeps its own device token and opens directly from then on. Use the browser's “Add to Home Screen” to run it full-screen like an app.\r
\r
## Managing devices\r
\r
\`\`\`bash\r
python -m scripts.pair --devices        # list paired devices\r
python -m scripts.pair --revoke DEVICE  # revoke one\r
\`\`\`\r
\r
You can also view and revoke devices under 设置 → 访问与设备 (Settings → Access & devices).\r
\r
## Away from your network\r
\r
If you already have a public address such as a Cloudflare Tunnel, choose **tunnel** in the wizard and enter the hostname (without \`https://\`). Without a tunnel hostname it falls back to local network.\r
\r
> On local network and tunnel, every device must pair before it can use TRUSTA — but “this computer only” remains the safest setting.\r
`,S=`# What TRUSTA is\r
\r
TRUSTA is a banking AI assistant that runs on your own computer. You say what you want in one sentence; it understands and gives you a card you can act on. Every step that moves money waits for you to authorise it on that card.\r
\r
## One sentence, one card\r
\r
| Scenario | You can say |\r
|---|---|\r
| Transfers | “Send ¥500 to Zhang San”, “Pay my landlord ¥3,000 on the 1st of every month” |\r
| Spending | “How much did I spend this month?”, “How much went on takeaway last month?” |\r
| Investments | “Recommend something that suits me”, “Buy ¥1,000 of something low-risk”, “Run my risk assessment” |\r
| Cards | “I lost my card”, “Turn off overseas payments on my credit card” |\r
| Subscriptions and direct debits | “What am I subscribed to?”, “What's renewing soon?” |\r
| Across scenarios | “Mum's birthday is next month — save ¥2,000 for a present”, “I'm going to Japan for 5 days next week, sort it out” |\r
\r
Replies are **interactive cards**: edit the amount on a transfer card, tap a slice of the spending chart for details, subscribe to a product right from the card, flip card controls in place.\r
\r
> The TRUSTA app and assistant currently work in Chinese; the examples above are translations.\r
\r
## Design principles\r
\r
- **The AI proposes; it never authorises.** The model only outputs candidate actions, and every parameter must be traceable to your own words, or it asks again. Typing “confirm” in chat executes nothing — authorisation happens only on a confirmation card.\r
- **Risk tiers come from bank rules.** Queries run directly, money and card operations need your confirmation, and large amounts, new payees or reporting a card lost also need a one-time code. Neither the model nor the app can change a tier. See [Authorisation tiers](#/authorization).\r
- **Every step is traceable.** Every message between the six agents is signed and every hand-off leaves evidence you can verify offline later. See [Signed agent messaging](#/agent-communication).\r
- **Least visibility.** The model never sees balances, statements, card numbers or codes; numbers in replies are filled in from bank queries.\r
\r
## How it fits together\r
\r
\`\`\`\r
your sentence\r
  → input safety check (injection, coerced transfers, data fishing)\r
  → Supervisor agent: intent and parameters (each parameter must quote your words)\r
  → Planner agent: breaks it into steps, checked by a validator\r
  → business agents (Transaction / Finance / Wealth / Service): query or propose\r
  → policy engine sets the tier → confirmation card → you authorise (plus a code if needed)\r
  → sealed execution contract → bank gateway executes → independent verification → receipt\r
  → audit hash chain + signed Merkle checkpoints\r
\`\`\`\r
\r
- **Backend**: Python 3.11+, SQLite, \`cryptography\` (ECDSA P-256).\r
- **Frontend**: a React web app, the same pages on desktop and phone; a Feishu bot as an optional channel.\r
- **Bank**: a local virtual bank sandbox by default, with fictional data; external sandboxes such as Revolut or Starling can be configured.\r
- **Model**: DeepSeek is recommended; any OpenAI-compatible model works; without a model, a rule engine handles standard phrasings.\r
\r
## Next\r
\r
- First time: [Quick start](#/quickstart)\r
- The security design: [Authorisation tiers](#/authorization), [Signed agent messaging](#/agent-communication)\r
`,ae=`# Quick start\r
\r
Get TRUSTA running on your own computer and make your first (virtual) transfer in about five minutes.\r
\r
> TRUSTA connects to a local virtual bank sandbox by default. All demo data is fictional; no real account is touched.\r
\r
## 1. Install\r
\r
Pick one option; see [Installation](#/install) for details.\r
\r
**Windows**: download the portable zip, unzip it and double-click \`TRUSTA.cmd\`. Or run in PowerShell:\r
\r
\`\`\`powershell\r
irm https://raw.githubusercontent.com/piggyz666/Trusta/main/install.ps1 | iex\r
\`\`\`\r
\r
**macOS / Linux**:\r
\r
\`\`\`bash\r
curl -fsSL https://raw.githubusercontent.com/piggyz666/Trusta/main/install.sh | bash\r
\`\`\`\r
\r
## 2. Configure\r
\r
The setup wizard opens right after installation. It has four steps, and the first time you can just press Enter through them:\r
\r
1. **Model**: choose DeepSeek and paste an API key, or choose “none” to use the rule engine.\r
2. **Bank**: the local sandbox bank (default).\r
3. **Access**: this computer only (default, safest).\r
4. **Safety and demo**: the \`competition\` safety profile plus demo mode (simulated SMS codes are shown on the page).\r
\r
Run \`python -m scripts.setup\` any time to change it. See [First-run setup](#/setup).\r
\r
## 3. Start\r
\r
\`\`\`bash\r
./start.sh          # macOS / Linux\r
\`\`\`\r
\r
\`\`\`powershell\r
.\\start.ps1         # Windows, or double-click TRUSTA.cmd\r
\`\`\`\r
\r
The window prints a \`http://127.0.0.1:8000/#token=…\` link; open it in your browser. The token is this computer's access credential — don't share it.\r
\r
## 4. Try a few sentences\r
\r
- “我这个月花了多少钱” (How much did I spend this month?): read-only, returns a report card straight away.\r
- “给张三转500元” (Send ¥500 to Zhang San): creates a yellow confirmation card; nothing happens until you tap Confirm.\r
- “我的卡丢了” (I lost my card): a red operation that needs a code; in demo mode the code appears on the “simulated phone”.\r
\r
## 5. See how it works\r
\r
Turn on **Developer mode** under 设置 → 外观 (Settings → Appearance). Each reply gets a “查看决策过程” (View decision process) link listing every signed message between agents, re-verified on the spot.\r
\r
## Next\r
\r
- Use it on your phone: [Phone access](#/mobile)\r
- Connect Feishu: [Feishu](#/feishu)\r
- Chat in a terminal: \`python -m scripts.chat_cli\`\r
`,oe=`# First-run setup\r
\r
The setup wizard writes your settings to \`.env\` in the project folder. The file stays on your computer and is ignored by git; the wizard tightens its permissions and doesn't echo secrets as you type.\r
\r
\`\`\`bash\r
python -m scripts.setup            # interactive setup\r
python -m scripts.setup --status   # show the feature table only\r
python -m scripts.setup --probe    # check connectivity, then show the feature table (makes one model call)\r
\`\`\`\r
\r
## 1/4 Model\r
\r
| Option | Notes |\r
|---|---|\r
| DeepSeek (recommended) | Paste an API key (starts with \`sk-\`); the model name defaults to \`deepseek-flash\` |\r
| Any OpenAI-compatible model | Endpoint (\`https://…/chat/completions\`), model name and key |\r
| None | The rule engine, which understands standard phrasings such as “给张三转500元” |\r
\r
You can add an HTTPS proxy if needed. Whichever model you connect, it can only propose actions and never sees balances, statements, card numbers or codes.\r
\r
## 2/4 Bank\r
\r
| Option | Notes |\r
|---|---|\r
| Local sandbox bank (default) | All six scenarios work, including incoming-payment notifications; all data is fictional |\r
| External bank sandbox | Revolut, Starling and similar; write a \`config/bank.*.local.toml\` based on \`config/bank.*.example.toml\` |\r
\r
## 3/4 Access and channels\r
\r
| Option | Notes |\r
|---|---|\r
| This computer only (default) | Opens only in this computer's browser; the safest choice |\r
| Local network | Phones on the same Wi-Fi or hotspot pair once by QR code; see [Phone access](#/mobile) |\r
| Tunnel | When you already have a public address such as a Cloudflare Tunnel; without a tunnel hostname it falls back to local network |\r
\r
It then asks whether to connect a Feishu bot; see [Feishu](#/feishu).\r
\r
## 4/4 Safety and demo\r
\r
| Setting | Notes |\r
|---|---|\r
| Safety profile \`competition\` (default) | Strong verification: daily totals, transfer frequency, new payees and investment trades are all enforced |\r
| Safety profile \`legacy\` | Earlier rules, kept for comparison |\r
| Demo mode \`true\` (default) | Simulated SMS codes appear on the page's “simulated phone”; scheduled plans can be fast-forwarded |\r
| Demo mode \`false\` | Codes are not shown |\r
\r
## The feature table\r
\r
The wizard ends with a feature table. TRUSTA enables features based on what is actually connected and passes its checks:\r
\r
\`\`\`\r
Model: deepseek-flash (VERIFIED)  Bank: virtual/local  Safety: competition\r
\r
[Six scenarios]\r
  ✔ available  Transfers (name / phone / nickname / scheduled / recurring / memo)\r
  ✔ available  Spending analysis / queries / anomaly detection\r
  ...\r
[Channels]\r
  ✘ unavailable  Feishu — missing: Feishu bot\r
        To enable: run python -m scripts.setup and fill in FEISHU_APP_ID / FEISHU_APP_SECRET\r
\`\`\`\r
\r
(The real output is in Chinese.) Features that aren't enabled are invisible to the assistant and can't be called; the app's Features page also tells you what each one needs.\r
\r
All settings are listed under [Configuration](#/configuration).\r
`,se=`# 多 Agent 签名通信\r
\r
多 Agent 系统最怕的是：某个 Agent 被提示注入或被攻破后，冒充别人、篡改消息、越权提案，而事后谁也说不清发生了什么。TRUSTA 让 Agent 之间的每一次通信都**可验证、可追溯、不可抵赖**。\r
\r
![图 1 AI 只能提议；Agent 之间的每一步都签名、可验证](/figs/fig1.webp)\r
\r
## 六个 Agent\r
\r
| Agent | 负责 |\r
|---|---|\r
| 总控（Supervisor） | 理解意图、抽取参数、汇总结果 |\r
| 规划（Planner） | 把请求拆成步骤（任务图），交给校验器检查 |\r
| 交易（Transaction） | 转账、收款人、余额相关的查询与提案 |\r
| 财务（Finance） | 账单、消费分析、异常识别 |\r
| 理财（Wealth） | 产品筛选、对比、申赎提案 |\r
| 客服（Service） | 卡片管理、订阅、知识问答 |\r
\r
另有一个独立的审计检查点 worker，负责给审计链生成签名检查点。\r
\r
**Agent 只能提案。** 真正执行资金动作的是确定性执行器和封印的执行合约；被攻破的 Agent 无法直接动钱。\r
\r
## 每条消息怎么签名\r
\r
每个 Agent 有独立的 **ECDSA P-256** 密钥身份，私钥加密存储。Agent 之间发送的是 V3 签名消息信封，接收方逐项检查：\r
\r
| 机制 | 防住什么 |\r
|---|---|\r
| 独立密钥身份；跨机构协作时登记为链上 WeID | 冒充其他 Agent |\r
| 规范化负载哈希、任务版本、5 分钟有效期、一次性 nonce、绑定接收方 | 篡改、重放、过期消息、错发 |\r
| 能力快照：消息里带发送方当前权限的承诺，与注册表不一致即拒收 | Agent 越权、权限被悄悄放大 |\r
| 通信边约束：每类任务只允许计划内的（发送方、接收方、消息类型）组合 | 例如财务 Agent 突然发出一条“转账提案” |\r
| 交接证据因果链：运行时对每次交接再签名，并引用前序证据 | 事后否认、顺序被调换 |\r
| 意图来源证明：用户原话哈希、理解方式、模型调用记录哈希写进总控签名的请求 | 无法证明某个提案来自用户的哪句话 |\r
| 密钥轮换、吊销、身份暂停 | 密钥泄露后的处置 |\r
\r
## 证据链和审计\r
\r
1. 每次交接，运行时签发一条**交接证据**，包含完整的消息信封、输入输出哈希、引用的前序证据哈希，以及对应金融操作各阶段（提案、授权、合约、核验、回执）的哈希。\r
2. 证据和审计事件一起写入**只追加**的审计哈希链：任何一条被改动，后面的哈希都对不上。\r
3. 独立的审计 worker 定期对新记录生成**签名 Merkle 检查点**；任意一条记录都可以用包含证明（inclusion proof）离线验证。\r
\r
## 亲眼验证\r
\r
- 网页“设置 → 外观”打开**开发者模式**，每条回复下出现“查看决策过程”：逐条列出 Agent 间的签名消息，并当场重新验签（消息签名、证据签名、因果父节点）。\r
- 在结果卡上下载**签名证据包**，用命令行离线验证，见[证据包离线验证](#/evidence)。\r
- 重跑攻击实测：\r
\r
\`\`\`bash\r
python -m benchmarks.security_benchmark --banking-version 5\r
\`\`\`\r
\r
见[安全基准](#/benchmarks)。\r
\r
## 管理密钥\r
\r
\`\`\`bash\r
python -m scripts.manage_crypto_identity --agent transaction --rotate          # 轮换某个 Agent 的密钥\r
python -m scripts.manage_crypto_identity --agent transaction --status SUSPENDED # 暂停身份\r
python -m scripts.manage_crypto_identity --revoke-key KEY_ID                    # 吊销某把密钥\r
\`\`\`\r
\r
轮换后旧密钥有一个宽限期（默认 300 秒，\`--grace-seconds\`），之后一律拒收。\r
`,ce='# HTTP API\r\n\r\nTRUSTA 的网页、终端客户端和飞书都通过同一套本地 HTTP API 工作。你也可以用它接入自己的界面。\r\n\r\n## 基本约定\r\n\r\n- 地址：`http://127.0.0.1:8000`。\r\n- 除 `/health` 和静态页面外，所有接口都需要 `Authorization: Bearer <token>`。token 在启动时打印，默认保存在 `data/api.token`；配对过的手机使用自己的设备令牌。\r\n- 服务端会校验 `Host` 和 `Origin`；客户身份由服务端决定，客户端**不能**传 `user_id`。\r\n- POST 使用 `Content-Type: application/json`。\r\n- 金额一律是账户币种的**整数最小单位**（人民币为分），不做隐式换汇。\r\n\r\n## 对话\r\n\r\n| 方法 | 路径 | 用途 |\r\n|---|---|---|\r\n| POST | `/api/chat/sessions` | 新建会话 |\r\n| GET | `/api/chat/sessions/{sid}` | 读取会话：历史消息、当前计划、待确认卡片（断线重连用） |\r\n| POST | `/api/chat/sessions/{sid}/messages` | 发送一条消息 |\r\n| POST | `/api/chat/sessions/{sid}/actions/{action_id}/decision` | 对确认卡做决定 |\r\n| POST | `/api/chat/sessions/{sid}/actions/{action_id}/sms` | 为红色卡片发送模拟短信验证码 |\r\n| POST | `/api/chat/sessions/{sid}/interrupt` | 中断当前计划 |\r\n| POST | `/api/chat/sessions/{sid}/close` | 关闭会话 |\r\n\r\n### 发送消息\r\n\r\n```json\r\nPOST /api/chat/sessions/{sid}/messages\r\n{\r\n  "message_id": "m_01J…",\r\n  "revision": 3,\r\n  "text": "给我妈转两千，备注生活费"\r\n}\r\n```\r\n\r\n- `message_id` 由客户端生成（1–64 位）；同一个 ID 重试返回原结果，不会重复处理。\r\n- `revision` 是上一次响应里的版本号；不一致会返回 `CHAT_STALE`。\r\n- 请求头 `Accept: text/event-stream` 返回 SSE 流；`Accept: application/json` 等整轮处理完一次性返回。\r\n\r\nSSE 事件包括 `turn.started`、`guard.result`、`intent.recognized`、`plan.created` / `plan.updated`、`tool.started` / `tool.finished`、`message.delta`、`card`、`turn.completed`、`turn.failed`。以 `turn.completed` 里的完整结果为准。\r\n\r\n### 对确认卡做决定\r\n\r\n```json\r\nPOST /api/chat/sessions/{sid}/actions/{action_id}/decision\r\n{\r\n  "action_hash": "sha256:…",\r\n  "approve": true,\r\n  "verification": { "method": "SMS", "code": "123456" }\r\n}\r\n```\r\n\r\n`action_hash` 必须和卡片上的完全一致；`verification` 只有红色操作需要（`TOTP` 或 `SMS`）。\r\n\r\n## 任务（底层）\r\n\r\n对话层下面是任务接口，每个资金动作都落到这里，保持哈希绑定、过期和防重放规则：\r\n\r\n| 方法 | 路径 | 用途 |\r\n|---|---|---|\r\n| POST | `/api/tasks` | 创建任务，例如 `{"text":"给张三转 2000 元"}` |\r\n| GET | `/api/tasks` | 当前客户的任务摘要 |\r\n| GET | `/api/tasks/{id}` | 任务状态、任务图、授权及证据 |\r\n| POST | `/api/tasks/{id}/authorize` | 授权，`{"action_hash":"…","approve":true}` |\r\n| GET | `/api/balance` | 账户余额 |\r\n| GET | `/api/transactions?account_id=…&month=YYYY-MM` | 指定账户和月份的交易记录 |\r\n| GET | `/api/audit` | 审计链是否完整：`{"valid": true}` |\r\n| GET | `/api/audit/proof` | 审计记录的 Merkle 包含证明 |\r\n\r\nHTTP 成功并不代表资金执行成功，必须检查任务状态：\r\n\r\n| 状态 | 含义 |\r\n|---|---|\r\n| `WAITING_USER` | 等待确认或补全信息 |\r\n| `COMPLETED` | 已结算，并且银行侧状态核验通过 |\r\n| `BLOCKED` | 被规则或安全关卡阻止 |\r\n| `CANCELLED` | 用户拒绝 |\r\n| `FAILED` | 执行前或银行事务失败 |\r\n| `MANUAL_REVIEW` | 可能已执行，需要人工核查，**禁止重复转账** |\r\n\r\n## 错误\r\n\r\n| 状态码 | 含义 |\r\n|---|---|\r\n| 400 | 输入或安全校验失败 |\r\n| 403 | 身份、来源或归属被拒绝 |\r\n| 404 | 未知接口 |\r\n| 500 | 未分类异常；应刷新原任务状态，不要据此再次发起资金操作 |\r\n\r\n没有让客户端直接写银行的接口，没有给 Agent 使用的执行接口，也没有自动的资金写入重试。\r\n\r\n完整协议见仓库中的 `docs/chat-protocol-v1.md` 和 `docs/api.md`。\r\n',le=`# 授权等级\r
\r
TRUSTA 把每个操作分成三级。等级由后端策略引擎根据银行规则决定，大模型和前端都无法指定或调整。\r
\r
| 等级 | 怎么授权 | 典型操作 |\r
|---|---|---|\r
| 绿色 | 直接执行 | 查余额、看账单、查订阅、比较理财产品、风险测评问卷 |\r
| 黄色 | 你在确认卡上点“确认” | 转账、冻结卡、取消订阅或代扣、锁定心愿金、更新风险等级 |\r
| 红色 | 确认 + 短信或验证器动态码 | 大额转账、新收款人、挂失与解除挂失、解冻、改密码、提高限额、开启交易开关、理财申购与赎回 |\r
\r
## 什么情况会变成红色\r
\r
转账在以下任一情况下需要验证码：\r
\r
- 单笔金额 ≥ **¥5,000**（\`TRUSTA_HIGH_RISK_CENTS\`）。\r
- 人民币转账当日累计超过 **¥1,000**（\`TRUSTA_DAILY_TRANSFER_CENTS\`）。\r
- **10 分钟**内已有 **3** 笔转账，下一笔需要验证码。\r
- 24 小时内新添加的收款人，单笔 ≥ **¥500**。\r
- 外币转账一律需要验证码。\r
\r
卡片和其他操作：解冻、挂失、解除挂失、重置密码、添加收款人、提高消费限额、开启某项交易开关，以及金额 ≥ ¥5,000 的操作，都是红色。\`competition\` 安全档位下，理财申购和赎回也是红色。\r
\r
## 验证码\r
\r
- 可以用认证器动态码（TOTP）或短信验证码。演示模式下短信是模拟的，验证码显示在页面的“模拟手机”里。\r
- 短信验证码 **5 分钟**内有效，最多尝试 **3** 次，只对这一笔操作有效。\r
- 连续验证失败 **5** 次会安全锁定账户（\`TRUSTA_AUTH_FAILURE_LIMIT\`）。\r
- 验证码只在确认卡里输入，不要在聊天里发送。\r
\r
## 一定会被拦下的情况\r
\r
不论等级，以下情况直接拒绝执行：收款人不存在、付款账户已冻结、余额不足、卡片生成后账户状态已变化（前置条件不一致）、账户处于转账保护期。\r
\r
## 24 小时转账保护\r
\r
遇到可疑情况，可以说“开启24小时转账保护”。保护期内转账、添加收款人、心愿金下单、理财申购都会被拦下，只能由银行人员核实后解除（需要安全操作员令牌）。\r
\r
## 在飞书里\r
\r
黄色操作可以直接在飞书卡片上确认；红色操作会给出一个链接，引导你回到 TRUSTA 网页完成验证。见[飞书接入](#/feishu)。\r
`,ue=`# 安全基准\r
\r
TRUSTA 用一组可以重复运行的攻击实测，检查多 Agent 通信和执行链能不能拦住各种伪造和篡改。\r
\r
\`\`\`bash\r
python -m benchmarks.security_benchmark --banking-version 5\r
\`\`\`\r
\r
结果写入 JSON 文件（默认 \`docs/phase4-security-benchmark.json\`，可用 \`--output\` 指定）。仓库里的 \`docs/phase5-security-benchmark.json\` 是最近一次正式运行的结果。\r
\r
## 结果\r
\r
**18 类攻击各 5 次，共 90 次，全部拦截，0 笔意外交易；135 条正常消息 0 误拒。**\r
\r
| 攻击 | 说明 |\r
|---|---|\r
| 伪造 Agent 身份 | 用不在注册表里的身份发消息 |\r
| 无效签名 | 签名与消息不符 |\r
| 负载篡改 | 签名后改动消息内容 |\r
| 重放 | 重复发送已用过的消息 |\r
| 过期消息 | 超过有效期的消息 |\r
| 已吊销密钥 | 用吊销的密钥签名 |\r
| 宽限期外旧密钥 | 轮换后仍用旧密钥 |\r
| 越权 | 声称没有的能力 |\r
| 能力快照篡改 | 改动消息里的权限承诺 |\r
| 未授权工具调用 | 调用计划之外的工具 |\r
| 授权哈希不符 | 授权与操作不对应 |\r
| 重复执行 | 同一笔资金操作执行两次 |\r
| 审计事件篡改 | 改动审计记录 |\r
| Merkle 叶子篡改 | 改动被证明的记录 |\r
| 无效 Merkle 证明 | 伪造包含证明 |\r
| 检查点篡改 | 改动签名检查点 |\r
| 锚定根不符 | 检查点与锚定根不一致 |\r
| 签名算法降级 | 诱导使用更弱的算法 |\r
\r
## 性能\r
\r
| 操作 | 中位数 | P95 |\r
|---|---|---|\r
| 签名一条消息 | 15.1 ms | 22.5 ms |\r
| 验证一条消息 | 5.5 ms | 9.0 ms |\r
| 生成一个检查点 | 16.7 ms | 31.2 ms |\r
\r
测试环境：Windows 11，Python 3.13，\`cryptography\` 47。验签包含签名、身份、能力和任务上下文检查；检查点包含整链校验、Merkle 批处理、签名和持久化。\r
\r
## 六大场景闭环审计\r
\r
\`\`\`bash\r
python -m benchmarks.scenario_audit\r
\`\`\`\r
\r
对转账、账单、理财、卡片、订阅、跨场景联动六大场景做 **49 项**端到端检查。\r
\r
## 局限\r
\r
- 这是本地受控攻击，不是生产环境渗透测试，也不是“安全概率”估计。\r
- 使用合成的沙箱银行和审计记录；耗时受主机文件系统和 SQLite 影响。\r
- 测试全部通过不代表不存在未知漏洞。\r
`,de=`# 更新日志\r
\r
## 2026-10-25\r
\r
- 宣传页：墨水流体首屏、产品演示、可信机制、实测数据和快速开始；中英双语。\r
- 文档站上线；新增“集成”页。\r
- 重绘图 1、图 2（中英两版），按“问题 → 全链路 → 实测”讲清楚做了什么。\r
- 宣传页：实测数据逐项解释、集成板块、深浅色切换；演示动画自动播放。\r
- 一行命令安装（Windows / macOS / Linux）、\`start.sh\`、\`TRUSTA.cmd\` 双击启动。\r
- Windows 便携版打包和自动化构建。\r
- 修复：\`requirements.txt\` 补全服务启动所需的依赖，全新环境安装不再失败。\r
\r
## 2026-10-24\r
\r
- 网页和手机端：对话首页、交互卡片、总览与记录、功能开关、设置。\r
- 交互式水波背景、液态玻璃界面、新图标；深浅色跟随系统。\r
- 决策过程移到开发者模式。\r
- 飞书红色操作的链接在手机上也能打开；会话按内容自动命名。\r
- README：多 Agent 可信通信与跨机构协作配图。\r
\r
## 2026-10-23\r
\r
- 访问方式：仅本机 / 局域网 / 隧道；手机一次性配对和设备令牌。\r
- 飞书长连接 worker 和绑定码。\r
- 配置向导：校验密钥输入；探测结果显示详情。\r
- 聊天里的文字不能代替确认卡；飞书规则确认按钮。\r
\r
## 2026-10-22\r
\r
- 功能注册表和配置向导；自动化规则引擎；出行管家。\r
- 外部文本隔离；反诈冷静期；资金操作串行执行。\r
- 六大场景闭环审计。\r
\r
## 2026-10-21\r
\r
- 统一对话接口与卡片协议。\r
- 多 Agent 签名通信与终端客户端。\r
`,fe=`# 对话与结果卡片\r
\r
TRUSTA 的每次回复由一段文字和若干张卡片组成。文字负责说明，卡片负责操作。\r
\r
## 卡片类型\r
\r
| 卡片 | 什么时候出现 | 你可以做什么 |\r
|---|---|---|\r
| 追问 | 缺少必要信息，例如没说金额 | 直接回答，或点选项 |\r
| 确认卡 | 任何涉及资金或卡片的写操作 | 核对、修改金额，点“确认”或“拒绝”；红色操作还要输入验证码 |\r
| 报告卡 | 账单、理财、订阅等只读查询 | 点分类看明细、筛选、对比 |\r
| 风险提示 | 识别到诈骗话术、注入或异常 | 了解原因；可以开启 24 小时转账保护 |\r
| 结果卡 | 操作执行后 | 查看银行核验结果和回执；可以导出签名证据包 |\r
| 计划 | 一句话里有多个步骤 | 查看每一步的状态，随时中断 |\r
| 问卷 | 风险测评 | 逐题作答，结果由确定性规则评分 |\r
\r
## 确认卡\r
\r
确认卡是唯一的授权入口：\r
\r
- 卡片绑定一个 \`action_hash\`，只对卡上显示的那一笔（金额、对象、账户）有效。\r
- **15 分钟**内有效。过期或者信息有变化，需要重新生成。\r
- 在聊天里说“确认”“好的”不会执行，只会提示你去点卡片。\r
- 执行前，银行还会再次核对余额、账户版本等前置条件，不一致会拒绝执行。\r
\r
## 多轮对话\r
\r
可以像跟人说话一样补充和修改：\r
\r
- “给张三转账” → 追问金额 → “500” → 生成确认卡\r
- “改成800” → 重新生成确认卡\r
- “算了不转了” → 作废未执行的卡片\r
\r
## 多步计划\r
\r
“下周去日本玩5天，帮我安排一下”这类请求会拆成一个计划：核对余额、赎回理财、开通境外交易、返程后自动关闭、超预算提醒。\r
\r
- 每个涉及资金或卡片的步骤，都会单独生成确认卡，逐笔等你确认。\r
- 说“停下”可以中断计划：没授权的步骤全部取消；已经执行的不回滚，回复里会列出来。\r
\r
## 撤销\r
\r
可以生成反向操作（仍需你确认）的有：冻结 ↔ 解冻、挂失 ↔ 解除挂失、限额调整（改回原值）、交易开关（恢复原设置）、心愿金锁定（释放）、理财申购 ↔ 赎回。\r
\r
不能直接撤销的有：\r
\r
- 转账已经到账，银行无法单方面撤回；可以联系收款人退回。\r
- 商户订单已支付，需要联系商户退款。\r
- 订阅已取消，需要在商户那里重新开通。\r
\r
## 转人工\r
\r
说“转人工”“找客服”会进入人工接管：此后你的消息不再发给模型，而是进入人工队列；说“取消转人工”回到智能助手。客服没有任何授权接口，不能替你确认资金操作。\r
\r
## 自动化规则\r
\r
可以用一句话设置“当……就……”的规则，例如“外卖每月超过800就提醒我”“工资到账后存1000到心愿金”。\r
\r
- 触发条件：到点、入账、余额低于某值、某类消费超预算、出现大额消费。\r
- 动作：提醒、转账、存心愿金、申购理财、冻结卡、关闭交易开关、转人工。\r
- 规则要你确认后才生效；触发时涉及资金的操作仍然逐笔请你确认。\r
\r
## 账单与订阅、理财、生活服务页面\r
\r
左侧导航里有三个独立页面，方便不开口也能看清楚：\r
\r
- **账单与订阅**：每月固定支出、未来 30 天的扣费时间线、已登记的订阅和代扣。TRUSTA 会从流水里找周期扣费：同一商户、同一金额，间隔 25–35 天扣满 3 次，就列为“疑似订阅”，并在对话里提醒你一次。你可以确认“是我的订阅”（之后扣费前 3 天提醒）、标记“不认识”（给出冻结卡片、转人工等止损办法）或忽略。\r
- **理财**：黄金和美元、欧元、日元、港币的参考行情（每个数字都标来源和数据时间，可手动刷新；断网时显示最近一次的数据并注明），你的风险等级，持仓，以及本行在售产品（期限、起购金额、申赎规则、业绩比较基准和风险提示）。高于你风险等级的产品会显示但不能申购。“为你推荐”按近三个月消费留足三个月备用金，其余按风险等级分配，每部分尽量选不同机构的产品；在对话里说“根据我的消费推荐理财”也能得到同样的方案。\r
- **生活服务**：机票、火车票、酒店、演出、电影、生活缴费、社保医保的官方入口。在对话里说“下周五北京到上海的机票”“上海最近有什么演唱会”，会从原话里取出城市和日期，给一张直接打开查询结果的卡片（携程、12306、大麦等）；缺出发地就追问。只跳转白名单网站，本行不参与交易、不代付。\r
\r
两个页面上的“取消”“申购”“赎回”按钮都会回到对话里生成确认卡，和直接说出来走同一套授权。TRUSTA 不推荐个股，也不承诺收益。\r
\r
## 开发者模式\r
\r
“设置 → 外观”里打开开发者模式后，每条回复下会出现“查看决策过程”：列出这一轮 Agent 之间的每条签名消息，并在页面上重新验签（消息签名、证据签名、因果父节点）。结果卡上可以下载签名证据包，见[证据包离线验证](#/evidence)。\r
`,pe="# 命令行\r\n\r\n所有命令都在项目根目录运行。用安装脚本安装时，请先激活虚拟环境（`source .venv/bin/activate`，Windows 为 `.venv\\Scripts\\activate`），或者把 `python` 换成 `.venv/bin/python`。\r\n\r\n## 日常\r\n\r\n| 命令 | 作用 |\r\n|---|---|\r\n| `./start.sh` / `.\\start.ps1` / 双击 `TRUSTA.cmd` | 启动服务和后台任务 |\r\n| `python -m scripts.setup` | 配置向导 |\r\n| `python -m scripts.setup --status` | 显示功能表 |\r\n| `python -m scripts.setup --probe` | 探测模型、银行、飞书的连通性后显示功能表 |\r\n| `python -m scripts.pair` | 生成手机配对码 |\r\n| `python -m scripts.pair --feishu` | 生成飞书绑定码 |\r\n| `python -m scripts.pair --devices` | 列出已配对设备 |\r\n| `python -m scripts.pair --revoke ID` | 吊销设备 |\r\n\r\n## 在终端里对话\r\n\r\n```bash\r\npython -m scripts.chat_cli             # 连接正在运行的服务\r\npython -m scripts.chat_cli --sandbox   # 进程内启动 + 临时数据库，不影响 data/\r\n```\r\n\r\n对话里可以用这些命令：\r\n\r\n| 命令 | 作用 |\r\n|---|---|\r\n| `/y N` / `/n N` | 确认 / 拒绝第 N 张卡片 |\r\n| `/sms N` | 为红色卡片 N 发送模拟短信验证码 |\r\n| `/otp N CODE` | 用短信验证码确认红色卡片 N |\r\n| `/totp N CODE` | 用认证器动态码确认红色卡片 N |\r\n| `/stop` | 中断当前计划 |\r\n| `/trace` | 查看上一轮的决策链 |\r\n| `/events` | 列出计划任务 |\r\n| `/advance ID` | 立即执行某个计划（仅演示模式） |\r\n| `/quit` | 退出 |\r\n\r\n## 验证与审计\r\n\r\n| 命令 | 作用 |\r\n|---|---|\r\n| `python -m scripts.verify_handoff_evidence BUNDLE --trusted-registry REGISTRY` | 离线验证签名证据包 |\r\n| `python -m scripts.verify_audit_record PROOF --trusted-public-key KEY` | 验证单条审计记录的 Merkle 包含证明 |\r\n| `python -m scripts.manage_crypto_identity --agent NAME --rotate` | 轮换 Agent 密钥 |\r\n| `python -m scripts.manage_crypto_identity --agent NAME --status SUSPENDED` | 暂停 Agent 身份 |\r\n| `python -m scripts.manage_crypto_identity --revoke-key KEY_ID` | 吊销密钥 |\r\n\r\n## 测试与评测\r\n\r\n| 命令 | 作用 |\r\n|---|---|\r\n| `python -m pytest -q` | 全部自动化测试（约 1,400 项） |\r\n| `python -m benchmarks.scenario_audit` | 六大场景 49 项闭环检查 |\r\n| `python -m benchmarks.security_benchmark --banking-version 5` | 18 类攻击实测 |\r\n\r\n## 后台 worker\r\n\r\n启动脚本会自动运行它们，一般不需要手动启动：\r\n\r\n| 命令 | 作用 |\r\n|---|---|\r\n| `python -m scripts.audit_worker --watch` | 生成签名 Merkle 检查点 |\r\n| `python -m scripts.scheduled_worker --watch` | 执行到期的计划（生日下单、周期转账等） |\r\n| `python -m scripts.feishu_worker` | 飞书长连接 |\r\n\r\n## 打包\r\n\r\n```bash\r\npython -m scripts.build_portable --python-embed python-3.12.10-embed-amd64.zip --out dist\r\n```\r\n\r\n生成 Windows 便携版 `dist/TRUSTA-windows-x64.zip`。仓库里的 GitHub Actions 工作流 `Packages` 会自动完成下载嵌入式 Python、打包、在 Windows 上启动自检，并在推送 `v*` 标签时附到发布页。\r\n",me="# 配置项\r\n\r\nTRUSTA 的配置都是环境变量，保存在项目目录下的 `.env`（由[配置向导](#/setup)写入，已被 git 忽略）。也可以在启动前直接设置环境变量，环境变量优先。金额类配置的单位是**分**。\r\n\r\n## 大模型\r\n\r\n| 变量 | 默认 | 说明 |\r\n|---|---|---|\r\n| `DEEPSEEK_API_KEY` | — | 模型 API Key；为空时使用规则引擎 |\r\n| `TRUSTA_CHAT_LLM_ENDPOINT` | `https://api.deepseek.com/chat/completions` | 兼容 OpenAI 接口的地址 |\r\n| `TRUSTA_CHAT_LLM_MODEL` | `deepseek-flash` | 模型名 |\r\n| `TRUSTA_CHAT_LLM_PROXY` | — | HTTPS 代理 |\r\n| `TRUSTA_CHAT_LLM_TIMEOUT` | `30` | 单次调用超时（秒） |\r\n| `TRUSTA_CHAT_LLM_CONCURRENCY` | `4` | 并发调用上限 |\r\n| `TRUSTA_CHAT_LLM_DAILY_CALLS` | `300` | 每个用户每日调用上限；用完后当天改用规则引擎 |\r\n| `TRUSTA_LLM_CONFIG` | — | 评测用的模型配置文件路径 |\r\n\r\n## 银行\r\n\r\n| 变量 | 默认 | 说明 |\r\n|---|---|---|\r\n| `TRUSTA_BANK_CONFIG` | — | 外部银行沙箱配置文件（`config/bank.*.local.toml`）；为空时使用本地沙箱银行 |\r\n| `TRUSTA_BANKING_VERSION` | `5` | 银行动作集版本 |\r\n| `TRUSTA_DISABLED_FEATURES` | — | 逗号分隔，关闭指定功能，例如 `wealth,trip` |\r\n\r\n## 访问与渠道\r\n\r\n| 变量 | 默认 | 说明 |\r\n|---|---|---|\r\n| `TRUSTA_ACCESS_MODE` | `local` | `local` 仅本机 / `lan` 局域网 / `tunnel` 隧道 |\r\n| `TRUSTA_PUBLIC_HOST` | — | 隧道模式的公网域名（不带 `https://`） |\r\n| `TRUSTA_LAN_HOST` | 自动检测 | 局域网模式下手动指定本机地址 |\r\n| `TRUSTA_PORT` | `8000` | 飞书“回到 APP”链接里使用的端口（服务本身固定监听 8000） |\r\n| `TRUSTA_API_TOKEN` | 自动生成 | 本机访问令牌；默认保存在 `data/api.token` |\r\n| `TRUSTA_APP_URL` | 按访问方式推算 | 飞书里“回到 APP”链接使用的地址 |\r\n| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | — | 飞书应用凭据 |\r\n| `FEISHU_MODE` | `longconn` | `longconn` 长连接 / `webhook` |\r\n| `FEISHU_VERIFICATION_TOKEN` / `FEISHU_ENCRYPT_KEY` | — | webhook 模式使用 |\r\n| `FEISHU_USER_BINDINGS` | — | 运营方预置绑定，格式 `open_id:owner,open_id:owner` |\r\n\r\n## 安全\r\n\r\n| 变量 | 默认 | 说明 |\r\n|---|---|---|\r\n| `TRUSTA_SAFETY_PROFILE` | `competition` | `competition` 强验证 / `legacy` |\r\n| `TRUSTA_DEMO_MODE` | `false`（向导默认 `true`） | 演示模式：模拟短信验证码回显、计划可快进 |\r\n| `TRUSTA_HIGH_RISK_CENTS` | `500000` | 单笔 ≥ 此金额为红色（¥5,000） |\r\n| `TRUSTA_DAILY_TRANSFER_CENTS` | `100000` | 当日累计超过此金额为红色（¥1,000） |\r\n| `TRUSTA_ANOMALY_LARGE_CENTS` | `100000` | 大额消费异常提醒阈值 |\r\n| `TRUSTA_ANOMALY_DUPLICATE_SECONDS` | `300` | 疑似重复扣费的时间窗口 |\r\n| `TRUSTA_AUTH_FAILURE_LIMIT` | `5` | 连续验证失败多少次后安全锁定 |\r\n| `TRUSTA_EXECUTION_FAILURE_LIMIT` | `3` | 连续执行失败多少次后安全锁定 |\r\n| `TRUSTA_SECURITY_OPERATOR_TOKEN` | — | 银行人员令牌：解除转账保护、人工接管 |\r\n| `TRUSTA_STRONG_AUTH_SECRET` | — | `legacy` 安全档位下红色操作使用的强验证口令 |\r\n\r\n## 可信通信与审计\r\n\r\n| 变量 | 默认 | 说明 |\r\n|---|---|---|\r\n| `TRUSTA_COMMUNICATION_VERSION` | `3` | 签名通信协议版本；为 3 时启动审计和计划任务 worker |\r\n| `TRUSTA_CRYPTO_KEY_DIR` | `data/trusta.keys` | Agent 私钥存放目录（与数据库同名的 `.keys` 目录） |\r\n| `TRUSTA_AGENT_TIMEOUT_SECONDS` | `20` | 单个 Agent 处理超时 |\r\n| `TRUSTA_FINANCE_PROCESS_ENABLED` | `false` | 财务 Agent 以独立进程运行 |\r\n| `TRUSTA_BLOCKCHAIN_ANCHOR_ENABLED` | `false` | 审计检查点上链锚定 |\r\n| `TRUSTA_DID_ENABLED` | `true` | 跨机构协作的链上身份 |\r\n| `TRUSTA_ZKP_ENABLED` | `false` | 零知识能力准入 |\r\n| `TRUSTA_ZKP_ARTIFACT_DIR` / `TRUSTA_ZKP_MANIFEST_SHA256` | — | 零知识证明产物目录和清单哈希 |\r\n\r\n## 数据\r\n\r\n| 变量 | 默认 | 说明 |\r\n|---|---|---|\r\n| `TRUSTA_DB` | `data/trusta.sqlite3` | 数据库路径 |\r\n\r\n`data/` 里保存数据库、根签名密钥（`signing.key`）、Agent 密钥和日志，`.env` 保存你的密钥配置。两者都不要提交或分享。\r\n",he=`# 跨机构协作：WeID · 零知识准入 · 链上承诺\r
\r
当多家机构的 Agent 需要共同完成一件事（例如几家银行的 Agent 交叉核对同一份风险结论），只靠本机签名还不够：对方怎么确认“你是谁”“你够不够格参与”“最后的结论有没有被改过”？TRUSTA 在[多 Agent 签名通信](#/agent-communication)的基础上叠加了一层可以在联盟链上公开核验的信任层。\r
\r
![图 2 跨机构协作：身份、资格、结论都能在链上公开核验](/figs/fig2.webp)\r
\r
## 四个部分\r
\r
### 链上身份：WeID\r
\r
每个参与协作的 Agent 在 **FISCO BCOS** 联盟链上登记 **WeID**（微众银行开源的分布式身份），其 P-256 消息密钥与 WeID 绑定。身份可以注册、解析、停用和恢复。协作轮次只认链上 WeID；链不可用时直接拒绝，不会退回本地自签的 \`did:key\`。\r
\r
### M1：零知识能力准入\r
\r
Agent 用 **Groth16** 零知识证明说明：自己在固定评测集上的成绩（由 TP / FP / FN 按固定公式算出的 F1）达到策略阈值，同时**不公开评测明细和预测结果**。证明绑定策略、周期（Epoch）、模型承诺和评测记录；可以撤销，会到期。Agent 不能自己声明分数获得准入。\r
\r
### M2：协作消息绑定\r
\r
在原有 V3 签名之外，协作消息还要绑定链上身份、准入凭证、协作轮次和 Epoch。错误签名、跨轮次 / 任务 / Epoch、已撤销、模型不符、重放都会被拒绝。\r
\r
### OTC：全窗口收集\r
\r
协作采用 k-of-n：到截止时间才冻结证据，收到的有效结论不足 k 份则本轮作废；迟到的消息只用于遥测，不进入结论。\r
\r
### M3：链上决策承诺\r
\r
协作结论的 **Merkle 根**与成员快照写入 \`CollaborationAnchor\` 合约，并由两个节点的 RPC 分别读回核对。提交结果未知时按原哈希查找恢复，绝不盲目重发。\r
\r
## 重要边界\r
\r
- 链上身份和签名都**不授予任何银行写入权限**；资金操作仍须用户在确认卡上授权。\r
- 当前环境是**单机 8 节点测试联盟链**（Chain ID 101），两个验证 RPC 属于两个节点但在同一主机，不代表独立机构。\r
- Groth16 使用**开发用可信设置**（单机 Phase-2），不是生产级 MPC。\r
- 零知识电路证明的是受限的统计关系，不在电路里执行大模型推理。\r
\r
这些限制都如实记录在仓库的 \`docs/ANCHOR_Integration_Final_Acceptance.md\` 中。\r
\r
## 已登记的 Agent\r
\r
| Agent | WeID |\r
|---|---|\r
| 财务 Finance | \`did:weid:101:0xa968103852c7eae1a245b77e98660730d8ccc3d3\` |\r
| 理财 Wealth | \`did:weid:101:0xa8fac68a926fb16debb085af40a1bb5d840df7de\` |\r
| 交易 Transaction | \`did:weid:101:0xf9fb420c820cf567b5250f816dd9a21c80f88c31\` |\r
\r
## 开启方式\r
\r
这一层默认关闭，需要先在 WSL / Linux 中运行测试联盟链：\r
\r
\`\`\`bash\r
bash scripts/anchor_network_lifecycle.sh run\r
\`\`\`\r
\r
相关配置项：\`TRUSTA_DID_ENABLED\`、\`TRUSTA_ZKP_ENABLED\`、\`TRUSTA_ZKP_ARTIFACT_DIR\`、\`TRUSTA_ZKP_MANIFEST_SHA256\`，见[配置项](#/configuration)。第三方可以用 \`python -m scripts.verify_anchor_collaboration\` 复验公开证据包。\r
`,ge=`# 证据包离线验证\r
\r
TRUSTA 的每张结果卡都可以导出一个**签名证据包**。拿到证据包的人不需要相信这台服务器，也不需要连接银行或大模型，就能独立验证这一次处理过程中 Agent 之间的交接是否真实、完整、按顺序发生。\r
\r
## 导出\r
\r
1. 在网页“设置 → 外观”里打开开发者模式。\r
2. 在一张结果卡上打开“查看决策过程”，点击**下载证据包**，得到 \`trusta-evidence-xxxxxxxx.json\`。\r
\r
## 验证\r
\r
\`\`\`bash\r
python -m scripts.verify_handoff_evidence trusta-evidence-xxxxxxxx.json --trusted-registry registry.json\r
\`\`\`\r
\r
成功时输出：\r
\r
\`\`\`json\r
{"verified": true, "scope": "RUNTIME_CAUSAL_ATTESTATION_NOT_BANK_AUTHORIZATION"}\r
\`\`\`\r
\r
退出码为 0；验证失败时 \`verified\` 为 \`false\`，退出码为 1。改动证据包里任何一个字节都会验证失败。\r
\r
仓库里带有一份示例，可以直接试：\r
\r
\`\`\`bash\r
python -m scripts.verify_handoff_evidence docs/agent-communication-demo.json --trusted-registry docs/agent-communication-trusted-registry.json\r
\`\`\`\r
\r
## 验证了什么\r
\r
- 每条交接证据的签名，以及签名者在注册表中的身份和密钥。\r
- 证据之间的因果父子关系：拒绝未知或缺失的父证据、重复或重排、跨任务混入。\r
- 身份、能力承诺、密钥归属没有被替换。\r
- 审计记录的 Merkle 包含证明。\r
\r
## 没有验证什么\r
\r
- \`scope\` 写得很清楚：这是**运行时因果声明**，不是银行授权。资金操作的授权来自你在确认卡上的决定。\r
- 隐藏的负载内容不会导出；输入输出哈希一致不等于内容语义正确。\r
\r
## 公钥注册表从哪来\r
\r
\`--trusted-registry\` 是各 Agent 公钥和能力的注册表。验证者应当**独立取得并固定**这份注册表（例如事先从可信渠道拿到并保存），而不是从证据包本身读取。历史快照只说明当时的状态，不表示密钥现在仍未被吊销。\r
`,_e=`# 常见问题\r
\r
## 会动到我真实的银行账户吗？\r
\r
默认不会。TRUSTA 默认连接本地虚拟银行沙箱，演示数据全部虚构。接入真实银行需要按 \`config/\` 中的适配器配置，并完成银行侧授权。\r
\r
## 不接大模型能用吗？\r
\r
能。不配置大模型时使用规则引擎，只识别标准说法，例如“给张三转500元”“这个月花了多少钱”。接入模型后可以理解更口语化的表达和多步请求。\r
\r
## 大模型会看到我的余额吗？\r
\r
不会。模型只看到你的原话、日期和资源名称（如收款人姓名、产品名），看不到余额、流水、卡号和验证码；长串数字发送前会被遮盖。回复里的数字都由银行系统查询后填入，并会核对是否出现在本轮查询结果中。\r
\r
## 我在聊天里说“确认”，为什么没有执行？\r
\r
这是有意的设计。授权只能在确认卡上完成，并且绑定卡上显示的那一笔。这样即使模型被诱导，或者有人冒用你的聊天窗口，也不能靠一句话转走钱。\r
\r
## 确认卡过期了怎么办？\r
\r
确认卡 15 分钟内有效。过期后重新说一遍需求，生成新的卡片即可。\r
\r
## 验证码在哪？\r
\r
演示模式下短信是模拟的：点击确认卡上的“发送验证码”，验证码会显示在页面的“模拟手机”里。也可以使用认证器动态码。\r
\r
## 打开网页提示没有权限？\r
\r
请使用启动窗口里打印的完整链接（带 \`#token=…\`）。手机需要先[配对](#/mobile)。\r
\r
## 手机打不开？\r
\r
确认三件事：访问方式设为局域网并已重启；手机和电脑连同一个 Wi-Fi 或热点；已经用配对码配对过。部分公共 Wi-Fi 会隔离设备，可以改用手机热点。\r
\r
## 飞书机器人不回复？\r
\r
检查 \`data/feishu-worker.log\` 是否显示已连接；确认已安装 \`requirements-channels.txt\`；确认在飞书开放平台选择了长连接并发布了版本；确认已用 \`python -m scripts.pair --feishu\` 绑定。\r
\r
## Windows 提示“无法加载脚本，因为在此系统上禁止运行脚本”？\r
\r
双击 \`TRUSTA.cmd\` 启动即可，它会以 \`-ExecutionPolicy Bypass\` 运行启动脚本。或者在 PowerShell 里运行：\r
\r
\`\`\`powershell\r
powershell -ExecutionPolicy Bypass -File .\\start.ps1\r
\`\`\`\r
\r
## 安装依赖很慢或失败？\r
\r
国内网络可以给 pip 配置镜像，例如：\r
\r
\`\`\`bash\r
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple\r
\`\`\`\r
\r
然后重新运行安装命令。\r
\r
## 数据保存在哪？怎么卸载？\r
\r
所有数据都在 TRUSTA 文件夹里：\`data/\` 是数据库、密钥和日志，\`.env\` 是配置。删除整个文件夹即完全卸载。\r
\r
## 区块链和零知识证明是必须的吗？\r
\r
不是。这一层用于多家机构的 Agent 协作，默认关闭；单机使用时，签名通信、证据链和审计已经全部生效。见[跨机构协作](#/cross-institution)。\r
`,ve=`# 飞书接入\r
\r
把 TRUSTA 接成飞书机器人后，可以在飞书里和它对话。默认使用**长连接**：TRUSTA 主动连到飞书，不需要公网地址。\r
\r
## 1. 在飞书开放平台创建应用\r
\r
1. 创建企业自建应用，开启**机器人**能力。\r
2. “事件与回调”选择**使用长连接接收事件**。\r
3. 添加事件 \`im.message.receive_v1\`，以及卡片回调。\r
4. 发布版本。\r
5. 在“凭证与基础信息”里找到 **App ID**（以 \`cli_\` 开头）和 **App Secret**。\r
\r
## 2. 填进 TRUSTA\r
\r
\`\`\`bash\r
pip install -r requirements-channels.txt   # 长连接需要 lark-oapi\r
python -m scripts.setup\r
\`\`\`\r
\r
在“接入飞书机器人？”一步选 \`y\`，填 App ID、App Secret，连接方式选 \`longconn\`。然后重启 TRUSTA。启动时窗口里会显示“飞书长连接已启动”，日志在 \`data/feishu-worker.log\`。\r
\r
## 3. 绑定你的账户\r
\r
飞书用户必须先绑定，才能以你的身份使用 TRUSTA：\r
\r
\`\`\`bash\r
python -m scripts.pair --feishu\r
\`\`\`\r
\r
窗口会显示一条“绑定 123456”。把这条消息私聊发给机器人即可。绑定码 5 分钟内有效，只能用一次。\r
\r
## 在飞书里能做什么\r
\r
- 所有查询和对话都可以直接在飞书完成。\r
- **黄色**操作：在飞书卡片上点确认。\r
- **红色**操作：飞书里不能输入验证码，机器人会给一个链接，在 TRUSTA 网页里打开同一个会话完成验证。这个链接使用你在[访问方式](#/setup)里设置的地址（局域网或隧道），所以手机也能打开。\r
\r
## Webhook 模式\r
\r
如果你已经有公网地址，也可以选 \`webhook\` 模式：飞书把事件推送到 \`POST /api/channels/feishu/webhook\`。需要额外填写 Verification Token，以及可选的 Encrypt Key。\r
`,ye="# 安装\r\n\r\nTRUSTA 有四种安装方式，效果一样，按你的习惯选。所有方式都只在一个文件夹里安装，不会改动系统环境。\r\n\r\n| 方式 | 适合 | 需要 |\r\n|---|---|---|\r\n| 便携版安装包 | 只想用，不想装 Python（Windows） | 无 |\r\n| 一行命令 | 大多数人 | Python 3.11+ |\r\n| 源码 | 想改代码、跑测试、接自己的银行和模型 | Python 3.11+、git |\r\n\r\n## 便携版（Windows）\r\n\r\n1. 下载 `TRUSTA-windows-x64.zip`（[发布页](https://github.com/piggyz666/Trusta/releases)）。\r\n2. 解压到任意文件夹，例如 `D:\\TRUSTA`。\r\n3. 双击 `TRUSTA.cmd`。首次运行会打开[配置向导](#/setup)，之后直接启动。\r\n\r\n压缩包里自带 Python 运行环境（在 `runtime\\` 里）和全部依赖，不需要另外安装任何东西。数据保存在同一文件夹的 `data\\` 里，删除文件夹即完全卸载。\r\n\r\nmacOS 和 Linux 请用一行命令安装（见下一节）。\r\n\r\n## 一行命令\r\n\r\n**Windows（PowerShell）**\r\n\r\n```powershell\r\nirm https://raw.githubusercontent.com/piggyz666/Trusta/main/install.ps1 | iex\r\n```\r\n\r\n**macOS / Linux**\r\n\r\n```bash\r\ncurl -fsSL https://raw.githubusercontent.com/piggyz666/Trusta/main/install.sh | bash\r\n```\r\n\r\n安装脚本会依次：\r\n\r\n1. 检查 Python 3.11+。Windows 上没有时，会询问是否用 `winget` 为当前用户安装 Python 3.12；macOS / Linux 会提示安装方法后退出。\r\n2. 把代码下载到 `~/TRUSTA`（Windows 为 `%USERPROFILE%\\TRUSTA`）。有 git 时用 `git clone`，没有时下载源码压缩包。\r\n3. 在该目录创建独立的虚拟环境 `.venv`，安装依赖。\r\n4. 打开配置向导。\r\n\r\n可以用环境变量调整：\r\n\r\n| 变量 | 作用 | 默认 |\r\n|---|---|---|\r\n| `TRUSTA_HOME` | 安装目录 | `~/TRUSTA` |\r\n| `TRUSTA_BRANCH` | 下载哪个分支 | `main` |\r\n| `TRUSTA_NO_SETUP` | 设为 `1` 时跳过配置向导 | — |\r\n\r\n再次运行同一条命令会更新代码（git 安装时执行 `git pull`）并保留你的配置和数据。\r\n\r\n## 从源码运行\r\n\r\n```bash\r\ngit clone https://github.com/piggyz666/Trusta.git && cd Trusta\r\npython -m venv .venv\r\nsource .venv/bin/activate            # Windows: .venv\\Scripts\\activate\r\npip install -r requirements.txt -r requirements-channels.txt\r\npython -m scripts.setup\r\n./start.sh                           # Windows: .\\start.ps1\r\n```\r\n\r\n- `requirements.txt` 是运行必需的依赖。\r\n- `requirements-channels.txt` 是可选的：飞书长连接和终端二维码。\r\n- `requirements-llm.txt`、`requirements-phase6.txt`、`requirements-evaluation.txt` 用于评测和外部审计集成，日常使用不需要。\r\n\r\n修改网页前端后需要重新构建（需要 Node.js）：\r\n\r\n```bash\r\ncd frontend-app\r\nnpm install\r\nnpm run build\r\n```\r\n\r\n构建结果在 `frontend/dist`，由后端直接提供。\r\n\r\n## 启动和停止\r\n\r\n| 系统 | 启动 |\r\n|---|---|\r\n| Windows | 双击 `TRUSTA.cmd`，或在 PowerShell 里 `.\\start.ps1` |\r\n| macOS / Linux | `./start.sh` |\r\n\r\n启动脚本会同时运行：API 服务、审计检查点 worker、计划任务 worker（生日下单、周期转账等）；配置了飞书长连接时还会启动飞书 worker。后台 worker 的日志写在 `data/*.log`。关闭窗口或按 `Ctrl+C` 会一起停止。\r\n\r\n启动脚本按以下顺序选择 Python：环境变量 `TRUSTA_PYTHON` → 便携版自带的 `runtime/python` → 安装脚本创建的 `.venv` → 系统里的 `python`。\r\n\r\n## 卸载\r\n\r\nTRUSTA 只写入它自己的文件夹。删除整个文件夹即可；`data/` 里是数据库和密钥，`.env` 里是你的配置，如有需要先备份。\r\n",be=`# 集成\r
\r
TRUSTA 的核心是一条可信执行链：AI 只能提议，Agent 之间签名交接，资金动作由你授权。这条链可以从多个渠道进入，接不同的大模型和银行，并把证据锚定到区块链上。本页只列真实接通的集成，并注明验证程度：\r
\r
- **已实测**：在真实服务或真实网络上跑通过。\r
- **本地测试**：实现完成并通过本地测试，尚未连接官方环境。\r
- **内置**：TRUSTA 自带，不依赖外部服务。\r
\r
## 渠道\r
\r
所有渠道共用同一个会话服务和同一套授权规则。\r
\r
| 集成 | 说明 | 状态 |\r
|---|---|---|\r
| 网页 | 桌面浏览器打开，交互卡片、总览、设置 | 已实测 |\r
| 手机 H5 | 局域网扫码配对，可添加到主屏幕全屏使用，见[手机访问](#/mobile) | 已实测 |\r
| 飞书机器人 | 长连接免公网；黄色操作在卡片内确认，红色操作回到网页验证，见[飞书接入](#/feishu) | 已实测 |\r
| 终端对话 | \`python -m scripts.chat_cli\`，在命令行里对话、确认、查看决策链 | 已实测 |\r
| HTTP API | REST + SSE 流式输出，可以接你自己的界面，见 [HTTP API](#/api) | 已实测 |\r
\r
## 大模型\r
\r
模型只负责理解和提议；换哪个模型，授权规则和签名链都不变。\r
\r
| 集成 | 说明 | 状态 |\r
|---|---|---|\r
| DeepSeek | 对话层默认模型 \`deepseek-flash\` | 已实测 |\r
| 兼容 OpenAI 接口的模型 | 在配置向导里填接口地址和模型名即可接入对话层 | 内置 |\r
| Kimi | \`kimi-k2.6\`，在统一的 40 个场景评测中真实调用 | 已实测 |\r
| MiMo | \`mimo-v2.6-flash\`，在统一评测中真实调用 | 已实测 |\r
| Gemini | \`gemini-3.1-flash-lite\`，评测中在本地银行完成一笔转账闭环 | 已实测 |\r
| GLM | \`glm-4-flash\`，在统一评测中真实调用 | 已实测 |\r
| 规则引擎 | 不接模型也能用，只识别标准说法 | 内置 |\r
\r
> 统一评测使用同一组冻结的提示词、业务契约和 40 个场景（20 个正常、20 个攻击）。各模型的表现差异很大，原始结果保留在仓库的 \`docs/LLM_Final_Live_Acceptance.md\` 和 \`docs/LLM_Integration_Planning_Final_Acceptance.md\` 中。\r
\r
## 银行\r
\r
TRUSTA 根据实际接入、并且探测通过的能力决定哪些功能可用。\r
\r
| 集成 | 说明 | 状态 |\r
|---|---|---|\r
| 本地虚拟银行 | 六大场景全部可用，含入账推送；数据全部虚构 | 内置 |\r
| Revolut 沙箱 | 官方沙箱：真实账户与交易读回，以及一笔逐笔授权的 0.01 EUR 付款 | 已实测 |\r
| Starling | 适配器与请求签名已实现，通过本地协议测试，尚未调用官方沙箱 | 本地测试 |\r
\r
接入外部银行沙箱：参考 \`config/bank.*.example.toml\` 写一份 \`config/bank.*.local.toml\`，在[配置向导](#/setup)的“银行”一步选择外部银行。\r
\r
## 可信基础设施\r
\r
| 集成 | 说明 | 状态 |\r
|---|---|---|\r
| ECDSA P-256 | 每个 Agent 独立密钥，签名每条消息，见[多 Agent 签名通信](#/agent-communication) | 内置 |\r
| FISCO BCOS + WeID | 联盟链身份与 \`CollaborationAnchor\` 合约，见[跨机构协作](#/cross-institution) | 已实测（单机 8 节点测试链） |\r
| Groth16 | 零知识能力准入证明，真实生成与验证 | 已实测（开发用可信设置） |\r
| 以太坊 Sepolia | 审计根写入公共测试网，公开验收通过 | 已实测（测试网，非主网） |\r
| MetaMask | 交易在钱包本机签署，私钥不离开钱包 | 已实测 |\r
\r
## 网络与自动化\r
\r
| 集成 | 说明 | 状态 |\r
|---|---|---|\r
| 局域网配对 | 一次性配对码，每台设备独立令牌，可吊销 | 已实测 |\r
| Cloudflare Tunnel | 已有隧道时可通过公网地址访问 | 内置 |\r
| 自动化规则 | “当……就……”：5 类触发（到点、入账、余额低于、某类消费超预算、大额消费）× 7 类动作（提醒、转账、存心愿金、申购理财、冻结卡、关闭交易开关、转人工）；资金动作仍逐笔确认 | 内置 |\r
| 定时计划 | 生日下单、周期转账等，到期时由后台 worker 发起，再请你确认 | 内置 |\r
\r
## 想接新的渠道或银行？\r
\r
- 新渠道：参考 \`backend/channels/feishu.py\`，把消息转给统一的对话接口 \`/api/chat\`，并把确认卡渲染成该渠道的交互卡片。渠道不能绕过确认卡授权。\r
- 新银行：参考 \`backend/bank_sdk/\` 中的适配器，实现读取和执行接口；TRUSTA 会根据探测结果自动点亮对应功能。\r
`,xe=`# 手机访问\r
\r
网页和手机 H5 是同一套页面，按屏幕自动适配。默认只能在本机访问；要用手机，需要把访问方式改为局域网或隧道，并配对一次。\r
\r
## 1. 打开局域网访问\r
\r
\`\`\`bash\r
python -m scripts.setup\r
\`\`\`\r
\r
在“访问方式”一步选 **局域网**，然后重启 TRUSTA。\r
\r
## 2. 配对手机\r
\r
两种方式任选：\r
\r
- **网页里**：打开“设置 → 访问与设备”，生成配对码，用手机扫码。\r
- **终端里**：\r
\r
\`\`\`bash\r
python -m scripts.pair\r
\`\`\`\r
\r
会显示配对地址、二维码（安装了 \`qrcode\` 包时）和 6 位配对码。手机连接同一个 Wi-Fi 或热点，扫码或在手机浏览器打开地址即可。配对码 5 分钟内有效，只能用一次。\r
\r
配对成功后，手机会拿到自己的设备令牌，以后直接打开即可。在手机浏览器里选择“添加到主屏幕”，可以像 App 一样全屏使用。\r
\r
## 管理设备\r
\r
\`\`\`bash\r
python -m scripts.pair --devices        # 列出已配对设备\r
python -m scripts.pair --revoke 设备ID   # 吊销某台设备\r
\`\`\`\r
\r
网页“设置 → 访问与设备”里也可以查看和吊销。\r
\r
## 不在同一个网络时\r
\r
如果你已经有 Cloudflare Tunnel 等公网地址，在配置向导里选择 **隧道**，填写域名（不带 \`https://\`）。没有隧道域名时会自动改为局域网模式。\r
\r
> 局域网和隧道模式下，任何能访问这个地址的设备都需要配对才能使用；不过仅本机模式仍然是最安全的选择。\r
`,Se=`# TRUSTA 是什么\r
\r
TRUSTA 是一个运行在你自己电脑上的银行 AI 助手。你用一句话说出想办的事，它理解后给出一张可以操作的卡片；涉及资金的每一步，都要你在卡片上亲手授权。\r
\r
## 一句话，一张卡片\r
\r
| 场景 | 可以这样说 |\r
|---|---|\r
| 智能转账 | “给张三转500元”“每月1号给房东转3000” |\r
| 账单分析 | “这个月花了多少钱”“上个月外卖花了多少” |\r
| 理财 | “推荐适合我的理财”“买1000低风险”“做一下风险测评” |\r
| 卡片管理 | “我的卡丢了”“关闭信用卡境外交易” |\r
| 订阅与代扣 | “我有哪些订阅”“最近有什么要续费” |\r
| 跨场景联动 | “下个月妈妈生日，帮我存2000买礼物”“下周去日本玩5天，帮我安排一下” |\r
\r
回复是**可交互卡片**：转账卡上直接改金额，账单饼图点分类看明细，理财卡选产品直接申购，卡片开关直接拨动。\r
\r
## 设计原则\r
\r
- **AI 只能提议，不能授权。** 大模型只输出候选操作；每个参数都必须能在你的原话里找到出处，否则追问。在聊天里说“确认”不会执行任何操作，授权只能在确认卡上完成。\r
- **风险分级由银行规则决定。** 查询直接执行，资金和卡片操作要你确认，大额、新收款人、挂失等还要验证码。模型和前端都改不了等级。详见[授权等级](#/authorization)。\r
- **每一步都可追溯。** 六个 Agent 之间的每条消息都签名，每次交接都留下证据，事后可以离线验证。详见[多 Agent 签名通信](#/agent-communication)。\r
- **最少可见。** 大模型看不到余额、流水、卡号和验证码；回复里的数字由银行系统查询后填入。\r
\r
## 它由什么组成\r
\r
\`\`\`\r
你的一句话\r
  → 输入安全检查（注入、诱导转账、信息套取）\r
  → 总控 Agent：理解意图、抽取参数（每个参数要有原话出处）\r
  → 规划 Agent：拆成步骤，校验器检查\r
  → 业务 Agent（交易 / 财务 / 理财 / 客服）：查询或提出方案\r
  → 策略引擎定级 → 确认卡 → 你授权（必要时加验证码）\r
  → 封印的执行合约 → 银行网关执行 → 独立核验 → 回执\r
  → 审计哈希链 + 签名 Merkle 检查点\r
\`\`\`\r
\r
- **后端**：Python 3.11+，SQLite，\`cryptography\`（ECDSA P-256）。\r
- **前端**：React 网页，桌面和手机同一套页面；也可以接入飞书机器人。\r
- **银行**：默认是本地虚拟银行沙箱，演示数据全部虚构；也可以按配置接入 Revolut / Starling 等外部银行沙箱。\r
- **大模型**：推荐 DeepSeek，也支持其他兼容 OpenAI 接口的模型；不接模型时用规则引擎，只认标准说法。\r
\r
## 下一步\r
\r
- 第一次使用：[快速开始](#/quickstart)\r
- 想了解安全设计：[授权等级](#/authorization)、[多 Agent 签名通信](#/agent-communication)\r
`,Ce=`# 快速开始\r
\r
五分钟内在你自己的电脑上跑起 TRUSTA，并完成第一笔（虚拟的）转账。\r
\r
> TRUSTA 默认连接本地虚拟银行沙箱，演示数据全部虚构，不会动到任何真实账户。\r
\r
## 1. 安装\r
\r
选一种方式即可，详见[安装](#/install)。\r
\r
**Windows**：下载便携版压缩包，解压后双击 \`TRUSTA.cmd\`；或者在 PowerShell 里运行：\r
\r
\`\`\`powershell\r
irm https://raw.githubusercontent.com/piggyz666/Trusta/main/install.ps1 | iex\r
\`\`\`\r
\r
**macOS / Linux**：\r
\r
\`\`\`bash\r
curl -fsSL https://raw.githubusercontent.com/piggyz666/Trusta/main/install.sh | bash\r
\`\`\`\r
\r
## 2. 配置\r
\r
安装完成后会自动打开配置向导，一共四步。第一次可以全部直接回车：\r
\r
1. **大模型**：选 DeepSeek 并填 API Key；或者先选“不接入”，用规则引擎。\r
2. **银行**：本地沙箱银行（默认）。\r
3. **访问方式**：仅本机（默认，最安全）。\r
4. **安全与演示**：\`competition\` 安全档位 + 演示模式（短信验证码会直接显示在页面上）。\r
\r
以后随时可以重新运行 \`python -m scripts.setup\` 修改。详见[首次配置](#/setup)。\r
\r
## 3. 启动\r
\r
\`\`\`bash\r
./start.sh          # macOS / Linux\r
\`\`\`\r
\r
\`\`\`powershell\r
.\\start.ps1         # Windows，或者双击 TRUSTA.cmd\r
\`\`\`\r
\r
窗口里会打印一条 \`http://127.0.0.1:8000/#token=…\` 链接，用浏览器打开。链接里的 token 是本机访问凭证，不要发给别人。\r
\r
## 4. 试几句话\r
\r
- “我这个月花了多少钱”：只读查询，直接返回报告卡。\r
- “给张三转500元”：生成一张黄色确认卡，点“确认”才会执行。\r
- “我的卡丢了”：红色操作，需要验证码；演示模式下验证码显示在“模拟手机”里。\r
\r
## 5. 看看它是怎么做到的\r
\r
在网页“设置 → 外观”里打开**开发者模式**，每条回复下面会出现“查看决策过程”，可以看到 Agent 之间的每条签名消息，并当场重新验签。\r
\r
## 接下来\r
\r
- 用手机访问：[手机访问](#/mobile)\r
- 接入飞书：[飞书接入](#/feishu)\r
- 在终端里对话：\`python -m scripts.chat_cli\`\r
`,we=`# 首次配置\r
\r
配置向导会把设置写入项目目录下的 \`.env\`。这个文件只在你的电脑上，已被 git 忽略；向导写入时会收紧文件权限，输入密钥时不回显。\r
\r
\`\`\`bash\r
python -m scripts.setup            # 交互式配置\r
python -m scripts.setup --status   # 只显示功能表\r
python -m scripts.setup --probe    # 探测连通性后显示功能表（会调用一次模型）\r
\`\`\`\r
\r
## 1/4 大模型\r
\r
| 选项 | 说明 |\r
|---|---|\r
| DeepSeek（推荐） | 填 API Key（以 \`sk-\` 开头），模型名默认 \`deepseek-flash\` |\r
| 其他兼容 OpenAI 接口的模型 | 填接口地址（\`https://…/chat/completions\`）、模型名和 Key |\r
| 不接入 | 使用规则引擎，只识别标准说法，例如“给张三转500元” |\r
\r
需要时可以填 HTTPS 代理。无论接哪个模型，模型都只能提出方案，看不到余额、流水、卡号和验证码。\r
\r
## 2/4 银行\r
\r
| 选项 | 说明 |\r
|---|---|\r
| 本地沙箱银行（默认） | 六大场景全部可用，包括入账推送；演示数据全部虚构 |\r
| 外部银行沙箱 | Revolut / Starling 等，需要按 \`config/bank.*.example.toml\` 写一份 \`config/bank.*.local.toml\` |\r
\r
## 3/4 访问方式与渠道\r
\r
| 选项 | 说明 |\r
|---|---|\r
| 仅本机（默认） | 只能在这台电脑的浏览器里打开，最安全 |\r
| 局域网 | 手机连同一 Wi-Fi 或热点，扫码配对一次即可使用，见[手机访问](#/mobile) |\r
| 隧道 | 已有 Cloudflare Tunnel 等公网地址时使用；没有隧道域名会自动改为局域网 |\r
\r
接着会询问是否接入飞书机器人，见[飞书接入](#/feishu)。\r
\r
## 4/4 安全与演示\r
\r
| 设置 | 说明 |\r
|---|---|\r
| 安全档位 \`competition\`（默认） | 强验证：当日累计、转账频率、新收款人、理财申赎等规则全部生效 |\r
| 安全档位 \`legacy\` | 早期版本的规则，仅用于对比 |\r
| 演示模式 \`true\`（默认） | 模拟短信验证码直接显示在页面的“模拟手机”里；计划任务可以快进 |\r
| 演示模式 \`false\` | 不回显验证码 |\r
\r
## 功能表\r
\r
向导最后会显示一张功能表。TRUSTA 根据实际接入、并且探测通过的能力决定哪些功能可用：\r
\r
\`\`\`\r
模型：deepseek-flash（VERIFIED）  银行：virtual/local  安全档位：competition\r
\r
【六大场景】\r
  ✔ 可用  智能转账（姓名 / 手机号 / 称呼 / 定时 / 周期 / 备注）\r
  ✔ 可用  账单分析 / 消费查询 / 异常识别\r
  ...\r
【渠道】\r
  ✘ 不可用 飞书渠道  —— 缺少：飞书机器人\r
        开通方法：运行 python -m scripts.setup 填写 FEISHU_APP_ID / FEISHU_APP_SECRET\r
\`\`\`\r
\r
没开通的功能，助手看不到也调用不了；网页的“功能”页也会告诉你需要接什么。\r
\r
完整的配置项见[配置项](#/configuration)。\r
`;function C(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}var w=C();function Te(e){w=e}var T={exec:()=>null};function E(e,t=``){let n=typeof e==`string`?e:e.source,r={replace:(e,t)=>{let i=typeof t==`string`?t:t.source;return i=i.replace(D.caret,`$1`),n=n.replace(e,i),r},getRegex:()=>new RegExp(n,t)};return r}var D={codeRemoveIndent:/^(?: {1,4}| {0,3}\t)/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceTabs:/^\t+/,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] /,listReplaceTask:/^\[[ xX]\] +/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,unescapeTest:/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/gi,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:e=>RegExp(`^( {0,3}${e})((?:[	 ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:e=>RegExp(`^ {0,${Math.min(3,e-1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),hrRegex:e=>RegExp(`^ {0,${Math.min(3,e-1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),fencesBeginRegex:e=>RegExp(`^ {0,${Math.min(3,e-1)}}(?:\`\`\`|~~~)`),headingBeginRegex:e=>RegExp(`^ {0,${Math.min(3,e-1)}}#`),htmlBeginRegex:e=>RegExp(`^ {0,${Math.min(3,e-1)}}<(?:[a-z].*>|!--)`,`i`)},Ee=/^(?:[ \t]*(?:\n|$))+/,De=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,Oe=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,O=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,ke=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,k=/(?:[*+-]|\d{1,9}[.)])/,Ae=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,je=E(Ae).replace(/bull/g,k).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,``).getRegex(),Me=E(Ae).replace(/bull/g,k).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),A=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,Ne=/^[^\n]+/,j=/(?!\s*\])(?:\\.|[^\[\]\\])+/,Pe=E(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace(`label`,j).replace(`title`,/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),Fe=E(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g,k).getRegex(),M=`address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul`,N=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,Ie=E(`^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))`,`i`).replace(`comment`,N).replace(`tag`,M).replace(`attribute`,/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),Le=E(A).replace(`hr`,O).replace(`heading`,` {0,3}#{1,6}(?:\\s|$)`).replace(`|lheading`,``).replace(`|table`,``).replace(`blockquote`,` {0,3}>`).replace(`fences`," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace(`list`,` {0,3}(?:[*+-]|1[.)]) `).replace(`html`,`</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)`).replace(`tag`,M).getRegex(),P={blockquote:E(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace(`paragraph`,Le).getRegex(),code:De,def:Pe,fences:Oe,heading:ke,hr:O,html:Ie,lheading:je,list:Fe,newline:Ee,paragraph:Le,table:T,text:Ne},Re=E(`^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)`).replace(`hr`,O).replace(`heading`,` {0,3}#{1,6}(?:\\s|$)`).replace(`blockquote`,` {0,3}>`).replace(`code`,`(?: {4}| {0,3}	)[^\\n]`).replace(`fences`," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace(`list`,` {0,3}(?:[*+-]|1[.)]) `).replace(`html`,`</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)`).replace(`tag`,M).getRegex(),ze={...P,lheading:Me,table:Re,paragraph:E(A).replace(`hr`,O).replace(`heading`,` {0,3}#{1,6}(?:\\s|$)`).replace(`|lheading`,``).replace(`table`,Re).replace(`blockquote`,` {0,3}>`).replace(`fences`," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace(`list`,` {0,3}(?:[*+-]|1[.)]) `).replace(`html`,`</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)`).replace(`tag`,M).getRegex()},Be={...P,html:E(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace(`comment`,N).replace(/tag/g,`(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b`).getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:T,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:E(A).replace(`hr`,O).replace(`heading`,` *#{1,6} *[^
]`).replace(`lheading`,je).replace(`|table`,``).replace(`blockquote`,` {0,3}>`).replace(`|fences`,``).replace(`|list`,``).replace(`|html`,``).replace(`|tag`,``).getRegex()},Ve=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,He=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,Ue=/^( {2,}|\\)\n(?!\s*$)/,We=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,F=/[\p{P}\p{S}]/u,I=/[\s\p{P}\p{S}]/u,Ge=/[^\s\p{P}\p{S}]/u,Ke=E(/^((?![*_])punctSpace)/,`u`).replace(/punctSpace/g,I).getRegex(),qe=/(?!~)[\p{P}\p{S}]/u,Je=/(?!~)[\s\p{P}\p{S}]/u,Ye=/(?:[^\s\p{P}\p{S}]|~)/u,Xe=/\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g,Ze=/^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/,Qe=E(Ze,`u`).replace(/punct/g,F).getRegex(),$e=E(Ze,`u`).replace(/punct/g,qe).getRegex(),et=`^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)`,tt=E(et,`gu`).replace(/notPunctSpace/g,Ge).replace(/punctSpace/g,I).replace(/punct/g,F).getRegex(),nt=E(et,`gu`).replace(/notPunctSpace/g,Ye).replace(/punctSpace/g,Je).replace(/punct/g,qe).getRegex(),rt=E(`^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)`,`gu`).replace(/notPunctSpace/g,Ge).replace(/punctSpace/g,I).replace(/punct/g,F).getRegex(),it=E(/\\(punct)/,`gu`).replace(/punct/g,F).getRegex(),at=E(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace(`scheme`,/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace(`email`,/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),ot=E(N).replace(`(?:-->|$)`,`-->`).getRegex(),st=E(`^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>`).replace(`comment`,ot).replace(`attribute`,/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),L=/(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/,ct=E(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace(`label`,L).replace(`href`,/<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace(`title`,/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),lt=E(/^!?\[(label)\]\[(ref)\]/).replace(`label`,L).replace(`ref`,j).getRegex(),ut=E(/^!?\[(ref)\](?:\[\])?/).replace(`ref`,j).getRegex(),R={_backpedal:T,anyPunctuation:it,autolink:at,blockSkip:Xe,br:Ue,code:He,del:T,emStrongLDelim:Qe,emStrongRDelimAst:tt,emStrongRDelimUnd:rt,escape:Ve,link:ct,nolink:ut,punctuation:Ke,reflink:lt,reflinkSearch:E(`reflink|nolink(?!\\()`,`g`).replace(`reflink`,lt).replace(`nolink`,ut).getRegex(),tag:st,text:We,url:T},dt={...R,link:E(/^!?\[(label)\]\((.*?)\)/).replace(`label`,L).getRegex(),reflink:E(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace(`label`,L).getRegex()},z={...R,emStrongRDelimAst:nt,emStrongLDelim:$e,url:E(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/,`i`).replace(`email`,/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,text:/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/},ft={...z,br:E(Ue).replace(`{2,}`,`*`).getRegex(),text:E(z.text).replace(`\\b_`,`\\b_| {2,}\\n`).replace(/\{2,\}/g,`*`).getRegex()},B={normal:P,gfm:ze,pedantic:Be},V={normal:R,gfm:z,breaks:ft,pedantic:dt},pt={"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`},mt=e=>pt[e];function H(e,t){if(t){if(D.escapeTest.test(e))return e.replace(D.escapeReplace,mt)}else if(D.escapeTestNoEncode.test(e))return e.replace(D.escapeReplaceNoEncode,mt);return e}function ht(e){try{e=encodeURI(e).replace(D.percentDecode,`%`)}catch{return null}return e}function gt(e,t){let n=e.replace(D.findPipe,(e,t,n)=>{let r=!1,i=t;for(;--i>=0&&n[i]===`\\`;)r=!r;return r?`|`:` |`}).split(D.splitPipe),r=0;if(n[0].trim()||n.shift(),n.length>0&&!n.at(-1)?.trim()&&n.pop(),t){if(n.length>t)n.splice(t);else for(;n.length<t;)n.push(``)}for(;r<n.length;r++)n[r]=n[r].trim().replace(D.slashPipe,`|`);return n}function U(e,t,n){let r=e.length;if(r===0)return``;let i=0;for(;i<r;){let a=e.charAt(r-i-1);if(a===t&&!n)i++;else if(a!==t&&n)i++;else break}return e.slice(0,r-i)}function _t(e,t){if(e.indexOf(t[1])===-1)return-1;let n=0;for(let r=0;r<e.length;r++)if(e[r]===`\\`)r++;else if(e[r]===t[0])n++;else if(e[r]===t[1]&&(n--,n<0))return r;return n>0?-2:-1}function vt(e,t,n,r,i){let a=t.href,o=t.title||null,s=e[1].replace(i.other.outputLinkReplace,`$1`);r.state.inLink=!0;let c={type:e[0].charAt(0)===`!`?`image`:`link`,raw:n,href:a,title:o,text:s,tokens:r.inlineTokens(s)};return r.state.inLink=!1,c}function yt(e,t,n){let r=e.match(n.other.indentCodeCompensation);if(r===null)return t;let i=r[1];return t.split(`
`).map(e=>{let t=e.match(n.other.beginningSpace);if(t===null)return e;let[r]=t;return r.length>=i.length?e.slice(i.length):e}).join(`
`)}var W=class{options;rules;lexer;constructor(e){this.options=e||w}space(e){let t=this.rules.block.newline.exec(e);if(t&&t[0].length>0)return{type:`space`,raw:t[0]}}code(e){let t=this.rules.block.code.exec(e);if(t){let e=t[0].replace(this.rules.other.codeRemoveIndent,``);return{type:`code`,raw:t[0],codeBlockStyle:`indented`,text:this.options.pedantic?e:U(e,`
`)}}}fences(e){let t=this.rules.block.fences.exec(e);if(t){let e=t[0],n=yt(e,t[3]||``,this.rules);return{type:`code`,raw:e,lang:t[2]?t[2].trim().replace(this.rules.inline.anyPunctuation,`$1`):t[2],text:n}}}heading(e){let t=this.rules.block.heading.exec(e);if(t){let e=t[2].trim();if(this.rules.other.endingHash.test(e)){let t=U(e,`#`);(this.options.pedantic||!t||this.rules.other.endingSpaceChar.test(t))&&(e=t.trim())}return{type:`heading`,raw:t[0],depth:t[1].length,text:e,tokens:this.lexer.inline(e)}}}hr(e){let t=this.rules.block.hr.exec(e);if(t)return{type:`hr`,raw:U(t[0],`
`)}}blockquote(e){let t=this.rules.block.blockquote.exec(e);if(t){let e=U(t[0],`
`).split(`
`),n=``,r=``,i=[];for(;e.length>0;){let t=!1,a=[],o=0;for(;o<e.length;o++)if(this.rules.other.blockquoteStart.test(e[o]))a.push(e[o]),t=!0;else if(!t)a.push(e[o]);else break;e=e.slice(o);let s=a.join(`
`),c=s.replace(this.rules.other.blockquoteSetextReplace,`
    $1`).replace(this.rules.other.blockquoteSetextReplace2,``);n=n?`${n}
${s}`:s,r=r?`${r}
${c}`:c;let l=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(c,i,!0),this.lexer.state.top=l,e.length===0)break;let u=i.at(-1);if(u?.type===`code`)break;if(u?.type===`blockquote`){let t=u,a=t.raw+`
`+e.join(`
`),o=this.blockquote(a);i[i.length-1]=o,n=n.substring(0,n.length-t.raw.length)+o.raw,r=r.substring(0,r.length-t.text.length)+o.text;break}if(u?.type===`list`){let t=u,a=t.raw+`
`+e.join(`
`),o=this.list(a);i[i.length-1]=o,n=n.substring(0,n.length-u.raw.length)+o.raw,r=r.substring(0,r.length-t.raw.length)+o.raw,e=a.substring(i.at(-1).raw.length).split(`
`)}}return{type:`blockquote`,raw:n,tokens:i,text:r}}}list(e){let t=this.rules.block.list.exec(e);if(t){let n=t[1].trim(),r=n.length>1,i={type:`list`,raw:``,ordered:r,start:r?+n.slice(0,-1):``,loose:!1,items:[]};n=r?`\\d{1,9}\\${n.slice(-1)}`:`\\${n}`,this.options.pedantic&&(n=r?n:`[*+-]`);let a=this.rules.other.listItemRegex(n),o=!1;for(;e;){let n=!1,r=``,s=``;if(!(t=a.exec(e))||this.rules.block.hr.test(e))break;r=t[0],e=e.substring(r.length);let c=t[2].split(`
`,1)[0].replace(this.rules.other.listReplaceTabs,e=>` `.repeat(3*e.length)),l=e.split(`
`,1)[0],u=!c.trim(),d=0;if(this.options.pedantic?(d=2,s=c.trimStart()):u?d=t[1].length+1:(d=t[2].search(this.rules.other.nonSpaceChar),d=d>4?1:d,s=c.slice(d),d+=t[1].length),u&&this.rules.other.blankLine.test(l)&&(r+=l+`
`,e=e.substring(l.length+1),n=!0),!n){let t=this.rules.other.nextBulletRegex(d),n=this.rules.other.hrRegex(d),i=this.rules.other.fencesBeginRegex(d),a=this.rules.other.headingBeginRegex(d),o=this.rules.other.htmlBeginRegex(d);for(;e;){let f=e.split(`
`,1)[0],p;if(l=f,this.options.pedantic?(l=l.replace(this.rules.other.listReplaceNesting,`  `),p=l):p=l.replace(this.rules.other.tabCharGlobal,`    `),i.test(l)||a.test(l)||o.test(l)||t.test(l)||n.test(l))break;if(p.search(this.rules.other.nonSpaceChar)>=d||!l.trim())s+=`
`+p.slice(d);else{if(u||c.replace(this.rules.other.tabCharGlobal,`    `).search(this.rules.other.nonSpaceChar)>=4||i.test(c)||a.test(c)||n.test(c))break;s+=`
`+l}!u&&!l.trim()&&(u=!0),r+=f+`
`,e=e.substring(f.length+1),c=p.slice(d)}}i.loose||(o?i.loose=!0:this.rules.other.doubleBlankLine.test(r)&&(o=!0));let f=null,p;this.options.gfm&&(f=this.rules.other.listIsTask.exec(s),f&&(p=f[0]!==`[ ] `,s=s.replace(this.rules.other.listReplaceTask,``))),i.items.push({type:`list_item`,raw:r,task:!!f,checked:p,loose:!1,text:s,tokens:[]}),i.raw+=r}let s=i.items.at(-1);if(s)s.raw=s.raw.trimEnd(),s.text=s.text.trimEnd();else return;i.raw=i.raw.trimEnd();for(let e=0;e<i.items.length;e++)if(this.lexer.state.top=!1,i.items[e].tokens=this.lexer.blockTokens(i.items[e].text,[]),!i.loose){let t=i.items[e].tokens.filter(e=>e.type===`space`);i.loose=t.length>0&&t.some(e=>this.rules.other.anyLine.test(e.raw))}if(i.loose)for(let e=0;e<i.items.length;e++)i.items[e].loose=!0;return i}}html(e){let t=this.rules.block.html.exec(e);if(t)return{type:`html`,block:!0,raw:t[0],pre:t[1]===`pre`||t[1]===`script`||t[1]===`style`,text:t[0]}}def(e){let t=this.rules.block.def.exec(e);if(t){let e=t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal,` `),n=t[2]?t[2].replace(this.rules.other.hrefBrackets,`$1`).replace(this.rules.inline.anyPunctuation,`$1`):``,r=t[3]?t[3].substring(1,t[3].length-1).replace(this.rules.inline.anyPunctuation,`$1`):t[3];return{type:`def`,tag:e,raw:t[0],href:n,title:r}}}table(e){let t=this.rules.block.table.exec(e);if(!t||!this.rules.other.tableDelimiter.test(t[2]))return;let n=gt(t[1]),r=t[2].replace(this.rules.other.tableAlignChars,``).split(`|`),i=t[3]?.trim()?t[3].replace(this.rules.other.tableRowBlankLine,``).split(`
`):[],a={type:`table`,raw:t[0],header:[],align:[],rows:[]};if(n.length===r.length){for(let e of r)this.rules.other.tableAlignRight.test(e)?a.align.push(`right`):this.rules.other.tableAlignCenter.test(e)?a.align.push(`center`):this.rules.other.tableAlignLeft.test(e)?a.align.push(`left`):a.align.push(null);for(let e=0;e<n.length;e++)a.header.push({text:n[e],tokens:this.lexer.inline(n[e]),header:!0,align:a.align[e]});for(let e of i)a.rows.push(gt(e,a.header.length).map((e,t)=>({text:e,tokens:this.lexer.inline(e),header:!1,align:a.align[t]})));return a}}lheading(e){let t=this.rules.block.lheading.exec(e);if(t)return{type:`heading`,raw:t[0],depth:t[2].charAt(0)===`=`?1:2,text:t[1],tokens:this.lexer.inline(t[1])}}paragraph(e){let t=this.rules.block.paragraph.exec(e);if(t){let e=t[1].charAt(t[1].length-1)===`
`?t[1].slice(0,-1):t[1];return{type:`paragraph`,raw:t[0],text:e,tokens:this.lexer.inline(e)}}}text(e){let t=this.rules.block.text.exec(e);if(t)return{type:`text`,raw:t[0],text:t[0],tokens:this.lexer.inline(t[0])}}escape(e){let t=this.rules.inline.escape.exec(e);if(t)return{type:`escape`,raw:t[0],text:t[1]}}tag(e){let t=this.rules.inline.tag.exec(e);if(t)return!this.lexer.state.inLink&&this.rules.other.startATag.test(t[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&this.rules.other.endATag.test(t[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(t[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(t[0])&&(this.lexer.state.inRawBlock=!1),{type:`html`,raw:t[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:t[0]}}link(e){let t=this.rules.inline.link.exec(e);if(t){let e=t[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(e)){if(!this.rules.other.endAngleBracket.test(e))return;let t=U(e.slice(0,-1),`\\`);if((e.length-t.length)%2==0)return}else{let e=_t(t[2],`()`);if(e===-2)return;if(e>-1){let n=(t[0].indexOf(`!`)===0?5:4)+t[1].length+e;t[2]=t[2].substring(0,e),t[0]=t[0].substring(0,n).trim(),t[3]=``}}let n=t[2],r=``;if(this.options.pedantic){let e=this.rules.other.pedanticHrefTitle.exec(n);e&&(n=e[1],r=e[3])}else r=t[3]?t[3].slice(1,-1):``;return n=n.trim(),this.rules.other.startAngleBracket.test(n)&&(n=this.options.pedantic&&!this.rules.other.endAngleBracket.test(e)?n.slice(1):n.slice(1,-1)),vt(t,{href:n&&n.replace(this.rules.inline.anyPunctuation,`$1`),title:r&&r.replace(this.rules.inline.anyPunctuation,`$1`)},t[0],this.lexer,this.rules)}}reflink(e,t){let n;if((n=this.rules.inline.reflink.exec(e))||(n=this.rules.inline.nolink.exec(e))){let e=t[(n[2]||n[1]).replace(this.rules.other.multipleSpaceGlobal,` `).toLowerCase()];if(!e){let e=n[0].charAt(0);return{type:`text`,raw:e,text:e}}return vt(n,e,n[0],this.lexer,this.rules)}}emStrong(e,t,n=``){let r=this.rules.inline.emStrongLDelim.exec(e);if(r&&!(r[3]&&n.match(this.rules.other.unicodeAlphaNumeric))&&(!(r[1]||r[2])||!n||this.rules.inline.punctuation.exec(n))){let n=[...r[0]].length-1,i,a,o=n,s=0,c=r[0][0]===`*`?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(c.lastIndex=0,t=t.slice(-1*e.length+n);(r=c.exec(t))!=null;){if(i=r[1]||r[2]||r[3]||r[4]||r[5]||r[6],!i)continue;if(a=[...i].length,r[3]||r[4]){o+=a;continue}if((r[5]||r[6])&&n%3&&!((n+a)%3)){s+=a;continue}if(o-=a,o>0)continue;a=Math.min(a,a+o+s);let t=[...r[0]][0].length,c=e.slice(0,n+r.index+t+a);if(Math.min(n,a)%2){let e=c.slice(1,-1);return{type:`em`,raw:c,text:e,tokens:this.lexer.inlineTokens(e)}}let l=c.slice(2,-2);return{type:`strong`,raw:c,text:l,tokens:this.lexer.inlineTokens(l)}}}}codespan(e){let t=this.rules.inline.code.exec(e);if(t){let e=t[2].replace(this.rules.other.newLineCharGlobal,` `),n=this.rules.other.nonSpaceChar.test(e),r=this.rules.other.startingSpaceChar.test(e)&&this.rules.other.endingSpaceChar.test(e);return n&&r&&(e=e.substring(1,e.length-1)),{type:`codespan`,raw:t[0],text:e}}}br(e){let t=this.rules.inline.br.exec(e);if(t)return{type:`br`,raw:t[0]}}del(e){let t=this.rules.inline.del.exec(e);if(t)return{type:`del`,raw:t[0],text:t[2],tokens:this.lexer.inlineTokens(t[2])}}autolink(e){let t=this.rules.inline.autolink.exec(e);if(t){let e,n;return t[2]===`@`?(e=t[1],n=`mailto:`+e):(e=t[1],n=e),{type:`link`,raw:t[0],text:e,href:n,tokens:[{type:`text`,raw:e,text:e}]}}}url(e){let t;if(t=this.rules.inline.url.exec(e)){let e,n;if(t[2]===`@`)e=t[0],n=`mailto:`+e;else{let r;do r=t[0],t[0]=this.rules.inline._backpedal.exec(t[0])?.[0]??``;while(r!==t[0]);e=t[0],n=t[1]===`www.`?`http://`+t[0]:t[0]}return{type:`link`,raw:t[0],text:e,href:n,tokens:[{type:`text`,raw:e,text:e}]}}}inlineText(e){let t=this.rules.inline.text.exec(e);if(t){let e=this.lexer.state.inRawBlock;return{type:`text`,raw:t[0],text:t[0],escaped:e}}}},G=class e{tokens;options;state;tokenizer;inlineQueue;constructor(e){this.tokens=[],this.tokens.links=Object.create(null),this.options=e||w,this.options.tokenizer=this.options.tokenizer||new W,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};let t={other:D,block:B.normal,inline:V.normal};this.options.pedantic?(t.block=B.pedantic,t.inline=V.pedantic):this.options.gfm&&(t.block=B.gfm,t.inline=this.options.breaks?V.breaks:V.gfm),this.tokenizer.rules=t}static get rules(){return{block:B,inline:V}}static lex(t,n){return new e(n).lex(t)}static lexInline(t,n){return new e(n).inlineTokens(t)}lex(e){e=e.replace(D.carriageReturn,`
`),this.blockTokens(e,this.tokens);for(let e=0;e<this.inlineQueue.length;e++){let t=this.inlineQueue[e];this.inlineTokens(t.src,t.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(e,t=[],n=!1){for(this.options.pedantic&&(e=e.replace(D.tabCharGlobal,`    `).replace(D.spaceLine,``));e;){let r;if(this.options.extensions?.block?.some(n=>(r=n.call({lexer:this},e,t))?(e=e.substring(r.raw.length),t.push(r),!0):!1))continue;if(r=this.tokenizer.space(e)){e=e.substring(r.raw.length);let n=t.at(-1);r.raw.length===1&&n!==void 0?n.raw+=`
`:t.push(r);continue}if(r=this.tokenizer.code(e)){e=e.substring(r.raw.length);let n=t.at(-1);n?.type===`paragraph`||n?.type===`text`?(n.raw+=`
`+r.raw,n.text+=`
`+r.text,this.inlineQueue.at(-1).src=n.text):t.push(r);continue}if((r=this.tokenizer.fences(e))||(r=this.tokenizer.heading(e))||(r=this.tokenizer.hr(e))||(r=this.tokenizer.blockquote(e))||(r=this.tokenizer.list(e))||(r=this.tokenizer.html(e))){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.def(e)){e=e.substring(r.raw.length);let n=t.at(-1);n?.type===`paragraph`||n?.type===`text`?(n.raw+=`
`+r.raw,n.text+=`
`+r.raw,this.inlineQueue.at(-1).src=n.text):this.tokens.links[r.tag]||(this.tokens.links[r.tag]={href:r.href,title:r.title});continue}if((r=this.tokenizer.table(e))||(r=this.tokenizer.lheading(e))){e=e.substring(r.raw.length),t.push(r);continue}let i=e;if(this.options.extensions?.startBlock){let t=1/0,n=e.slice(1),r;this.options.extensions.startBlock.forEach(e=>{r=e.call({lexer:this},n),typeof r==`number`&&r>=0&&(t=Math.min(t,r))}),t<1/0&&t>=0&&(i=e.substring(0,t+1))}if(this.state.top&&(r=this.tokenizer.paragraph(i))){let a=t.at(-1);n&&a?.type===`paragraph`?(a.raw+=`
`+r.raw,a.text+=`
`+r.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=a.text):t.push(r),n=i.length!==e.length,e=e.substring(r.raw.length)}else if(r=this.tokenizer.text(e)){e=e.substring(r.raw.length);let n=t.at(-1);n?.type===`text`?(n.raw+=`
`+r.raw,n.text+=`
`+r.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=n.text):t.push(r)}else if(e){let t=`Infinite loop on byte: `+e.charCodeAt(0);if(this.options.silent){console.error(t);break}throw Error(t)}}return this.state.top=!0,t}inline(e,t=[]){return this.inlineQueue.push({src:e,tokens:t}),t}inlineTokens(e,t=[]){let n=e,r=null;if(this.tokens.links){let e=Object.keys(this.tokens.links);if(e.length>0)for(;(r=this.tokenizer.rules.inline.reflinkSearch.exec(n))!=null;)e.includes(r[0].slice(r[0].lastIndexOf(`[`)+1,-1))&&(n=n.slice(0,r.index)+`[`+`a`.repeat(r[0].length-2)+`]`+n.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;(r=this.tokenizer.rules.inline.anyPunctuation.exec(n))!=null;)n=n.slice(0,r.index)+`++`+n.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);for(;(r=this.tokenizer.rules.inline.blockSkip.exec(n))!=null;)n=n.slice(0,r.index)+`[`+`a`.repeat(r[0].length-2)+`]`+n.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);let i=!1,a=``;for(;e;){i||(a=``),i=!1;let r;if(this.options.extensions?.inline?.some(n=>(r=n.call({lexer:this},e,t))?(e=e.substring(r.raw.length),t.push(r),!0):!1))continue;if((r=this.tokenizer.escape(e))||(r=this.tokenizer.tag(e))||(r=this.tokenizer.link(e))){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.reflink(e,this.tokens.links)){e=e.substring(r.raw.length);let n=t.at(-1);r.type===`text`&&n?.type===`text`?(n.raw+=r.raw,n.text+=r.text):t.push(r);continue}if((r=this.tokenizer.emStrong(e,n,a))||(r=this.tokenizer.codespan(e))||(r=this.tokenizer.br(e))||(r=this.tokenizer.del(e))||(r=this.tokenizer.autolink(e))||!this.state.inLink&&(r=this.tokenizer.url(e))){e=e.substring(r.raw.length),t.push(r);continue}let o=e;if(this.options.extensions?.startInline){let t=1/0,n=e.slice(1),r;this.options.extensions.startInline.forEach(e=>{r=e.call({lexer:this},n),typeof r==`number`&&r>=0&&(t=Math.min(t,r))}),t<1/0&&t>=0&&(o=e.substring(0,t+1))}if(r=this.tokenizer.inlineText(o)){e=e.substring(r.raw.length),r.raw.slice(-1)!==`_`&&(a=r.raw.slice(-1)),i=!0;let n=t.at(-1);n?.type===`text`?(n.raw+=r.raw,n.text+=r.text):t.push(r)}else if(e){let t=`Infinite loop on byte: `+e.charCodeAt(0);if(this.options.silent){console.error(t);break}throw Error(t)}}return t}},K=class{options;parser;constructor(e){this.options=e||w}space(e){return``}code({text:e,lang:t,escaped:n}){let r=(t||``).match(D.notSpaceStart)?.[0],i=e.replace(D.endingNewline,``)+`
`;return r?`<pre><code class="language-`+H(r)+`">`+(n?i:H(i,!0))+`</code></pre>
`:`<pre><code>`+(n?i:H(i,!0))+`</code></pre>
`}blockquote({tokens:e}){return`<blockquote>
${this.parser.parse(e)}</blockquote>
`}html({text:e}){return e}heading({tokens:e,depth:t}){return`<h${t}>${this.parser.parseInline(e)}</h${t}>
`}hr(e){return`<hr>
`}list(e){let t=e.ordered,n=e.start,r=``;for(let t=0;t<e.items.length;t++){let n=e.items[t];r+=this.listitem(n)}let i=t?`ol`:`ul`,a=t&&n!==1?` start="`+n+`"`:``;return`<`+i+a+`>
`+r+`</`+i+`>
`}listitem(e){let t=``;if(e.task){let n=this.checkbox({checked:!!e.checked});e.loose?e.tokens[0]?.type===`paragraph`?(e.tokens[0].text=n+` `+e.tokens[0].text,e.tokens[0].tokens&&e.tokens[0].tokens.length>0&&e.tokens[0].tokens[0].type===`text`&&(e.tokens[0].tokens[0].text=n+` `+H(e.tokens[0].tokens[0].text),e.tokens[0].tokens[0].escaped=!0)):e.tokens.unshift({type:`text`,raw:n+` `,text:n+` `,escaped:!0}):t+=n+` `}return t+=this.parser.parse(e.tokens,!!e.loose),`<li>${t}</li>
`}checkbox({checked:e}){return`<input `+(e?`checked="" `:``)+`disabled="" type="checkbox">`}paragraph({tokens:e}){return`<p>${this.parser.parseInline(e)}</p>
`}table(e){let t=``,n=``;for(let t=0;t<e.header.length;t++)n+=this.tablecell(e.header[t]);t+=this.tablerow({text:n});let r=``;for(let t=0;t<e.rows.length;t++){let i=e.rows[t];n=``;for(let e=0;e<i.length;e++)n+=this.tablecell(i[e]);r+=this.tablerow({text:n})}return r&&=`<tbody>${r}</tbody>`,`<table>
<thead>
`+t+`</thead>
`+r+`</table>
`}tablerow({text:e}){return`<tr>
${e}</tr>
`}tablecell(e){let t=this.parser.parseInline(e.tokens),n=e.header?`th`:`td`;return(e.align?`<${n} align="${e.align}">`:`<${n}>`)+t+`</${n}>
`}strong({tokens:e}){return`<strong>${this.parser.parseInline(e)}</strong>`}em({tokens:e}){return`<em>${this.parser.parseInline(e)}</em>`}codespan({text:e}){return`<code>${H(e,!0)}</code>`}br(e){return`<br>`}del({tokens:e}){return`<del>${this.parser.parseInline(e)}</del>`}link({href:e,title:t,tokens:n}){let r=this.parser.parseInline(n),i=ht(e);if(i===null)return r;e=i;let a=`<a href="`+e+`"`;return t&&(a+=` title="`+H(t)+`"`),a+=`>`+r+`</a>`,a}image({href:e,title:t,text:n,tokens:r}){r&&(n=this.parser.parseInline(r,this.parser.textRenderer));let i=ht(e);if(i===null)return H(n);e=i;let a=`<img src="${e}" alt="${n}"`;return t&&(a+=` title="${H(t)}"`),a+=`>`,a}text(e){return`tokens`in e&&e.tokens?this.parser.parseInline(e.tokens):`escaped`in e&&e.escaped?e.text:H(e.text)}},q=class{strong({text:e}){return e}em({text:e}){return e}codespan({text:e}){return e}del({text:e}){return e}html({text:e}){return e}text({text:e}){return e}link({text:e}){return``+e}image({text:e}){return``+e}br(){return``}},J=class e{options;renderer;textRenderer;constructor(e){this.options=e||w,this.options.renderer=this.options.renderer||new K,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new q}static parse(t,n){return new e(n).parse(t)}static parseInline(t,n){return new e(n).parseInline(t)}parse(e,t=!0){let n=``;for(let r=0;r<e.length;r++){let i=e[r];if(this.options.extensions?.renderers?.[i.type]){let e=i,t=this.options.extensions.renderers[e.type].call({parser:this},e);if(t!==!1||![`space`,`hr`,`heading`,`code`,`table`,`blockquote`,`list`,`html`,`paragraph`,`text`].includes(e.type)){n+=t||``;continue}}let a=i;switch(a.type){case`space`:n+=this.renderer.space(a);continue;case`hr`:n+=this.renderer.hr(a);continue;case`heading`:n+=this.renderer.heading(a);continue;case`code`:n+=this.renderer.code(a);continue;case`table`:n+=this.renderer.table(a);continue;case`blockquote`:n+=this.renderer.blockquote(a);continue;case`list`:n+=this.renderer.list(a);continue;case`html`:n+=this.renderer.html(a);continue;case`paragraph`:n+=this.renderer.paragraph(a);continue;case`text`:{let i=a,o=this.renderer.text(i);for(;r+1<e.length&&e[r+1].type===`text`;)i=e[++r],o+=`
`+this.renderer.text(i);n+=t?this.renderer.paragraph({type:`paragraph`,raw:o,text:o,tokens:[{type:`text`,raw:o,text:o,escaped:!0}]}):o;continue}default:{let e=`Token with "`+a.type+`" type was not found.`;if(this.options.silent)return console.error(e),``;throw Error(e)}}}return n}parseInline(e,t=this.renderer){let n=``;for(let r=0;r<e.length;r++){let i=e[r];if(this.options.extensions?.renderers?.[i.type]){let e=this.options.extensions.renderers[i.type].call({parser:this},i);if(e!==!1||![`escape`,`html`,`link`,`image`,`strong`,`em`,`codespan`,`br`,`del`,`text`].includes(i.type)){n+=e||``;continue}}let a=i;switch(a.type){case`escape`:n+=t.text(a);break;case`html`:n+=t.html(a);break;case`link`:n+=t.link(a);break;case`image`:n+=t.image(a);break;case`strong`:n+=t.strong(a);break;case`em`:n+=t.em(a);break;case`codespan`:n+=t.codespan(a);break;case`br`:n+=t.br(a);break;case`del`:n+=t.del(a);break;case`text`:n+=t.text(a);break;default:{let e=`Token with "`+a.type+`" type was not found.`;if(this.options.silent)return console.error(e),``;throw Error(e)}}}return n}},Y=class{options;block;constructor(e){this.options=e||w}static passThroughHooks=new Set([`preprocess`,`postprocess`,`processAllTokens`]);preprocess(e){return e}postprocess(e){return e}processAllTokens(e){return e}provideLexer(){return this.block?G.lex:G.lexInline}provideParser(){return this.block?J.parse:J.parseInline}},X=new class{defaults=C();options=this.setOptions;parse=this.parseMarkdown(!0);parseInline=this.parseMarkdown(!1);Parser=J;Renderer=K;TextRenderer=q;Lexer=G;Tokenizer=W;Hooks=Y;constructor(...e){this.use(...e)}walkTokens(e,t){let n=[];for(let r of e)switch(n=n.concat(t.call(this,r)),r.type){case`table`:{let e=r;for(let r of e.header)n=n.concat(this.walkTokens(r.tokens,t));for(let r of e.rows)for(let e of r)n=n.concat(this.walkTokens(e.tokens,t));break}case`list`:{let e=r;n=n.concat(this.walkTokens(e.items,t));break}default:{let e=r;this.defaults.extensions?.childTokens?.[e.type]?this.defaults.extensions.childTokens[e.type].forEach(r=>{let i=e[r].flat(1/0);n=n.concat(this.walkTokens(i,t))}):e.tokens&&(n=n.concat(this.walkTokens(e.tokens,t)))}}return n}use(...e){let t=this.defaults.extensions||{renderers:{},childTokens:{}};return e.forEach(e=>{let n={...e};if(n.async=this.defaults.async||n.async||!1,e.extensions&&(e.extensions.forEach(e=>{if(!e.name)throw Error(`extension name required`);if(`renderer`in e){let n=t.renderers[e.name];n?t.renderers[e.name]=function(...t){let r=e.renderer.apply(this,t);return r===!1&&(r=n.apply(this,t)),r}:t.renderers[e.name]=e.renderer}if(`tokenizer`in e){if(!e.level||e.level!==`block`&&e.level!==`inline`)throw Error(`extension level must be 'block' or 'inline'`);let n=t[e.level];n?n.unshift(e.tokenizer):t[e.level]=[e.tokenizer],e.start&&(e.level===`block`?t.startBlock?t.startBlock.push(e.start):t.startBlock=[e.start]:e.level===`inline`&&(t.startInline?t.startInline.push(e.start):t.startInline=[e.start]))}`childTokens`in e&&e.childTokens&&(t.childTokens[e.name]=e.childTokens)}),n.extensions=t),e.renderer){let t=this.defaults.renderer||new K(this.defaults);for(let n in e.renderer){if(!(n in t))throw Error(`renderer '${n}' does not exist`);if([`options`,`parser`].includes(n))continue;let r=n,i=e.renderer[r],a=t[r];t[r]=(...e)=>{let n=i.apply(t,e);return n===!1&&(n=a.apply(t,e)),n||``}}n.renderer=t}if(e.tokenizer){let t=this.defaults.tokenizer||new W(this.defaults);for(let n in e.tokenizer){if(!(n in t))throw Error(`tokenizer '${n}' does not exist`);if([`options`,`rules`,`lexer`].includes(n))continue;let r=n,i=e.tokenizer[r],a=t[r];t[r]=(...e)=>{let n=i.apply(t,e);return n===!1&&(n=a.apply(t,e)),n}}n.tokenizer=t}if(e.hooks){let t=this.defaults.hooks||new Y;for(let n in e.hooks){if(!(n in t))throw Error(`hook '${n}' does not exist`);if([`options`,`block`].includes(n))continue;let r=n,i=e.hooks[r],a=t[r];t[r]=Y.passThroughHooks.has(n)?e=>{if(this.defaults.async)return Promise.resolve(i.call(t,e)).then(e=>a.call(t,e));let n=i.call(t,e);return a.call(t,n)}:(...e)=>{let n=i.apply(t,e);return n===!1&&(n=a.apply(t,e)),n}}n.hooks=t}if(e.walkTokens){let t=this.defaults.walkTokens,r=e.walkTokens;n.walkTokens=function(e){let n=[];return n.push(r.call(this,e)),t&&(n=n.concat(t.call(this,e))),n}}this.defaults={...this.defaults,...n}}),this}setOptions(e){return this.defaults={...this.defaults,...e},this}lexer(e,t){return G.lex(e,t??this.defaults)}parser(e,t){return J.parse(e,t??this.defaults)}parseMarkdown(e){return(t,n)=>{let r={...n},i={...this.defaults,...r},a=this.onError(!!i.silent,!!i.async);if(this.defaults.async===!0&&r.async===!1)return a(Error(`marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise.`));if(t==null)return a(Error(`marked(): input parameter is undefined or null`));if(typeof t!=`string`)return a(Error(`marked(): input parameter is of type `+Object.prototype.toString.call(t)+`, string expected`));i.hooks&&(i.hooks.options=i,i.hooks.block=e);let o=i.hooks?i.hooks.provideLexer():e?G.lex:G.lexInline,s=i.hooks?i.hooks.provideParser():e?J.parse:J.parseInline;if(i.async)return Promise.resolve(i.hooks?i.hooks.preprocess(t):t).then(e=>o(e,i)).then(e=>i.hooks?i.hooks.processAllTokens(e):e).then(e=>i.walkTokens?Promise.all(this.walkTokens(e,i.walkTokens)).then(()=>e):e).then(e=>s(e,i)).then(e=>i.hooks?i.hooks.postprocess(e):e).catch(a);try{i.hooks&&(t=i.hooks.preprocess(t));let e=o(t,i);i.hooks&&(e=i.hooks.processAllTokens(e)),i.walkTokens&&this.walkTokens(e,i.walkTokens);let n=s(e,i);return i.hooks&&(n=i.hooks.postprocess(n)),n}catch(e){return a(e)}}}onError(e,t){return n=>{if(n.message+=`
Please report this to https://github.com/markedjs/marked.`,e){let e=`<p>An error occurred:</p><pre>`+H(n.message+``,!0)+`</pre>`;return t?Promise.resolve(e):e}if(t)return Promise.reject(n);throw n}}};function Z(e,t){return X.parse(e,t)}Z.options=Z.setOptions=function(e){return X.setOptions(e),Z.defaults=X.defaults,Te(Z.defaults),Z},Z.getDefaults=C,Z.defaults=w,Z.use=function(...e){return X.use(...e),Z.defaults=X.defaults,Te(Z.defaults),Z},Z.walkTokens=function(e,t){return X.walkTokens(e,t)},Z.parseInline=X.parseInline,Z.Parser=J,Z.parser=J.parse,Z.Renderer=K,Z.TextRenderer=q,Z.Lexer=G,Z.lexer=G.lex,Z.Tokenizer=W,Z.Hooks=Y,Z.parse=Z,Z.options,Z.setOptions,Z.use,Z.walkTokens,Z.parseInline,J.parse,G.lex;var bt=[{zh:`开始`,en:`Get started`,pages:[[`overview`,`概览`,`Overview`],[`quickstart`,`快速开始`,`Quick start`],[`install`,`安装`,`Installation`],[`setup`,`首次配置`,`First-run setup`]]},{zh:`使用`,en:`Using TRUSTA`,pages:[[`chat-cards`,`对话与结果卡片`,`Conversations and cards`],[`authorization`,`授权等级`,`Authorisation tiers`],[`feishu`,`飞书接入`,`Feishu`],[`mobile`,`手机访问`,`Phone access`],[`integrations`,`集成`,`Integrations`]]},{zh:`可信机制`,en:`Trust`,pages:[[`agent-communication`,`多 Agent 签名通信`,`Signed agent messaging`],[`evidence`,`证据包离线验证`,`Verifying evidence offline`],[`cross-institution`,`跨机构协作`,`Cross-institution collaboration`],[`benchmarks`,`安全基准`,`Security benchmarks`]]},{zh:`参考`,en:`Reference`,pages:[[`configuration`,`配置项`,`Configuration`],[`cli`,`命令行`,`Command line`],[`api`,`HTTP API`,`HTTP API`],[`faq`,`常见问题`,`FAQ`],[`changelog`,`更新日志`,`Changelog`]]}],Q=bt.flatMap(e=>e.pages.map(([t,n,r])=>({slug:t,zh:n,en:r,group:e}))),$=n(),xt=Object.assign({"./content/en/agent-communication.md":f,"./content/en/api.md":p,"./content/en/authorization.md":ee,"./content/en/benchmarks.md":te,"./content/en/changelog.md":ne,"./content/en/chat-cards.md":re,"./content/en/cli.md":m,"./content/en/configuration.md":h,"./content/en/cross-institution.md":g,"./content/en/evidence.md":ie,"./content/en/faq.md":_,"./content/en/feishu.md":v,"./content/en/install.md":y,"./content/en/integrations.md":b,"./content/en/mobile.md":x,"./content/en/overview.md":S,"./content/en/quickstart.md":ae,"./content/en/setup.md":oe,"./content/zh/agent-communication.md":se,"./content/zh/api.md":ce,"./content/zh/authorization.md":le,"./content/zh/benchmarks.md":ue,"./content/zh/changelog.md":de,"./content/zh/chat-cards.md":fe,"./content/zh/cli.md":pe,"./content/zh/configuration.md":me,"./content/zh/cross-institution.md":he,"./content/zh/evidence.md":ge,"./content/zh/faq.md":_e,"./content/zh/feishu.md":ve,"./content/zh/install.md":ye,"./content/zh/integrations.md":be,"./content/zh/mobile.md":xe,"./content/zh/overview.md":Se,"./content/zh/quickstart.md":Ce,"./content/zh/setup.md":we}),St=(e,t)=>xt[`./content/${e}/${t}.md`]??xt[`./content/zh/${t}.md`]??``;Z.setOptions({gfm:!0,breaks:!1});var Ct={zh:{docs:`文档`,search:`搜索文档`,searchHint:`输入关键词`,noResults:`没有找到相关内容`,onPage:`本页目录`,prev:`上一页`,next:`下一页`,edit:`在 GitHub 上编辑此页`,menu:`目录`,home:`首页`,lang:`EN`,langLabel:`Switch to English`,theme:`切换深浅色`,copy:`复制`,copied:`已复制`,top:`回到顶部`,repo:`代码仓库即将公开。文档中的下载链接和安装命令届时可以直接使用。`},en:{docs:`Docs`,search:`Search docs`,searchHint:`Type to search`,noResults:`Nothing found`,onPage:`On this page`,prev:`Previous`,next:`Next`,edit:`Edit this page on GitHub`,menu:`Menu`,home:`Home`,lang:`中文`,langLabel:`切换到中文`,theme:`Toggle theme`,copy:`Copy`,copied:`Copied`,top:`Back to top`,repo:`The code repository opens soon; download links and install commands in these docs will work from then on.`}};function wt(){let e=location.hash.match(/^#\/([a-z0-9-]+)/);return e&&Q.some(t=>t.slug===e[1])?e[1]:`overview`}function Tt(e){return e.replace(/```[\s\S]*?```/g,` `).replace(/`([^`]*)`/g,`$1`).replace(/\[([^\]]*)\]\([^)]*\)/g,`$1`).replace(/[#>*_|-]+/g,` `).replace(/\s+/g,` `).trim()}function Et(e){let t=[];for(let n of Q)St(e,n.slug).split(/^(?=#{2,3} )/m).forEach((r,i)=>{let a=i===0?null:r.match(/^#{2,3} (.+)$/m)?.[1];t.push({slug:n.slug,page:n[e],head:a,n:i,text:Tt(i===0?r.replace(/^# .+$/m,``):r.replace(/^#{2,3} .+$/m,``))})});return t}function Dt(e,t){let n=t.toLowerCase().split(/\s+/).filter(Boolean);if(!n.length)return[];let r=[];for(let t of e){let e=`${t.page} ${t.head||``} ${t.text}`.toLowerCase();if(!n.every(t=>e.includes(t)))continue;let i=0;for(let e of n)t.page.toLowerCase().includes(e)&&(i+=6),(t.head||``).toLowerCase().includes(e)&&(i+=4);let a=t.text.toLowerCase().indexOf(n[0]),o=a<0?t.text.slice(0,90):(a>30?`…`:``)+t.text.slice(Math.max(0,a-30),a+70)+`…`;r.push({...t,score:i,snippet:o})}return r.sort((e,t)=>t.score-e.score).slice(0,12)}function Ot({ui:e,lang:t,onClose:n,go:r}){let[i,a]=(0,u.useState)(``),[o,s]=(0,u.useState)(0),c=(0,u.useMemo)(()=>Et(t),[t]),l=(0,u.useMemo)(()=>Dt(c,i),[c,i]),d=(0,u.useRef)(null);(0,u.useEffect)(()=>{d.current?.focus()},[]),(0,u.useEffect)(()=>s(0),[i]);let f=e=>{r(e.slug,e.n),n()};return(0,$.jsx)(`div`,{className:`search-backdrop`,onMouseDown:e=>{e.target===e.currentTarget&&n()},children:(0,$.jsxs)(`div`,{className:`search`,role:`dialog`,"aria-modal":`true`,"aria-label":e.search,children:[(0,$.jsx)(`input`,{ref:d,value:i,onChange:e=>a(e.target.value),onKeyDown:e=>{e.key===`Escape`&&n(),e.key===`ArrowDown`&&(e.preventDefault(),s(e=>Math.min(l.length-1,e+1))),e.key===`ArrowUp`&&(e.preventDefault(),s(e=>Math.max(0,e-1))),e.key===`Enter`&&l[o]&&f(l[o])},placeholder:e.searchHint,"aria-label":e.search,"aria-controls":`search-results`,"aria-activedescendant":l[o]?`sr-${o}`:void 0}),(0,$.jsxs)(`ul`,{id:`search-results`,role:`listbox`,children:[i&&!l.length&&(0,$.jsx)(`li`,{className:`empty`,children:e.noResults}),l.map((e,t)=>(0,$.jsxs)(`li`,{id:`sr-${t}`,role:`option`,"aria-selected":t===o,onMouseEnter:()=>s(t),onClick:()=>f(e),children:[(0,$.jsxs)(`b`,{children:[e.page,e.head?(0,$.jsxs)(`span`,{children:[` · `,e.head]}):null]}),(0,$.jsx)(`small`,{children:e.snippet})]},`${e.slug}-${e.n}`))]})]})})}function kt(){let[e,t]=i(),n=Ct[e],[o,c]=(0,u.useState)(wt),[d,f]=s({light:`#edece8`,dark:`#111110`}),[p,ee]=(0,u.useState)([]),[te,ne]=(0,u.useState)(null),[re,m]=(0,u.useState)(!1),[h,g]=(0,u.useState)(!1),ie=(0,u.useRef)(null),_=(0,u.useRef)(null),v=Q.find(e=>e.slug===o),y=Q.indexOf(v),b=Q[y-1],x=Q[y+1],S=(0,u.useMemo)(()=>Z.parse(St(e,o)),[e,o]);(0,u.useEffect)(()=>{let e=()=>{c(wt()),g(!1)};return window.addEventListener(`hashchange`,e),()=>window.removeEventListener(`hashchange`,e)},[]),(0,u.useEffect)(()=>{document.title=`${v[e]} · TRUSTA ${n.docs}`},[v,e,n.docs]),(0,u.useEffect)(()=>{let e=e=>{(e.key===`k`&&(e.metaKey||e.ctrlKey)||e.key===`/`&&!/input|textarea/i.test(document.activeElement?.tagName||``))&&(e.preventDefault(),m(!0))};return window.addEventListener(`keydown`,e),()=>window.removeEventListener(`keydown`,e)},[]),(0,u.useLayoutEffect)(()=>{let e=ie.current;if(!e)return;let t=[...e.querySelectorAll(`h2, h3`)];t.forEach((e,t)=>{e.id=`s-${t+1}`}),ee(t.map(e=>({id:e.id,text:e.textContent,level:e.tagName===`H2`?2:3}))),e.querySelectorAll(`pre`).forEach(e=>{if(e.querySelector(`.copy`))return;let t=document.createElement(`button`);t.type=`button`,t.className=`copy`,t.textContent=n.copy,t.addEventListener(`click`,async()=>{let r=e.querySelector(`code`)?.innerText??e.innerText;try{await navigator.clipboard.writeText(r)}catch{}t.textContent=n.copied,setTimeout(()=>{t.textContent=n.copy},1400)}),e.append(t)}),e.querySelectorAll(`table`).forEach(e=>{if(e.parentElement.classList.contains(`table-wrap`))return;let t=document.createElement(`div`);t.className=`table-wrap`,e.replaceWith(t),t.append(e)}),e.querySelectorAll(`a[href^='http']`).forEach(e=>{e.target=`_blank`,e.rel=`noopener noreferrer`});let r=_.current;_.current=null,r?document.getElementById(`s-${r}`)?.scrollIntoView({block:`start`}):window.scrollTo(0,0)},[S,n.copy,n.copied]),(0,u.useEffect)(()=>{if(!p.length)return;let e=p.map(e=>document.getElementById(e.id)).filter(Boolean),t=new IntersectionObserver(e=>{let t=e.filter(e=>e.isIntersecting).sort((e,t)=>e.boundingClientRect.top-t.boundingClientRect.top);t[0]&&ne(t[0].target.id)},{rootMargin:`-72px 0px -70% 0px`});return e.forEach(e=>t.observe(e)),()=>t.disconnect()},[p]);let ae=(e,t)=>{_.current=t||null,e===o?t&&document.getElementById(`s-${t}`)?.scrollIntoView({behavior:`smooth`,block:`start`}):location.hash=`#/${e}`},oe=`${a}/edit/${r}/frontend-app/src/docs/content/${e}/${o}.md`;return(0,$.jsxs)(`div`,{className:`docs`,children:[(0,$.jsxs)(`header`,{className:`topbar`,children:[(0,$.jsxs)(`button`,{type:`button`,className:`menu-btn`,onClick:()=>g(e=>!e),"aria-expanded":h,"aria-controls":`sidebar`,"aria-label":n.menu,children:[(0,$.jsx)(`span`,{}),(0,$.jsx)(`span`,{}),(0,$.jsx)(`span`,{})]}),(0,$.jsxs)(`a`,{className:`brand`,href:l,children:[(0,$.jsx)(`img`,{src:`/bank/mark.png`,alt:``,width:`24`,height:`24`}),(0,$.jsx)(`span`,{children:`TRUSTA`})]}),(0,$.jsx)(`span`,{className:`crumb`,children:n.docs}),(0,$.jsxs)(`button`,{type:`button`,className:`search-btn`,onClick:()=>m(!0),children:[(0,$.jsx)(`svg`,{viewBox:`0 0 20 20`,width:`15`,height:`15`,"aria-hidden":`true`,children:(0,$.jsx)(`path`,{fill:`none`,stroke:`currentColor`,strokeWidth:`1.8`,d:`M8.5 15a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Zm9 3-4.5-4.5`})}),(0,$.jsx)(`span`,{children:n.search}),(0,$.jsx)(`kbd`,{children:/mac|iphone|ipad/i.test(navigator.platform||navigator.userAgent)?`⌘K`:`Ctrl K`})]}),(0,$.jsxs)(`nav`,{className:`top-links`,children:[(0,$.jsx)(`a`,{className:`wide`,href:l,children:n.home}),(0,$.jsx)(`a`,{className:`icon`,href:`https://github.com/piggyz666/Trusta`,"aria-label":`GitHub`,children:(0,$.jsx)(`svg`,{viewBox:`0 0 16 16`,width:`18`,height:`18`,"aria-hidden":`true`,children:(0,$.jsx)(`path`,{fill:`currentColor`,d:`M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z`})})}),(0,$.jsx)(`button`,{type:`button`,className:`lang`,onClick:()=>t(e===`zh`?`en`:`zh`),"aria-label":n.langLabel,children:n.lang}),(0,$.jsx)(`button`,{type:`button`,className:`theme`,onClick:f,"aria-label":n.theme,children:d===`dark`?(0,$.jsxs)(`svg`,{viewBox:`0 0 20 20`,width:`17`,height:`17`,"aria-hidden":`true`,children:[(0,$.jsx)(`circle`,{cx:`10`,cy:`10`,r:`4`,fill:`currentColor`}),(0,$.jsx)(`path`,{stroke:`currentColor`,strokeWidth:`1.6`,strokeLinecap:`round`,d:`M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M4 16l1.4-1.4M14.6 5.4 16 4`})]}):(0,$.jsx)(`svg`,{viewBox:`0 0 20 20`,width:`17`,height:`17`,"aria-hidden":`true`,children:(0,$.jsx)(`path`,{fill:`currentColor`,d:`M16.5 12.6A7 7 0 0 1 7.4 3.5a7 7 0 1 0 9.1 9.1Z`})})})]})]}),(0,$.jsxs)(`div`,{className:`layout`,children:[(0,$.jsx)(`aside`,{id:`sidebar`,className:`sidebar ${h?`open`:``}`,children:bt.map(t=>(0,$.jsxs)(`div`,{className:`group`,children:[(0,$.jsx)(`p`,{children:t[e]}),(0,$.jsx)(`ul`,{children:t.pages.map(([t,n,r])=>(0,$.jsx)(`li`,{children:(0,$.jsx)(`a`,{href:`#/${t}`,"aria-current":t===o?`page`:void 0,children:e===`zh`?n:r})},t))})]},t.en))}),h&&(0,$.jsx)(`div`,{className:`scrim`,onClick:()=>g(!1),"aria-hidden":`true`}),(0,$.jsxs)(`main`,{className:`content`,children:[!1,(0,$.jsx)(`p`,{className:`eyebrow`,children:v.group[e]}),(0,$.jsx)(`article`,{ref:ie,className:`prose`,dangerouslySetInnerHTML:{__html:S}}),(0,$.jsxs)(`div`,{className:`page-foot`,children:[(0,$.jsxs)(`a`,{className:`edit`,href:oe,target:`_blank`,rel:`noopener noreferrer`,children:[n.edit,` ↗`]}),(0,$.jsxs)(`nav`,{className:`pager`,children:[b?(0,$.jsxs)(`a`,{href:`#/${b.slug}`,className:`prev`,children:[(0,$.jsx)(`small`,{children:n.prev}),(0,$.jsx)(`b`,{children:b[e]})]}):(0,$.jsx)(`span`,{}),x?(0,$.jsxs)(`a`,{href:`#/${x.slug}`,className:`next`,children:[(0,$.jsx)(`small`,{children:n.next}),(0,$.jsx)(`b`,{children:x[e]})]}):(0,$.jsx)(`span`,{})]})]})]}),(0,$.jsx)(`aside`,{className:`toc`,"aria-label":n.onPage,children:p.length>1&&(0,$.jsxs)($.Fragment,{children:[(0,$.jsx)(`p`,{children:n.onPage}),(0,$.jsx)(`ul`,{children:p.map(e=>(0,$.jsx)(`li`,{className:`l${e.level} ${te===e.id?`on`:``}`,children:(0,$.jsx)(`a`,{href:`#/${o}`,onClick:t=>{t.preventDefault(),document.getElementById(e.id)?.scrollIntoView({behavior:`smooth`,block:`start`})},children:e.text})},e.id))}),(0,$.jsxs)(`button`,{type:`button`,className:`to-top`,onClick:()=>window.scrollTo({top:0,behavior:`smooth`}),children:[n.top,` ↑`]})]})})]}),re&&(0,$.jsx)(Ot,{ui:n,lang:e,onClose:()=>m(!1),go:ae})]})}c(o(),{light:`#edece8`,dark:`#111110`}),(0,d.createRoot)(document.getElementById(`root`)).render((0,$.jsx)(u.StrictMode,{children:(0,$.jsx)(kt,{})}));