---
title: 关于世界毁灭的二三事
---

<!-- source:hamster/world-destruction -->

## 久违的星空 {#starry-room}

<!-- scene: starfield-room / 次日 / 内景 -->

```yaml
type: background
name: starfield-room
```

```yaml
type: tachie
enter:
  - name: 观测者
    status: default
  - name: 读书人
    status: default
exit:
  - 小仓鼠
```

```yaml
type: transition
name: fade
duration: 1000
```

> 今日的房间不再透明简洁。繁星罩着长满嫩草的山坡，远处留着昨日黄昏的余色；散落的家具却让两人像无家可归的旅人。

@读书人
很棒的场景。

@观测者
送你好了，不过你可能无福消受。

> 她把场景数据发进他的邮箱。他仍从书架取下昨日未完的书，对她惯常的末日玩笑不置可否。

@观测者
你不问我吗？

@读书人
想说的话，你一定憋不住。

> 两人并肩躺在虚拟草坡上。她一遍遍确认他做好了心理准备，甚至问：即使他的秘密会因此变得无关紧要？

@读书人
女士优先。

@观测者
这时候谦让太狡猾了。你要从各个方面做好准备。

- [直接说出倒计时](#three-days)

  ```yaml
  id: reveal-directly
  actions:
    - type: variables/increment
      key: control
      by: 1
  ```

- [先确认他仍愿意听](#three-days)

  ```yaml
  id: reveal-gently
  actions:
    - type: variables/increment
      key: empathy
      by: 1
  ```

## 三天 {#three-days}

@观测者
距离世界毁灭，还有三天。

```yaml
type: tachie
enter:
  - name: 观测者
    status: worried
  - name: 读书人
    status: curious
```

> 读书人的神情从期待凝成呆滞。他以为那只是一个过分的玩笑，可她没有笑。

- [追问这个世界为何必然毁灭](starry-fantasy#proof)

  ```yaml
  id: ask-for-proof
  ```
