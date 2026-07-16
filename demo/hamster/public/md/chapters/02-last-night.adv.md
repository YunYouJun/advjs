---
title: 第二章：最后一夜
---

## 最后一夜 {#last-night}

【透明笼舍，深夜，内景】

```yaml
type: background
url: /img/bg/cage.svg
```

```yaml
type: transition
name: fade
duration: 1200
```

```yaml
type: when
condition: starMatched
```

> 星图回声贴在玻璃上。遥远世界熄灭前的光，照亮仓鼠短暂的一夜。

```yaml
type: when
condition: '!starMatched'
```

> 星图仍有误差。观测者关掉一半仪器，让安静重新回到笼舍。

@观测者
如果明天不再到来，我们应该打开门，继续记录，还是把一切留在可控范围里？

@读书人
不要替仓鼠决定世界的大小。我们只能选择，最后用什么目光看它。

- [打开笼门，让它自己寻找出口](chapter-3#birth)

  ```yaml
  id: open-the-door
  actions:
    - type: variables/increment
      key: empathy
      by: 2
  ```

- [继续观察，把最后一夜写进记录](chapter-3#birth)

  ```yaml
  id: keep-observing
  actions:
    - type: variables/increment
      key: curiosity
      by: 1
    - type: variables/increment
      key: observationCount
      by: 1
  ```

- [合上笼门，保存最后一个稳定样本](chapter-3#birth)

  ```yaml
  id: preserve-control
  actions:
    - type: variables/increment
      key: control
      by: 2
  ```
