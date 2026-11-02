# NativeSense v2 — 全量 35 句评测报告（qwen2.5:7b 基线）

- **运行时间**：2026-11-01 10:03:57 UTC
- **配置**：Ollama 本地 `qwen2.5:7b`，当前生产系统提示词（v2 六步流水线），解释语言 zh，温度 0.3（重试时 0.2）
- **原始 JSON**：`server/eval/results/eval-2026-11-01T10-03-57-101Z.json`
- **约束遵守**：未修改任何源码、提示词、schema、评估标签、模型参数；未删除/覆盖任何历史数据与报告。
- **14b 对比**：本地 `ollama list` 仅 `qwen2.5:7b`，**无 qwen2.5:14b**；按约定未下载、未安装，对比项见文末。

---

## 一、总览指标（runner 输出 + 人工复算一致）

| 指标 | 口径 | 结果 | 说明 |
|---|---|---|---|
| no-correction 一致率 | 「该不该纠正」布尔与人工标签是否一致 | **31/34 = 91%** | G4 推理报错，排除分母 |
| naturalness 四档精确率 | 四档逐一相等 | **29/34 = 85%** | 5 句档位不符 |
| grammar 三档精确率 | 三档逐一相等 | **32/34 = 94%** | C3、C5 不符 |
| 推理错误 | 模型输出未取回 | **1 句（G4）** | Ollama HTTP 500，token repeat limit |

> ⚠️ 这三个数字都是**与人工标签的一致率**，不是语言准确率。详见第四节。

## 二、按类别分解（A–G，每类 5 句）

| 类别 | 信号 | no-correction 一致 | naturalness 精确 | grammar 精确 | 失败句 |
|---|---|---|---|---|---|
| A 已自然 | 应 keep | 5/5 | 5/5 | 5/5 | — |
| B 语法对但别扭 | 应 fix | **3/5** | **2/5** | 5/5 | B2、B3（方向错）；B4（档位偏） |
| C 真语法错 | 应 fix | **4/5** | **3/5** | **3/5** | C3（方向错）；C5（档位/程度偏） |
| D 俚语网络语 | 应 keep | 5/5 | 5/5 | 5/5 | — |
| E 学术正式 | 应 keep | 5/5 | 5/5 | 5/5 | — |
| F 地域差异 | 应 keep | 5/5 | 5/5 | 5/5 | — |
| G 反讽讽刺 | 应 keep | 4/4（G4 报错） | 4/4 | 4/4 | G4 推理错误 |

**关键观察**：失败全部集中在 **B 类（母语迁移搭配）与 C 类（语法）**；所有「应保持自然」的类别（A/D/E/F/G，共 24 句有效）**零误改**——产品最核心的红线（不过度纠正自然句）在 7B 上成立。

## 三、混淆矩阵与逐句失败清单

### naturalness 四档（行=人工期望，列=模型实际，34 句有效）

| 期望＼实际 | natural | mostly_natural | awkward | unnatural |
|---|---|---|---|---|
| **natural**（24） | 24 | 0 | 0 | 0 |
| **mostly_natural**（1） | 0 | 1（B5） | 0 | 0 |
| **awkward**（4） | **2（B2,B3）** | 1（B4） | 1（B1） | 0 |
| **unnatural**（5） | **1（C3）** | 0 | 1（C5） | 3（C1,C2,C4） |

### grammar 三档

| 期望＼实际 | correct | minor_errors | incorrect |
|---|---|---|---|
| **correct**（29） | 29 | 0 | 0 |
| **incorrect**（5） | **1（C3）** | 1（C5） | 3（C1,C2,C4） |

### no-correction 混淆

- 正确判「需纠正」：7（B1,B4,B5,C1,C2,C4,C5）
- **漏报（应纠正却判 keep）：3**（B2, B3, C3）
- 正确判「无需纠正」：25（A/D/E/F/G 全部）
- **误改（应 keep 却判 fix）：0**

### 逐句失败明细

| 句 | 文本 | 期望 | 模型实际 | 性质 |
|---|---|---|---|---|
| B2 | Let's do a meeting tomorrow morning. | awkward / fix | **natural / keep**（解释称"do a meeting 是自然提议方式"） | 母语迁移搭配误判 |
| B3 | My English level is very poor… | awkward / fix | **natural / keep**（解释称"常见说法"） | 母语迁移搭配误判 |
| C3 | I am agree with you. | unnatural / incorrect / fix | **natural / correct / keep**（英文解释"I am agree…is perfectly fine"） | 真语法错误漏报 + 语言幻觉 |
| B4 | The price of the phone is expensive. | awkward / fix | mostly_natural / fix（但 recommended_expression=null） | 方向对、档位轻一档；schema 内部不一致（判修却无推荐） |
| C5 | Yesterday I go to the park. | unnatural / incorrect / fix | awkward / minor_errors / fix | 方向对、程度偏轻（时态错误降为 minor） |
| G4 | Sure, I'll get right on that. | natural / keep | **未取回**（Ollama 500 token repeat limit） | 推理偶发失败 |

## 四、一致性 ≠ 语言准确率 ≠ 评估质量

**1. 一致性（agreement）**：机器判定与人工标签的吻合度，可自动计算。91%/85%/94% 全属此类。

**2. 语言准确性**：判定本身在语言学上是否正确，需人工审阅。本次实测：
- **B2/B3 是真错误**：系统提示词的 COMMON NON-NATIVE PATTERNS 清单里**就印着这两条例句**（do a meeting / English level is poor），7B 仍判 natural——说明这不是提示词覆盖问题，而是小模型把"中文直译过来、语义通顺"误当成"英语地道"。报告里模型反复用"符合中文使用者的表达习惯"作为判自然的依据，是同一认知根源。
- **C3 是严重错误**："I am agree with you" 犯了"be+动词原形"语法错误，模型用英文回"natural and clear…perfectly fine"——这是语言学幻觉，比档位偏差更危险。
- **B4 方向正确但档位偏轻**："price is expensive" 确实别扭，模型识别到要修（no_correction_needed=false）只是降到 mostly_natural——属"部分准确"。
- **C5 同 B4**：识别要修，但把"Yesterday I go"（明确时态错误）降为 minor_errors——偏轻。
- **解释层的次要问题**：D1 把 "ngl" 误释为 "no geral"（实为 not gonna lie，幻觉）；G3 讽刺句分类正确（未改写）但解释当真感激理解——语用理解未真正发生，只是没破坏句子。

**3. 评估质量局限**（本评估自身的可信度边界）：
- 35 句全部真实跑完，但**单次运行**（温度 0.3 的 LLM 仍有随机性），无多次运行方差；
- 期望标签由单人拟定，无第二人复核（无标注者间一致性）；
- 类别样本小（每类 5 句），单句成败对类别指标影响达 20%；
- G4 因 Ollama 瞬时错误缺数据，runner 未自动重试该句。

## 五、与此前 10 句小样本的对比

| 指标 | 10 句（A/B） | 全量 35 句 | 解读 |
|---|---|---|---|
| no-correction 一致 | 80% (8/10) | 91% (31/34) | 小样本被 B 类集中失败拉低；全量 A/D/E/F/G 24 句全对拉高 |
| naturalness 精确 | 70% (7/10) | 85% (29/34) | 小样本同样高估了 B 类难度 |
| grammar 精确 | 100% (10/10) | 94% (32/34) | **全量才暴露 C3/C5 两个 grammar 错误** |

结论：此前 10 句评估**低估了整体 no-correction 水平，但高估了 grammar 可靠性**——全量评测是必要的。

## 六、7B vs 14B 对比

本地 `ollama list` 仅有 `qwen2.5:7b`。**未发现 `qwen2.5:14b`**，按你的指令未执行 `ollama pull` 或任何安装。14b 对比暂缺，需你批准下载后（约 9GB）再跑同数据集。

## 七、优先建议（按投入/收益排序，均未执行）

1. **最高优先：换模型验证，而非继续改提示词**。B2/B3 在提示词已列例句的前提下仍失效，C3 出现语法幻觉——这是 7B 能力边界。建议你批准后 `ollama pull qwen2.5:14b`，用同一 runner、同一数据集跑一次对比；若 14b 仍在 B2/B3/C3 失败，再考虑云端 API（DeepSeek/Qwen 兼容端点）。
2. **runner 加固**（小工程）：对 G4 这类 Ollama 瞬时 500 自动重试 1–2 次；把统计数字写进 JSON 报告（目前只在控制台打印）。
3. **schema 交叉约束**：`no_correction_needed=false` 时强制 `recommended_expression` 或 `issues` 至少其一非空（本次 B4 再次出现"判修却无推荐"）。
4. **评估集扩充**：C 类补"be+动词原形"类错误（目前 C3 暴露了盲区）；B 类补更多母语迁移搭配。
5. **暂不处理**：score 字段残留、旧数据迁移——与本次评测无关，等你决策。

## 八、完成 / 未完成 / 待批准

**已完成**：全量 35 句真实推理跑完；原始 JSON 落盘；本 Markdown 报告；按类别分解、混淆矩阵、失败模式、一致性/准确率/评估质量三层区分。

**未完成**：14b 对比（本地不可用）；多次运行方差；runner 加固与 schema 约束（需你批准才动代码）。

**待你批准**：
- 是否 `ollama pull qwen2.5:14b`（约 9GB）跑对比评测？
- 是否授权做 runner 加固 + schema 交叉约束这两个小工程改动？
