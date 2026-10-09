---
title: 窗边的来信
---

## 午后的演示室 {#window}

【演示室，午后，内景】

> 信纸没有署名。窗外的光正好落在淡淡的字迹上：如果你愿意，请替明天的我保存一点今天的光。

@向导
信封和信纸也许藏着不同的线索。你可以反复查看，准备好了再决定怎样回答。

- [检查信封上的邮戳](#postcard)

  ```yaml
  id: inspect-postcard
  actions:
    - type: variables/increment
      key: readCount
  ```

- [先读信纸上的淡字](#faint-writing)

  ```yaml
  id: read-faint-writing
  actions:
    - type: variables/increment
      key: readCount
  ```

## 邮戳上的日期 {#postcard}

> 邮戳没有城市名，只有一个日期：明天。信封内侧还写着演示室的地址，字迹与你手中的空白笔记相似。

```yaml
type: actions
actions:
  - type: variables/set
    key: clueFound
    value: true
```

@向导
也许来信没有跨越很远的距离，只是跨过了一天。我们先把这条线索记下来。

- [记住日期，重新整理思路](#revisit)

  ```yaml
  id: remember-postcard
  ```

## 信纸上的淡字 {#faint-writing}

> 信纸的最后一行几乎融进光里：不必替我解决所有事，只要告诉我，今天发生过一件值得记住的小事。

@向导
有些答案藏在文字里，有些要回到信封上寻找。暂时没有找到线索，也可以先把信收好。

- [放下信纸，重新整理思路](#revisit)

  ```yaml
  id: finish-reading
  ```

## 可以回头的地方 {#revisit}

> 你把信纸摊在笔记旁。回看并不会让故事失去方向；想离开时，收好来信的路一直在这里。

```yaml
type: when
condition: clueFound
```

> 邮戳的日期已经记进笔记。现在，你可以沿着这条线索理解来信。

```yaml
type: when
condition: '!clueFound'
```

> 笔记还缺少一个日期。信封上的邮戳也许能回答来信从哪里来。

- [再读一次来信](#window)

  ```yaml
  id: reread-letter
  ```

- [沿着邮戳理解这封信](#understand)

  ```yaml
  id: understand-letter
  when: clueFound
  ```

- [先把来信收好](ending#waiting)

  ```yaml
  id: keep-letter
  ```

## 写给明天的自己 {#understand}

```yaml
type: actions
actions:
  - type: variables/set
    key: understoodLetter
    value: true
```

@向导
看来这封信是写给明天的自己。你第一次来到这里、读过一封信、做过几个选择，这些已经足够成为回答。

> 你在空白笔记上写下：今天，我开始了一个故事。窗边的光照着最后一个句号。

- [把光寄回明天](ending#entrusted)

  ```yaml
  id: send-light
  ```

- [还想再确认一下](#revisit)

  ```yaml
  id: confirm-letter
  ```
