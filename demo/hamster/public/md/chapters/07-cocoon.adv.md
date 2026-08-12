---
title: 作茧自缚
---

<!-- source:the-common-hamster/cocoon -->

## 唯一神 {#only-god}

<!-- scene: simulated-orbit / 深空 / 外景 -->

```yaml
type: background
name: simulated-orbit
transition:
  name: rise
  duration: 1300
```

```yaml
type: bgm
name: deep-space
loop: true
fade:
  in: 1100
  out: 800
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
  - name: 小仓鼠
    status: sleepy
    position: 56
    scale: 0.4
    motion: fade
```

@观测者
没错，我是外星人，也是你们所谓的神。唯一神。

> 她在漂浮的家具间寻找仓鼠，读书人则从每个方向打量近在咫尺的星河。真正的宇宙本该黑暗、寒冷、寂静；这里的星云、光热与空气只是她调得恰到好处的舞台。

@观测者
名为人类的生物两三万年前就灭亡了。你们只是模拟数据里的字节流，灭亡原因是作茧自缚。

> 毛线团被抽开，露出仍在熟睡、缓缓旋转的仓鼠。她停住它的华尔兹，把它抱回怀中。

@读书人
那么这个世界很快也会毁灭？

@观测者
本该如此。但地球上有你在乎的人吗？

> 他脸红了。她却揭开更残酷的一层：他从来没有家人与朋友，记忆只是填入对象的数据；每到午后来此读书，甚至那份幸福感，都来自初始化程式。

@读书人
所以我的出生、记忆与幸福，全是设定？

@观测者
这个世界原本只为还原灭亡真相。现在答案已经找到，只要工作站还能承受，你们可以看我的心情继续存在。

> 读书人捧起一颗黄色恒星。温度像合适的暖手宝。他沉浸于原本触不可及的星空，反而不再追问自己是否真实。

@观测者
我费这些口舌，是因为无聊。更主要的是——我暂时也出不去了。

@读书人
你也无法离开这个世界？

> 登出入口仍未恢复。熟睡仓鼠、读书人与远处地球恰好连成一线，一个危险而有趣的念头在她脑中成形。

@观测者
我们毁灭世界吧。

```yaml
type: tachie
enter:
  - name: 观测者
    status: smile
    position: right
    motion: emphasis
  - name: 读书人
    status: curious
    position: left
```

- [问她毁灭之后要做什么](survival-or-destruction#empty-world)

  ```yaml
  id: ask-what-comes-after
  ```
