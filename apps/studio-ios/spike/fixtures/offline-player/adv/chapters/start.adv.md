---
title: 离线试玩
---

【房间，夜，内景】

```yaml
type: background
name: room
```

```yaml
type: bgm
action: set
asset: bgm/theme
loop: true
```

```yaml
type: tachie
enter:
  - name: 小云
    status: default
    position: center
```

@小云
断网也能试玩吗？我们来确认一下。

- [先看星图](#stars)
- [直接结束](#ending)

## 星图 {#stars}

```yaml
type: activity
use: star-map/compare
input:
  stars: 5
  hint: 对齐最亮的三颗星
```

@小云
星图已经校准。

## 结束 {#ending}

@小云
探针结束，存档后可以重新读档。
