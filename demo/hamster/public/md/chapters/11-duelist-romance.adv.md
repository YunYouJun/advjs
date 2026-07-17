---
title: 决斗者的浪漫
---

<!-- source:the-common-hamster/duelist-romance -->

## 新生地球 {#new-earth}

<!-- scene: newborn-earth / 创世初期 / 外景 -->

```yaml
type: background
name: newborn-earth
```

```yaml
type: tachie
enter:
  - name: 观测者
    status: smile
  - name: 读书人
    status: default
  - name: 小仓鼠
    status: running
```

> 光覆盖地球，空气、海与陆地依次部署。读书人仍舍不得那颗黄色恒星；仓鼠醒来后，竟在光球表面把它当作转轮。

@观测者
发动融合效果。

@读书人
你到底在做什么？

@观测者
旧人类的智慧，加上仓鼠的思维与身体。新物种就叫“仓人”，它们会成为世界主宰。

> 她把涌入大量信息后再次睡去的仓鼠投向地球，又按自己觉得“帅”的顺序部署恐龙。环境直接取用中生代，低含氧量则把巨兽体型压到仓鼠勉强能够应付的范围。

@观测者
仓鼠大战恐龙，听起来就很有趣。

> 数个平均人类模板生成的小族群迅速繁殖，又在数百年间被始盗龙吃到灭绝。

@读书人
寿命太短，它们没有时间学习和传递经验。

> 三年寿命被延长到十年。更关键的是“记忆结晶”：个体死后，毕生知识化成瓜子大小的结晶，由下一代直接继承。投石、石矛与围猎终于不会随个体死亡而归零。

```yaml
type: activity
use: civilization/initialize
input:
  suggestedName: 仓人文明档案
  principles:
    - memory
    - curiosity
    - cooperation
  defaultLevel: 1
```

```yaml
type: actions
actions:
  - type: variables/push-unique
    key: memories
    value: 记忆结晶让经验跑得比短暂生命更远
```

> 记忆结晶被收进第一份文明档案。时间再次加速，投影里仓人已能用石木长矛反过来狩猎始盗龙。

@观测者
我们下去看看。照这个速度，也许能遇见一群普通仓鼠模样的家伙，正在捕猎各种恐龙。

> 两人落在史前草原。她刚开始辨认植物，背后便传来震动，一只“手”搭上了肩膀。她毫不犹豫完成整套过肩摔。

- [回头面对草原之王](lizard-king#rex)

  ```yaml
  id: face-the-lizard-king
  ```
