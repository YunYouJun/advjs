---
title: 第四章：群星黯淡以后
---

## 群星黯淡以后 {#dim-stars}

【星海观测室，时间尽头，内景】

```yaml
type: background
url: /img/bg/observatory.svg
```

```yaml
type: transition
name: fade
duration: 2200
```

> 恒星一颗接一颗沉入黑暗。仓鼠文明留下的最后一段记录，正等待一次读取。

@观测者
没有永恒的笼子，也没有永恒的观测者。现在，选择我们如何记住它们。

- [继续](#ending-still-gazing)

  ```yaml
  id: continue-gazing
  when: starMatched && curiosity + empathy >= control + 2
  actions:
    - type: variables/set
      key: ending
      value: still-gazing
  ```

- [继续](#ending-endless-wheel)

  ```yaml
  id: continue-wheel
  when: '!(starMatched && curiosity + empathy >= control + 2) && control >= curiosity + empathy'
  actions:
    - type: variables/set
      key: ending
      value: endless-wheel
  ```

- [继续](#ending-common-hamster)

  ```yaml
  id: continue-common
  when: '!(starMatched && curiosity + empathy >= control + 2) && !(control >= curiosity + empathy)'
  actions:
    - type: variables/set
      key: ending
      value: common-hamster
  ```

## 仍在仰望 {#ending-still-gazing}

```yaml
type: when
condition: 'ending == "still-gazing"'
```

> 我们仍在仰望。不是因为群星承诺回答，而是好奇与善意让黑暗之外始终留有方向。

## 无尽转轮 {#ending-endless-wheel}

```yaml
type: when
condition: 'ending == "endless-wheel"'
```

> 转轮没有停下。每一次稳定记录都复制了上一次选择，世界安全、精确，也再没有意外。

## 普通仓鼠 {#ending-common-hamster}

```yaml
type: when
condition: 'ending == "common-hamster"'
```

> 它只是一只普通仓鼠，活过、忘记、又把一点记忆交给后来者。普通因此不再等于徒劳。
