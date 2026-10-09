---
title: 给明天的回答
---

## 把光寄回明天 {#entrusted}

> 你把今天的小事写进回信，折好信纸，放回窗边。信封上写着同一个地址，只是日期换成了明天。

@向导
故事可以在这里结束。等下一个人打开这封信时，也许会找到自己的开始。

```yaml
type: actions
actions:
  - type: variables/set
    key: ending
    value: send-light
```

> 窗边留下一张纸条：谢谢你替我保存今天。你终于明白，光一直都在可以记住的小事里。

```yaml
type: end
text: 结局一：把光寄回明天
```

## 留一封未拆的信 {#waiting}

> 你把信放进空白笔记。今天没有写出回答，但来信和窗边的光都被妥善保存。

@向导
暂时停在这里也是一种选择。你可以把不知道的事留给下一次，把今天的自己照顾好。

```yaml
type: actions
actions:
  - type: variables/set
    key: ending
    value: keep-letter
```

> 你合上笔记，在封面写下“待续”。房间安静下来，故事为下一次回来留下了位置。

```yaml
type: end
text: 结局二：留一封未拆的信
```
