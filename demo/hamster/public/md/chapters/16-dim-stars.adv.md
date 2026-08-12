---
title: 黯淡的星空
---

<!-- source:the-common-hamster/dim-stars -->

## 最终答复 {#final-answer}

<!-- scene: solar-system-frontier / 恒星舰队包围中 / 外景 -->

```yaml
type: background
name: solar-system-frontier
transition:
  name: fade
  duration: 1400
```

```yaml
type: bgm
name: final-echo
loop: true
fade:
  in: 1200
  out: 900
```

```yaml
type: tachie
enter:
  - name: 观测者
    status: determined
    position: right
    motion: fade
  - name: 读书人
    status: worried
    position: left
    motion: fade
  - name: 仓鼠军官
    status: defiant
    position: center
    scale: 0.72
    motion: fade
```

```yaml
type: transition
name: fade
duration: 1800
```

> 模拟智慧真的能超过框架开发者吗？观测者否定了这个可能。即使虚拟宇宙里被赠予违反能量守恒的恒星，承载一切的外部工作站仍有极限。

@观测者
仓鼠先生，你有一点失策了。我拒绝。

@仓鼠军官
那就没什么好说的。为了文明，我们终究要试一试。

> 当神明威胁生存，信徒也会向神开战，哪怕明知是螳臂当车。

@仓鼠军官
因为，我们是人类啊！为了人类！为了文明！

> 最大的 Danger 按钮被按下。成千上万艘军舰同时加速恒星演变，数万光点向观测者汇集，黯淡星空刹那间比任何时候都耀眼。

```yaml
type: cg
id: stars-volley
transition: flash-white
```

@观测者
只有真正的神明才能毁灭你们。可你们已经成为神明——所以能毁灭你们的，也只有你们自己。

> 光点行进忽然放缓，读书人的惊讶表情也变成慢镜头。时间加速需要的并不是世界内部物质，而是外部工作站的运算资源。

> 成千上万颗恒星演变、成千上万亿仓人的清醒思考，同时压向处理器。恒星即将化为黑洞的前一刻，全部无声消散。

> 星空骤暗，一切不复存在。

## 现实工作站 {#workstation}

<!-- scene: real-workstation / 关机之后 / 内景 -->

```yaml
type: background
name: real-workstation
transition:
  name: fade
  duration: 1800
```

```yaml
type: tachie
enter:
  - name: 小仓鼠
    status: running
    position: center
    scale: 0.48
    motion: hop
exit:
  - name: 观测者
    motion: fade
  - name: 读书人
    motion: fade
  - name: 仓鼠军官
    motion: fade
```

> 超频保护。不论多昂贵的工作站，超过频率或温度都会自动关机——正如发展失控的文明。

> 桌旁真实的仓鼠正撕咬笼子。大概该喂食了。

```yaml
type: cg
id: reality-workstation
transition:
  name: crossfade
  duration: 1200
```

```yaml
type: actions
actions:
  - type: variables/set
    key: canonicalCompleted
    value: true
  - type: variables/set
    key: ending
    value: starlight-echo
  - type: variables/push-unique
    key: unlockedEndings
    value: starlight-echo
```

> 工作站冷却后重新亮起待机灯。记忆结晶里仍保存着无数次仰望；下一次演算，可以从另一组星图参数开始。
