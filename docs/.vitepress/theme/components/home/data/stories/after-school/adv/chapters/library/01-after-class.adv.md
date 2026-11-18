【图书室，放学后，内景】 {#start}

```yaml
type: actions
actions:
  - type: variables/set
    key: affection
    value: 0
```

> 夕阳斜斜地照进来，书架的影子一直伸到你脚边。

@林夏
图书室六点关门。在那之前……再陪我读一页，好不好？

- [再陪她读一页](#page)

  ```yaml
  actions:
    - type: variables/increment
      key: affection
  ```

- [把书签夹进去，先走了](#leave)
