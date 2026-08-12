---
title: 仓鼠们今天也在努力进化着
---

<!-- source:the-common-hamster/evolution -->

## 重返太空 {#return-to-space}

<!-- scene: simulated-orbit / 年代加速中 / 外景 -->

```yaml
type: background
name: simulated-orbit
transition:
  name: rise
  duration: 1100
```

```yaml
type: bgm
name: civilization-rise
loop: true
fade:
  in: 900
  out: 700
```

```yaml
type: tachie
enter:
  - name: 观测者
    status: smile
    position: right
    motion: slide-right
  - name: 读书人
    status: default
    position: left
    motion: slide-left
exit:
  - name: 巴
    motion: fade
```

@观测者
是不是相当有趣？

@读书人
嗯。不过好像没有我出场的机会。

@观测者
你明明抢了我的第三类接触。

> 两人的对话重新变得日常。读书人不再纠结旧地球是否毁灭，也可能是因为观测者请他吃了星球杯，还允许他睡在银河里。

## 向日葵城 {#sunflower-city}

<!-- scene: sunflower-city / 近现代 / 正午 -->

```yaml
type: background
name: sunflower-city
transition:
  name: dissolve
  duration: 1200
```

> 同一坐标已经没有草原与森林，只有低矮向日葵组成的花海。一架玩具大小的双翼机从头顶盘旋而过，仓鼠飞行员像在观察来客，又以缓慢速度引路。

> 广场上，衣着整齐、四肢灵活、皮毛逐渐退化的仓人涌来。汽车从远处驶近，电气时代显然已经到来。

@仓鼠众
女神大人！太阳女神现世了！

> 巨大雕像立在广场：观测者佝偻着身子埋瓜子，姿态如拾穗者。那是仓鼠们第一次看清她容貌的瞬间，也成了文明的信仰象征。

@读书人
那个是你吗？

@观测者
雕得很像，但能不能换个姿势……

> 黑色轿车驶入广场。身着礼服的仓鼠市长伸出手指，观测者熟练地与之相触。一个孩子也模仿礼节，随即从广场到远处排起长队。

@仓鼠孩子
神大人和我……碰到手指了！

> 管理者没有疏散人群，反而把队伍整理成更紧凑的螺旋。观测者只好拍响双手，调低重力，让黑色小点从天空缓缓飘落。

@仓鼠众
是瓜子！美味的瓜子！

> 这场神迹后来被记作持续三日的“瓜子雨”。观测者趁混乱抓住仍在做接手礼的读书人，落荒而逃。

@仓鼠众
神小姐果然是神啊！

- [读取瓜子雨之后的文明记录](stars-sea#after-seed-rain)

  ```yaml
  id: read-post-rain-history
  ```
