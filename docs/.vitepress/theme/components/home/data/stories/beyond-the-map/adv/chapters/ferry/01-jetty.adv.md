【渡口，黄昏，外景】 {#start}

```yaml
type: actions
actions:
  - type: variables/set
    key: pack
    value: [铜币]
  - type: variables/set
    key: rope
    value: false
```

> 河很宽。地图画到这里，就断了。

@摆渡人
旅者，过了这条河，就不在地图上了。

## 岸边 {#shore}

- [在芦苇丛里翻找](#reeds)
- [付一枚铜币过河](far-bank#cross)

  ```yaml
  actions:
    - type: variables/remove
      key: pack
      value: 铜币
  ```

- [系上绳索，沿河绕行](far-bank#around)

  ```yaml
  when: rope
  ```
