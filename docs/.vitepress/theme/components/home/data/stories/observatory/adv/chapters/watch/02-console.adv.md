## 观测 {#observe}

- [继续观测](#record)

  ```yaml
  actions:
    - type: variables/increment
      key: observationCount
  ```

- [调快时间流速](#evolve)

  ```yaml
  actions:
    - type: variables/increment
      key: civilizationLevel
  ```

- [回应它们的目光](contact#contact)

  ```yaml
  when: observationCount >= 2
  ```

## 记录 {#record}

> 它们在洞穴的墙上，画下了夜空。

- [回到观测](#observe)

## 演化 {#evolve}

```yaml
type: when
condition: civilizationLevel >= 3
```

> 第一座天文台，在它们的山顶上落成。

```yaml
type: when
condition: civilizationLevel < 3
```

> 一千年过去，它们学会了耕种。

- [回到观测](#observe)
