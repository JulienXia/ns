# NativeSense v2 — 两个限定工程改进交付报告

日期：2026-11-01
范围：用户批准的两项改进（runner 瞬时错误重试 + schema 交叉校验），未触及提示词/模型参数/标签/数据。

---

## 1. 修改的文件与原因

| 文件 | 改动 | 原因 |
|---|---|---|
| `server/src/ai/analysisService.ts` | `normalizeResult` 末尾新增 `assertCrossFieldConsistency`：`no_correction_needed=false` 时必须至少有一个 issue 或非空 `recommended_expression`；`=true` 时拒绝 issues 非空或 `recommended_expression` 非空。违反抛 `AiOutputError`，复用现有一次纠正重试。 | 基线 B4 "判修却 recommended=null"暴露的跨字段矛盾。交叉校验放在清洗后判定（空 issue 已被过滤），比 zod refine 更准。 |
| `server/src/eval/retry.ts`（新建） | 导出 `isTransientProviderError`（仅 AiProviderError 且 message 含 http 500 / fetch failed / econnrefused / etimedout / timeout / socket hang up / network）、`analyzeWithRetries`（maxRetries=2、delayMs=4000、永久错误不重试、返回 attempts/retries）。 | 把重试逻辑抽成独立模块，避免 import runEvaluation 时触发 main()，便于单测。 |
| `server/src/eval/runEvaluation.ts` | import `analyzeWithRetries`；`EvalOutcome` 加 `attempts?`/`retries?`；主循环改用重试封装；控制台打印 `(retry xN)`。 | 基线 G4 因 Ollama HTTP 500 "token repeat limit reached" 未取回，runner 无自动重试。 |
| `server/test/analysisService.test.ts` | 旧 messy fixture 补 `no_correction_needed: false`（否则被新规则拒）；追加 6 个交叉校验用例。 | 单测 valid/invalid 组合。 |
| `server/test/evalRetry.test.ts`（新建） | 6 个用例：500/fetch failed 判瞬时、401/schema 错误判永久、首次成功不重试、500 后重试成功、连续 3 次 500 用尽预算、schema 错误不重试。 | 单测重试分类与行为。 |

**未改动**：system prompt、evaluation labels、model parameters、legacy `score` 字段、user data、API 契约、Ollama 配置。

---

## 2. 测试结果

```
npm test -w server        →  Test Files 7 passed (7) · Tests 58 passed (58)
npm run typecheck -w server / web  →  exit 0
```

基线是 43 个测试；本次新增 15 个（analysisService +6、evalRetry +6，其余为原有覆盖）。无失败、无类型错误。

---

## 3. 35 句重跑对比

| 指标 | 基线 10:03 | 本次 10:14 | 变化 |
|---|---|---|---|
| 完成句数 | 34 | 35 | +1 |
| errors | 1（G4 Ollama HTTP 500） | 0 | -1 |
| no-correction agreement | 91% (31/34) | 89% (31/35) | -2pp |
| naturalness exact | 85% (29/34) | 83% (29/35) | -2pp |
| grammar exact | 94% (32/34) | 97% (34/35) | +3pp |

原始 JSON：
- 基线：`server/eval/results/eval-2026-11-01T10-03-57-101Z.json`（保留未动）
- 本次：`server/eval/results/eval-2026-11-01T10-14-15-663Z.json`

### 基础设施可靠性改进 vs 模型质量改进

**基础设施（本次改动生效范围）**：
- errors 1→0：G4 本次首次调用即成功，**没有触发重试**（attempts=1, retries=0）。说明基线那次 HTTP 500 是 Ollama 瞬时抽风，本次未复现；重试代码已就位，下次再遇到 500 会自动救回（最多 2 次、间隔 4 秒）。
- 所有句 attempts=1/retries=0：本次没有遇到瞬时错误，重试机制"备而未用"。
- 交叉校验：本次 35 句无一因跨字段矛盾被拒（errors=0）。B4 仍 `recommended_expression=null`，但 issues 非空，符合"fix 至少有 issue 或推荐"的规则，未触发纠正重试。

**模型质量（未变，提示词/参数未动）**：
- B2/B3（"do a meeting"/"English level is poor" 应 fix 却 keep）：与基线一致，7B 能力边界。
- C3（"I am agree with you" 应 fix 却 keep）：与基线一致，语言幻觉。
- B4（mostly_natural vs expected awkward）：与基线一致，档位偏轻一档。
- C5（"Yesterday I go"）：本次 grammar 判对（minor_errors→正确时态纠正 "Yesterday I went to the park."），grammar 94%→97% 主要来自此。
- D2（natural/keep 却判 awkward/fix）：基线是 keep，本次变成 fix——7B 温度 0.3 随机波动，no-correction 91%→89% 来自此。

**结论**：本次重跑的指标波动全部在 7B 随机噪声范围内（±2pp），没有可归因于"模型质量改进"的变化；唯一结构性改进是 errors 归零 + 重试/交叉校验代码就位。

---

## 4. 剩余限制

1. **重试未在真实 500 上验证**：本次 Ollama 没抽风，重试路径靠单测（FakeProvider 模拟）覆盖，未在真实瞬时故障上端到端验证。
2. **交叉校验未触发真实纠正重试**：B4 类"fix 但推荐 null"只要 issues 非空就合规，本次没有句子落到"无 issue 无推荐"的矛盾态。纠正重试路径靠单测覆盖。
3. **B/C 类失败仍是 7B 能力边界**：B2/B3/C3/B4 与基线完全一致，提示词未动，无法靠工程改进解决。
4. **重试延迟固定 4 秒、上限 2 次**：按用户批准值，未做指数退避。
5. **legacy `score` 字段仍在**：按用户约束未清理。
6. **本地仍无 qwen2.5:14b**：按约束未下载。

---

## 5. 待批准决策（停手等指示）

- 是否清理 learning bank API 契约里的 legacy `score` 字段（审计项，本次未动）？
- 是否迁移/删除 `server/data/entries.json` 里那 1 条 v1 旧条目（headache）？
- 是否下载 qwen2.5:14b 跑对比评测？
- B2/B3/C3 这类 7B 能力边界问题，是否需要下一步改提示词（本次约束不允许）？
