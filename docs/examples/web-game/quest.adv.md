@守门人
要接一单城里的配送吗？

- [接下配送](#accept)

  ```yaml
  id: accept
  when: '!game.hasQuest'
  ```

- [先去逛逛](#leave)

  ```yaml
  id: leave
  ```

## 接单 {#accept}

```yaml
type: activity
use: game-bridge/request
input:
  operation: accept-quest
  questId: town-delivery
```

```yaml
type: when
condition: requestOk
```

@守门人
接好了，路线已经交给你的地图。

```yaml
type: when
condition: '!requestOk'
```

@守门人
现在接不了，先处理手头的事情。

```yaml
type: end
```

## 离开 {#leave}

@守门人
路上留神。

```yaml
type: end
```
