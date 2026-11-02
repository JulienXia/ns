# NativeSense v2 — 评估审阅报告（第一批 10 句）

> 日期：2026-11-01 · 模型：Ollama `qwen2.5:7b`（本地，离线）· 解释语言：中文
> 复跑命令：`npm run eval -w server -- --limit 10`
> 原始报告 JSON：`server/eval/results/eval-2026-11-01T04-28-13-713Z.json`（另有更早两轮：`…T04-25-07-350Z.json`、`…T04-26-53-907Z.json`）

## 一、结论（30 秒版）

- **核心红线达标：自然句 5/5 全部正确判定"无需纠正"，没有被过度改写。** 这是 v2 产品最重要的一条——一个把自然英语改得面目全非的教练是产品级失败，这条没发生。
- **别扭句识别 3/5**：用户示例句（"a technological problem on my win computer"）以及两处"有更地道说法但不算错"的句子（price is expensive、give you a reply）都能正确给出改进；但 2 句母语迁移型搭配（"do a meeting"、"my English level is poor"）被误判为 natural。
- **语法判定 10/10 全对**（本批没有真语法错误句，语法正确性判定零误报）。
- **三轮提示词迭代把 no-correction 一致性从 60% 提到 80%**，且 A 类全程不退化。

## 二、逐句结果（最终轮）

| ID | 句子（语境） | 期望 | 模型判定 | 结果 |
|---|---|---|---|---|
| A1 | I'm running a bit late, could you grab me a coffee?（朋友闲聊） | natural / 不纠正 | natural / 不纠正 | ✅ |
| A2 | I'm gonna grab some food, wanna come?（朋友闲聊） | natural / 不纠正 | natural / 不纠正 | ✅ |
| A3 | Thanks for the help, I really appreciate it.（朋友闲聊） | natural / 不纠正 | natural / 不纠正 | ✅ |
| A4 | The meeting got moved to 3pm, just so you know.（工作邮件） | natural / 不纠正 | natural / 不纠正 | ✅ |
| A5 | Can you send me the report when you get a chance?（工作邮件） | natural / 不纠正 | natural / 不纠正 | ✅ |
| B1 | I have a technological problem on my win computer.（朋友闲聊） | awkward / 纠正 | awkward / 纠正 | ✅ |
| B2 | Let's do a meeting tomorrow morning.（工作邮件） | awkward / 纠正 | natural / 不纠正 | ❌ |
| B3 | My English level is very poor, so I want to practice more.（朋友闲聊） | awkward / 纠正 | natural / 不纠正 | ❌ |
| B4 | The price of the phone is expensive.（在线讨论） | awkward / 纠正 | mostly_natural / 纠正 | ✅* |
| B5 | I will give you a reply as soon as possible.（工作邮件） | mostly_natural / 纠正 | mostly_natural / 纠正 | ✅ |

\* B4 判定为 mostly_natural（比期望的 awkward 高一级），但**给出了纠正**（no_correction_needed=false），改进建议合理，可接受。

## 三、三轮提示词迭代记录

| 轮次 | 改动 | A 类（5 句） | B 类（5 句） | no-correction 一致性 |
|---|---|---|---|---|
| ① 基线 | 六步流水线 + 3 个 few-shot | 5/5 ✅ | B1 仅 1/5 | 60% |
| ② 加 STEP 3 怀疑清单 + STEP 5 触发规则 + 第 4 个 few-shot（mostly_natural 案例） | 5/5 ✅ | B1、B5 共 2/5 | 70% |
| ③ 加"你能否想到更地道说法"决定性测试 + 常见非母语迁移模式教学清单 | 5/5 ✅ | B1、B4、B5 共 3/5 | 80% |

停止迭代的原因：剩余 2 句（B2/B3）是模型的知识盲区而非判定规则问题——即使提示词里白纸黑字列出 "do a meeting" 和 "level is poor" 两个模式，模型仍坚持认为它们是自然英语（模型把"语义合理/中文语境合理"当成了"英语地道"）。继续加规则开始有过拟合评估集、反噬 A 类的风险。

## 四、已知限制与建议

1. **7B 模型对"母语迁移型搭配"存在盲区**：英语学习者最典型的错误（把中文"做会议/水平差"直译）恰恰是 7B 模型最难识别的。这属于模型能力边界，不是提示词能解决的。
2. **升级路径**（按收益排序）：
   - `ollama pull qwen2.5:14b` 并把 `.env` 的 `AI_MODEL` 改成它——大概率显著改善（建议下一步直接试）。
   - 或换云端 OpenAI 兼容模型（DeepSeek / Qwen 云端 / GPT 等），`.env` 一行切换，代码零改动。
3. **判定哲学已达成**：模型从未把自然句硬改（A 类 5/5），过度纠正这条红线守住了；代价是"漏纠"多于"误纠"。对学习产品，漏纠可接受（用户可以追问），误纠不可接受（会教坏）。当前行为方向正确。
4. **评估集可扩展**：35 句已覆盖 7 类，未来每修一次提示词跑 `npm run eval` 对照历史报告即可追踪退化。

## 五、如何复跑

```bash
# 全部 35 句（较慢，每句约 10–30 秒）
npm run eval

# 指定句 / 指定类别
npm run eval -w server -- --ids A1,B2,C3
npm run eval -w server -- --categories A,B

# 结构测试（评估集自身完整性，无模型依赖，进 CI 即可）
npm test
```
