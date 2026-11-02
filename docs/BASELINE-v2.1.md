# NativeSense v2.1 — Frozen Baseline

日期：2026-11-01
状态：**冻结**（用户批准，作为下一阶段开发的对比基线）

---

## 1. 冻结范围

| 项 | 值 |
|---|---|
| 模型 | qwen2.5:7b（Ollama 本地，参数未动） |
| System prompt 快照 | `docs/prompts/SYSTEM_PROMPT-v2.1-frozen.ts` |
| 原始源文件 | `server/src/ai/prompts.ts`（与快照一致） |
| 解释语言 | zh |
| 温度 | 0.3（首次）/ 0.2（schema 纠正重试） |
| 输出 schema | `server/src/ai/types.ts`（zod v2，四档 naturalness，无数值分数） |
| 跨字段校验 | 已启用（fix 必须有 issue 或推荐；keep 拒绝矛盾指令） |
| Runner 重试 | 已启用（瞬时错误最多 2 次，间隔 4 秒） |

---

## 2. 最新评测指标（基线）

评测文件：`server/eval/results/eval-2026-11-01T10-23-53-678Z.json`

| 指标 | 值 |
|---|---|
| 完成句数 | 35 / 35 |
| errors | 0 |
| no-correction agreement | **91%**（32/35） |
| naturalness exact | **91%**（32/35） |
| grammar exact | **97%**（34/35） |

### 失败句清单

| ID | 句子 | 期望 | 实际 | 类型 |
|---|---|---|---|---|
| B2 | "Let's do a meeting tomorrow morning." | awkward/fix | natural/keep | **漏判**（应识别却 keep） |
| B3 | "My English level is very poor, so I want to practice more." | awkward/fix | natural/keep | **漏判**（应识别却 keep） |
| D2 | "I can't even right now." | natural/keep | awkward/fix | **误改**（false correction） |

### 重试统计

本次评测中真实触发 runner 重试的句子：
- G2：retry x1（瞬时 Ollama 500，重试后成功）
- G4：retry x1（瞬时 Ollama 500，重试后成功）

其余 33 句均为首次成功（attempts=1, retries=0）。

---

## 3. 已知限制（冻结，待后续阶段处理）

1. **B2 "do a meeting"**：7B 认为 "Let's do a meeting" 可接受，尽管 system prompt 已印出该例句并标注为硬检查。判定为 7B 能力边界，非提示词问题。
2. **B3 "English level is poor"**：同上，中文母语直译在 7B 对齐数据中被当成可接受表达。
3. **D2 "I can't even right now"**：网络俚语/不完整句式，7B 倾向"纠正"成完整句，属 false correction。其他 A/E/F/G 共 23 句全部正确保持 natural。

---

## 4. 历史报告索引（全部保留）

### 评测 JSON（`server/eval/results/`）
| 文件 | 阶段 | 指标 |
|---|---|---|
| eval-2026-11-01T04-25-07-350Z.json | M8 早期试跑 | — |
| eval-2026-11-01T04-26-53-907Z.json | M8 早期试跑 | — |
| eval-2026-11-01T04-28-13-713Z.json | M8 早期试跑 | — |
| eval-2026-11-01T10-03-57-101Z.json | **全量基线（v2.0 prompt）** | 91% / 85% / 94% / errors=1 |
| eval-2026-11-01T10-14-15-663Z.json | 重试 + 交叉校验后 | 89% / 83% / 97% / errors=0 |
| eval-2026-11-01T10-23-53-678Z.json | **v2.1 prompt 冻结基线** | 91% / 91% / 97% / errors=0 |

### 文档（`docs/`）
- `EVAL-FULL-35-REPORT.md` — 全量 35 句基线报告
- `EVAL-RETRY-CROSSFIELD-REPORT.md` — 重试与交叉校验改进报告
- `EVALUATION-REPORT.md` — M8 早期报告
- `PROMPT-OPTIMIZATION-REPORT.md` — 受控提示词优化实验报告
- `prompts/SYSTEM_PROMPT-v2.1-frozen.ts` — 当前冻结 prompt 快照

---

## 5. 验证状态（本次冻结前）

```
npm test -w server        →  Test Files 7 passed · Tests 58 passed
npm run typecheck -w server →  exit 0
npm run typecheck -w web    →  exit 0
```

---

## 6. 冻结约束

- 不改 system prompt
- 不改模型参数
- 不下载 14b
- 不改 API 契约 / schema
- 不改用户数据
- 不加新功能

后续阶段如需改动任何一项，需用户批准并基于此基线对比。
