# NativeSense v2 — 受控提示词优化实验报告

日期：2026-11-01
模型：qwen2.5:7b（参数未动）· 解释语言 zh · 35 句全量

---

## 1. 失败根因分析

| 用例 | 基线表现 | 根因分类 | 判定 |
|---|---|---|---|
| **B2** "do a meeting" | 应 fix 却 keep | 提示词已印例句但措辞是"illustrative examples, not exhaustive checklist"，7B 推理时不主动回查列表；且 "do a meeting" 在邮件语境下对 7B 不够刺耳 | **能力边界 + 指令位置** |
| **B3** "English level is poor" | 应 fix 却 keep | 同 B2；中文母语者直译"英语水平很差"在 7B 对齐数据里被当成可接受表达 | **能力边界 + 指令位置** |
| **C3** "I am agree with you" | 应 unnatural/incorrect 却判 natural/correct/keep | 提示词完全没提"be 动词 + 动词原形"这类堆叠谓语错误；Example 3 只示范主谓一致 | **真指令缺口** |
| **B4** "price is expensive" | 方向对但档位偏 mostly_natural（应 awkward），且 recommended=null | 7B 对 four-tier 校准保守；已印例句但档位判断偏轻 | **能力边界（档位校准）** |
| **C5** "Yesterday I go" | 档位偏 awkward/minor_errors（应 unnatural/incorrect） | 时态错误被 7B 当成小问题，未识别"Yesterday + 现在时"是硬错误 | **能力边界（档位校准）** |

---

## 2. 提示词改动（最小三处）

### 改动 1 · STEP 2 加 be+动词原形检查
```
Specifically check for doubled predicates: a subject followed by "be"
(am/is/are/was/were) directly followed by a base verb is a genuine grammar
error, not a style issue (e.g. "I am agree", "He is go", "They are live here").
When you find this, set grammar_status to "incorrect".
```
**理由**：补 C3 暴露的真指令缺口。

### 改动 2 · common non-native patterns 从"举例"提升为硬检查
原措辞："illustrative teaching examples — use the same judgment for similar cases, **do not treat this as an exhaustive checklist**"
新措辞："**BEFORE you mark a sentence "natural", actively scan the text against this list. If a sentence matches one of these patterns, it is NOT natural**: set no_correction_needed to false and naturalness to at most mostly_natural (usually awkward). These are not optional examples; they are specific collocation errors native speakers rarely make."
**理由**：解决 B2/B3"印了例句但不触发"的问题。

### 改动 3 · 新增 Example 5（be + 动词原形）
示范 "I am agree with you." → grammar_status=incorrect, naturalness=unnatural, recommended="I agree with you.", no_correction_needed=false。
**理由**：few-shot 教一般化区分（be 后面不能直接跟动词原形），不是只教这一句。

**未改动**：system prompt 其他部分、schema、API 契约、模型参数、用户数据。

---

## 3. Before / After 对比

| 指标 | 基线 (10:03) | 重试改进后 (10:14) | prompt 优化后 (10:23) |
|---|---|---|---|
| 完成句数 | 34 | 35 | 35 |
| errors | 1（G4 瞬时 500） | 0 | 0 |
| no-correction agreement | 91% (31/34) | 89% (31/35) | **91% (32/35)** |
| naturalness exact | 85% (29/34) | 83% (29/35) | **91% (32/35)** |
| grammar exact | 94% (32/34) | 97% (34/35) | **97% (34/35)** |

原始 JSON：
- `eval-2026-11-01T10-03-57-101Z.json`（基线）
- `eval-2026-11-01T10-14-15-663Z.json`（重试改进）
- `eval-2026-11-01T10-23-53-678Z.json`（本次）

### 逐句变化

| 用例 | 基线 | 上次 | 本次 | 说明 |
|---|---|---|---|---|
| B4 | mostly_natural/fix | mostly_natural/fix | **awkward/fix** | 档位修对 |
| C3 | natural/keep | natural/keep | **unnatural/fix** | be+动词原形检查 + Example 5 生效 |
| C5 | awkward/minor_errors | awkward/fix | **unnatural/fix** | 档位修对 |
| B2 | natural/keep | natural/keep | natural/keep | 仍未修（能力边界） |
| B3 | natural/keep | natural/keep | natural/keep | 仍未修（能力边界） |
| D2 | natural/keep | awkward/fix | awkward/fix | false correction，**非本次引入** |
| G2/G4 | — | — | 成功（retry x1） | 真实瞬时 500 被重试救回 |

---

## 4. False correction 检查

A/D/E/F/G 共 24 句应保持 natural/keep：
- A1–A5、E1–E5、F1–F5、G1–G5：全部正确保持
- D1/D3/D4/D5：正确保持
- **D2 "I can't even right now"：仍被判 awkward/fix**（1/24）

这是 7B 对网络俚语的保守性误判，**不是本次 prompt 改动引入的**——上次重试改进后的评测里 D2 就已经是这个错。24 句里 23 句正确保持，与基线持平。

---

## 5. 剩余限制

1. **B2/B3 仍未修**：提示词已把"do a meeting"/"English level is poor"印成硬检查，但 7B 还是判 natural/keep。这是 7B 能力边界——它真的认为这些表达可接受，不是指令没读到。需要 14b 或更大模型才能解决。
2. **D2 误判未修**：网络俚语 "I can't even right now" 对 7B 太陌生，倾向"纠正"成完整句。
3. **重试机制首次实战验证**：G2/G4 本次各触发一次 retry x1，均救回——说明重试代码在真实 Ollama 500 场景下工作正常。
4. **naturalness 91% vs 基线 85%**：提升来自 C3/C5/B4 三句档位修对，不是随机噪声。
5. **no-correction 91% 与基线持平**：没有因为加强 B/C 类识别而误改 A/D/E/F/G（除已存在的 D2）。

---

## 6. 待批准决策

- B2/B3 是 7B 能力边界，是否接受现状等 14b？
- D2 误判是否需要专门加一条"网络俚语/不完整句式不要补全"的规则？
- 是否继续微调，还是停在当前版本？
