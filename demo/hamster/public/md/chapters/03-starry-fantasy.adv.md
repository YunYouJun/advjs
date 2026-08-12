---
title: 星空的狂想
---

<!-- source:hamster/starry-fantasy -->

## 证据 {#proof}

<!-- scene: simulated-orbit / 三日倒计时 / 外景 -->

```yaml
type: background
name: simulated-orbit
transition:
  name: rise
  duration: 1400
```

```yaml
type: bgm
name: star-revelation
loop: true
fade:
  in: 1200
  out: 900
```

@读书人
突然说世界会毁灭，没有人会信。证据呢？

@观测者
你认为自己是真实存在的吗？

@读书人
接下来你要说，我只是虚拟人物，这个虚拟世界三天后会被销毁？

@观测者
猜得很准。只是那只仓鼠并不是幕后 Boss，它和你一样，来自普通单细胞生物的进化。

> 她终于坦白：自己正是观测者。真实的人类文明早已灭亡，眼前世界是从遗迹信息建模出的考古模拟，用于追索毁灭原因。

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

> 为证明一切，她拉住他的手。草坡下沉，房间壁障、城市和云层依次缩小，蓝色地球悬在脚下。

@观测者
人类毁灭没有外因，原因只能来自自身。文明毁灭是历史奇点；告诉你，也不会改变进程。

@读书人
连不可控的变数也能推算？

@观测者
无关的变数不会改变“抵达公司”这件事。何况模拟根本不必超出太阳系——你们无论如何也飞不出去。

> 她把一颗恒星缩成乒乓球般的光团，推到他面前，仿佛那就是人类努力观测的一整个宇宙。

```yaml
type: cg
id: star-in-hand
transition: flash-white
```

@观测者
如果你不安，我可以消除这段记忆。

@读书人
不必。只是，为什么选择告诉我？

@观测者
因为你很可爱……像小仓鼠一样。对了，你的秘密呢？

@读书人
已经无关紧要了。

> 他低下头，失落无法掩饰。离开前，他照惯例说了“谢谢款待”。她只以“世界末日见”作别，却开始怀疑自己是否该让所有人在梦中带着明日的幻想消失。

- [等待预言中的第三天](world-ending#fourth-day)

  ```yaml
  id: wait-for-ending
  ```
