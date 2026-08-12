---
title: 生存还是毁灭
---

<!-- source:the-common-hamster/survival-or-destruction -->

## 空白世界 {#empty-world}

<!-- scene: empty-earth / 时间不明 / 外景 -->

```yaml
type: background
name: empty-earth
transition:
  name: fade
  duration: 1300
```

```yaml
type: bgm
name: world-restart
loop: true
fade:
  in: 1200
  out: 900
```

> 某个意识在刺眼白光中睁眼。平坦大地光滑得没有纹理，天空白得看不出高度，世界只剩亮与暗。它不知道自己是谁、从哪里来，又要到哪里去。

## 初始化 {#initialize-earth}

@读书人
你随口就要毁灭世界，还责怪我把恒星当暖手宝？

@观测者
有趣的是毁灭之后重新创造的部分。你们每一天本就是我额外留下的奇迹；现在我要把地球初始化，连同生物。

> `Init Earth? With Creature.` 对话框弹出。读书人来不及阻止，她已经确认。进度从零开始。

## 王安 {#wang-an}

<!-- scene: hospital-room / 初始化进度 0%—99% / 内景 -->

```yaml
type: background
name: hospital-room
transition:
  name: dissolve
  duration: 1000
```

```yaml
type: tachie
exit:
  - 观测者
  - 读书人
  - 小仓鼠
```

> 医生再次询问是否确定。王安缓慢点头。

> 他一直是普通人：成绩、相貌、家庭、大学、工作与薪水都在中间。一次意外彩票大奖却打破了世界为他维持的平庸；从不抽烟的父亲随即查出肺癌，奖金和积蓄都被治疗耗尽。

@王安的父亲
别治了。

> 呼吸机下的父亲只能用颤抖手势写出这三个字。王安终于承认，痛苦地延长生命也许只是满足自己的孝道与心安。

@医生
安乐死，确定吗？

@王安
嗯。

> 初始化 50%。父亲闭眼时，王安竟先感到轻松，随后又为这份轻松羞愧。世界的负反馈认为他的人生偏离过低，于是在病房外准备了一份“礼物”。

> 初始化 90%。如果再晚一点，他会遇到一位能够倾听苦闷的姑娘，也许完成结婚生子的普通愿望。

> 初始化 98%。医院花园里，一辆电动轮椅从背后撞来。

```yaml
type: background
name: hospital-garden
transition:
  name: crossfade
  duration: 900
```

@轮椅姑娘
实在对不起。

> 初始化 99%。在世界陷入漆黑之前，王安仍觉得这个世界糟透了。他不会知道下一秒本可能改变看法。

## 百分之百 {#one-hundred}

```yaml
type: background
name: empty-earth
transition:
  name: fade
  duration: 1100
```

```yaml
type: tachie
enter:
  - name: 观测者
    status: determined
    position: right
    motion: slide-right
  - name: 读书人
    status: worried
    position: left
    motion: slide-left
```

> 初始化 100%。原本蓝绿斑驳的地球成为纯黑球体，所有美好与丑恶、努力与放弃一同被擦除，不留痕迹。毁灭永远比创造轻松。

@读书人
对那些正在努力的人，太不公平了。

@观测者
但那与你有何相干？何况有趣的部分才刚开始。旧文明都有创世传说——那么，就像这样：要有光。

> 响指落下，黑色地球从顶端迸出白光，逐渐覆盖整颗星球。

- [见证新物种的诞生](duelist-romance#new-earth)

  ```yaml
  id: witness-new-species
  ```
