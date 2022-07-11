[开始]
```yaml
type: background
url: /img/bg/night.jpg
```
@旁白
这是个手搓的计算器，用来测试
先来选一个数字吧！

- [ ] 5

  ```ts
  $adv.store.userData.first = 5
  $adv.nav.next()
  ```

- [ ] 7

  ```ts
  $adv.store.userData.first = 7
  $adv.nav.next()
  ```
然后选操作：

- [ ] +

  ```ts
  $adv.store.userData.opt = 'add'
  $adv.nav.next()
  ```

- [ ] -

  ```ts
  $adv.store.userData.opt = 'sub'
  $adv.nav.next()
  ```

然后选被操作数：
- [ ] 2

  ```ts
  $adv.store.userData.second = 2
  $adv.nav.next()
  ```

- [ ] 3

  ```ts
  $adv.store.userData.second = 3
  $adv.nav.next()
  ```
这样就行了！
你的结果是：
```ts
let res = 0
if ($adv.store.userData.opt === 'add')
  res = $adv.store.userData.first + $adv.store.userData.second

else
  res = $adv.store.userData.first - $adv.store.userData.second

if (res % 2 === 0)
  $adv.nav.go('双数')

```
[单数]

你的结果是单数！
```ts
$adv.store.cur.order = Number.MAX_VALUE
$adv.nav.next()
```
[双数]

你的结果是双数！
