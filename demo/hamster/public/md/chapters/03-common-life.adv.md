---
title: 第三章：一只普通仓鼠的一生
---

## 出生 {#birth}

【新生行星，黎明，外景】

```yaml
type: background
url: /img/bg/civilization.svg
```

```yaml
type: transition
name: dawn
duration: 1800
```

> 一只普通仓鼠在晨光里出生。它不知道旧世界，也不知道自己会拥有多么短暂的一生。

@读书人
短暂并不等于空白。每一次嗅闻、奔跑和停步，都是它第一次抵达世界。

```yaml
type: when
condition: starMatched
```

> 旧世界的星图被刻进第一块记忆石。微弱的回声，从此比任何一只仓鼠活得更久。

```yaml
type: when
condition: '!starMatched'
```

> 没有来自旧世界的完整答案。新生命只得到一张留有空白的纸，可以自己写下开头。

@观测者
个体会忘记，代际也会失真。除非它们学会把经验留给尚未出生的同伴。

```yaml
type: activity
use: civilization/initialize
input:
  suggestedName: 仓生
  principles:
    - memory
    - curiosity
    - cooperation
  defaultLevel: 1
```

```yaml
type: actions
actions:
  - type: variables/push
    key: memories
    value: 文明把短暂生命写进共同记忆
```

```yaml
type: when
condition: civilizationLevel >= 2
```

> 它们在转轮的轴心刻下符号，又把符号教给下一窝幼崽。知识第一次跑得比生命更远。

```yaml
type: when
condition: civilizationLevel < 2
```

> 第一枚符号还很笨拙，却足以让下一只仓鼠不必从完全相同的地方重新开始。

- [去看群星黯淡以后的世界](chapter-4#dim-stars)

  ```yaml
  id: enter-dim-stars
  ```
