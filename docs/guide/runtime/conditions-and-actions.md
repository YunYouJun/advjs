# Variables、Conditions 与 Actions

运行时逻辑使用可重放的纯数据声明，不执行故事中的 JavaScript/TypeScript。

## 初始变量

在 `adv.config.ts` 中声明 JSON 初始值：

```ts
export default defineAdvConfig({
  gameConfig: {
    variables: {
      observationCount: 0,
      starMatched: false,
      clues: [],
    },
  },
})
```

变量只能包含 `null`、布尔值、有限数字、字符串、数组和普通对象。循环引用、`Map`、类实例、DOM 或 Vue Ref 会被 Runtime 拒绝。

## 条件

`type: when` 会把条件应用到紧随其后的运行时节点：

````md
```yaml
type: when
condition: starMatched && starMatchScore >= 0.82
```

> 星图轮廓已经重合。
````

支持的语法：

- JSON 字面量和 `observation.count` 形式的变量路径；
- `!`、`&&`、`||`；
- `==`、`!=`、`<`、`<=`、`>`、`>=`；
- `+`、`-`、`*`、`/`、`%` 和括号。

不支持函数调用、赋值、方括号动态属性、全局对象或 `constructor` / `prototype` / `__proto__`。表达式在编译期解析为纯数据树；除零或产生非有限数字也会报错。

## 内置动作

独立动作节点：

````md
```yaml
type: actions
actions:
  - type: variables/increment
    key: observationCount
    by: 1
  - type: variables/set
    key: starMatched
    value: true
```
````

| 动作                    | 参数                        | 行为                         |
| ----------------------- | --------------------------- | ---------------------------- |
| `variables/set`         | `key`, `value`              | 设置值，可创建安全的嵌套路径 |
| `variables/increment`   | `key`, `by?`                | 数字增加，`by` 默认 1        |
| `variables/decrement`   | `key`, `by?`                | 数字减少，`by` 默认 1        |
| `variables/toggle`      | `key`                       | 切换布尔值                   |
| `variables/push`        | `key`, `value`              | 向数组追加 JSON 值           |
| `variables/push-unique` | `key`, `value`              | 值不存在时才向数组追加       |
| `variables/remove`      | `key`, `index?` 或 `value?` | 按索引或 JSON 值删除         |

`key` 使用点号路径，但禁止原型链相关字段。类型不匹配会产生 `ADV_RUNTIME_INVALID_ACTION`，不会静默转换。
`push-unique` 使用 JSON 值相等性判断重复项，适合结局、CG 或成就 ID 等需要幂等解锁的数组。

## 条件选择与选择动作

选择下方的 YAML 块可以同时声明可见条件和选中后动作：

````md
- [初始化文明](chapter-2#initialize)

  ```yaml
  id: initialize-civilization
  when: starMatched && observationCount >= 1
  actions:
    - type: variables/increment
      key: observationCount
      by: 1
  ```
````

`id` 是可选的作者 ID，适合路线测试、调试追踪和长期存档。它只能包含字母、数字、点、下划线与连字符，并且同一组选择内不能重复；省略时仍生成向后兼容的 `choice-1`、`choice-2`。

条件不成立的选项不会暴露给浏览器或 CLI；动作在记录选择后、进入目标节点前执行。

插件动作必须使用 `plugin-name/action-name` 命名空间，详见 [插件与活动](/guide/runtime/plugins-and-activities)。
