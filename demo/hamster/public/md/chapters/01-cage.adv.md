---
title: 第一章：笼外星光
---

## 笼中 {#cage}

【星海观测室，午后，内景】

```yaml
type: background
url: /img/bg/observatory.svg
```

```yaml
type: bgm
src: /audio/observatory.wav
```

```yaml
type: tachie
enter:
  - name: 观测者
    status: default
  - name: 读书人
    status: default
```

> 透明笼中的仓鼠踩动转轮。墙上的星图像另一只更大的转轮，缓慢旋转。

@观测者
你相信笼子外面还有别的世界吗？

@读书人
仓鼠看不见两米之外，人类也未必看得见自己的笼子。

```yaml
type: actions
actions:
  - type: variables/increment
    key: observationCount
    by: 1
```

- [继续观察星图](#star-map)

  ```yaml
  id: continue-observing
  actions:
    - type: variables/increment
      key: curiosity
      by: 1
    - type: variables/increment
      key: observationCount
      by: 1
  ```

- [暂时离开观测室](chapter-2#last-night)

  ```yaml
  id: leave-room
  actions:
    - type: variables/increment
      key: control
      by: 1
  ```

## 星图比对 {#star-map}

@观测者
这组星点不属于今天的天空。它也许来自已经结束的旧世界。

```yaml
type: activity
use: star-map/compare
input:
  stars: 7
  hint: 对齐最明亮的三颗星
```

```yaml
type: when
condition: starMatched && starMatchScore >= 0.82
```

@读书人
轮廓重合了。所谓外星讯号，也可能只是另一次世界循环留下的回声。

```yaml
type: when
condition: '!starMatched || starMatchScore < 0.82'
```

@读书人
轮廓没有完全重合，但误差同样是一条消息。我们不必让失败把时间困在这里。

- [带着星图回声走向最后一夜](chapter-2#last-night)

  ```yaml
  id: carry-signal-forward
  when: starMatched && starMatchScore >= 0.82
  ```

- [记录误差并走向最后一夜](chapter-2#last-night)

  ```yaml
  id: carry-signal-forward-failed
  when: '!starMatched || starMatchScore < 0.82'
  ```
