---
title: 世界的终焉
---

<!-- source:hamster/world-ending -->

## 无法否认的第四天 {#fourth-day}

<!-- scene: simulated-orbit / 第四日 / 外景 -->

```yaml
type: background
name: simulated-orbit
transition:
  name: crossfade
  duration: 900
```

```yaml
type: bgm
name: final-echo
loop: true
fade:
  in: 1000
  out: 900
```

```yaml
type: tachie
enter:
  - name: 观测者
    status: worried
    position: right
    motion: fade
  - name: 读书人
    status: determined
    position: left
    motion: fade
```

> 倒计时归零，太阳仍照常升起，蝉鸣依旧聒噪。这是无法否认的第四天。

@观测者
按理说水星、金星该爆炸，或发生加速器事故、生化危机、战争、基因灾难……为什么这么和平？

@读书人
真的只有内部原因吗？

> 她否认外星入侵与天文灾变。读书人却从周围揽来几颗星，追问这幅星图在观测者发现遗迹之前是否也完全正确。

@观测者
银河边缘本来就没被仔细探索，但几颗星的位置不该改变奇点。

@读书人
如果太阳系原本不在银河系，只是后来途经边缘、被引力俘获呢？那真实历史中的夜空，会与你布置的完全不同。

## 回溯星图 {#compare-star-map}

```yaml
type: activity
use: star-map/compare
input:
  stars: 9
  hint: 将太阳系沿假定轨道反向推回银河系之外
```

```yaml
type: when
condition: starMatched && starMatchScore >= 0.82
```

> 轨迹与历史残差重合。包裹太阳系的奥尔特云反向旋转，脱离银河后却像撞上洼地般减速。

```yaml
type: when
condition: '!starMatched || starMatchScore < 0.82'
```

> 图形没有完全重合，读书人仍从误差中指出同一个缺口：太阳系来到银河之前，夜空数据根本不存在。

@观测者
黑域。陷入其中的一切都接收不到外界光线。你说对了：我的星图完全错了，因为那里根本没有星图。

@读书人
没有牛郎织女、星座星云、北辰与星宿传说，也不会有我正在读的宇宙幻想。失去寄托好奇、幻想与信仰的星光，人类世界还剩什么？

> 《海伯利安的陨落》被他握在手里。观测者终于明白，仰望星空也许正是人类不断认识渺小、奋力向前的原因。

@观测者
无论模拟成功与否，我都要重启世界，用新猜想再推演一次。谢谢你的提示，小仓鼠。

```yaml
type: tachie
enter:
  - name: 观测者
    status: smile
    position: right
  - name: 读书人
    status: smile
    position: left
  - name: 小仓鼠
    status: sleepy
    position: 56
    scale: 0.4
    motion: fade
```

@读书人
当人类开始仰望时，空无一物的世界会让人失望。谢谢你让我拥有这片星空的幻想——也谢谢款待。

> 她把半睡半醒的小仓鼠交给他。他问起名字；她说，有了名字，分别时会更伤感。随后虚拟身躯散去，旧世界如预料般分崩离析。

```yaml
type: cg
id: old-world-collapse
transition:
  name: dissolve
  duration: 1600
```

- [读取观测者的课程报告](endless-symphony#academy-report)

  ```yaml
  id: read-academy-report
  ```
