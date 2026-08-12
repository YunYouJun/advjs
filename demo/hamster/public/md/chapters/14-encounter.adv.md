---
title: 相遇
---

<!-- source:the-common-hamster/encounter -->

## 探索王苏醒 {#awakening}

<!-- scene: exploration-space / 时间不明 / 外景 -->

```yaml
type: background
name: exploration-space
transition:
  name: rise
  duration: 1400
```

```yaml
type: bgm
name: deep-space
loop: true
fade:
  in: 1200
  out: 900
```

```yaml
type: tachie
enter:
  - name: 探索王
    status: awakened
    position: center
    scale: 0.76
    motion: fade
  - name: 观测者
    status: curious
    position: right
    motion: slide-right
  - name: 读书人
    status: default
    position: left
    motion: slide-left
```

> 探索王睁眼，没有看到仪器面板，只有触手可及的星河。赤裸的身体直接漂浮在宇宙中，探索号已被拆成一圈机械残骸。

```yaml
type: cg
id: explorer-awakening
transition:
  name: dissolve
  duration: 1200
```

> 两个与仓人一样拥有四肢、体型却无比巨大的生物出现在眼前。父辈的记忆结晶产生共鸣，唤醒了古老礼节。

@探索王
请问，是神小姐吗？

@观测者
没错。

@读书人
我好像又被无视了。

> 探索王伸出手指，与神小姐温暖的指尖相触。

@探索王
是您救了我吗？

```yaml
type: tachie
enter:
  - name: 探索王
    status: reverent
    position: center
    scale: 0.76
    motion: emphasis
```

## 被拆开的探索号 {#dismantled-ship}

> 不久前，观测者与读书人刚从接手礼长队逃回太空，便先后发现了仓鼠版旅行者号与转轮飞船。她称赞其速度，也担心地球资源无法支撑这种增长。

@观测者
这群家伙搞不好比旧人类更强。不过你的船，是我拆的哦。

> 加速液散入太空，冬眠中的探索王滑出。飞船最中心悬着指甲大小的黄色光球，温暖、熟悉，却不是地球应有的物质。

@观测者
助手君，你那颗二等目视星呢？

@读书人
不是被你收起来了吗？……等等，过肩摔之前我还抱着，后来就不见了。

> 那颗恒星遗落地球，被仓鼠文明切割成永动力源。它在这个虚假宇宙里仍拥有真实设定的聚变能量，从根本上替仓人“解决”了能量守恒限制；剩余部分足以支持指数增长。

> 观测者忽然发现整个空间暗了一些。她试图把时间流速调回正常，红色对话框却只返回四个字：没有权限。

- [赶往太阳系确认控制权](they-are-gods#forbidden)

  ```yaml
  id: return-to-solar-system
  ```
