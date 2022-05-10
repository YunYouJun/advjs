# DFS VS unist-util-visit

对比语法树中 [unist-util-visit](https://github.com/syntax-tree/unist-util-visit) 与 DFS（深度优先遍历）访问节点效率。

> unist-util-visit 使用的是一种改进的深度优先搜索，算法原理可见 [unist-util-visit-parents](https://www.npmjs.com/package/unist-util-visit-parents)。

## Usage

```bash
pnpm start:visit
```

## 结论

### 扁平的语法树下 breadth

| 节点数量 | method           | time      |
| -------- | ---------------- | --------- |
| 20000    | unist-util-visit | 116.55ms  |
| 20000    | dfs              | 2.15ms    |
| 50000    | unist-util-visit | 717.27ms  |
| 50000    | dfs              | 3.05ms    |
| 100000   | unist-util-visit | 2557.97ms |
| 100000   | dfs              | 2.97ms    |

unist-util-visit 性能弱于 dfs（深度优先遍历），节点数量越多时越明显。

### 有较高层级深度的语法树下 depth

| 节点数量 | method           | time                    |
| -------- | ---------------- | ----------------------- |
| 2000     | unist-util-visit | 26.96ms                 |
| 2000     | dfs              | 26.88ms                 |
| 5000     | unist-util-visit | 199.91ms                |
| 5000     | dfs              | 3062 时超出堆栈内存限制 |

unist-util-visit 性能与 dfs 性能接近，但是 dfs（递归版本） 在节点过多时，会超出内存限制。

### 关于 @adv/parser

Adv AST 主要基于 mdast 继续扩展实现，并去除无用的属性。
对于编写剧本来说，不存在过多的深度，因此内存方面不是主要考虑的问题。

普通遍历上 DFS 相比 unist-util-visit(拼接属性名称)的遍历方式性能更好。

故决定采用深度优先遍历的方式，而非 unist-util-visit。

## FAQ

map vs forEach vs for

普通的 `for` 循环是毋庸置疑的性能最好。

对于创建新数组来说，在 jsPerf 上的表现，map 要优于 forEach。

> [JavaScript — Map vs. ForEach](https://codeburst.io/javascript-map-vs-foreach-f38111822c0f)

而单纯循环来说，在下面这篇文中中，forEach 又优于 map。

> [Performance of JavaScript .forEach, .map and .reduce vs for and for..of](https://leanylabs.com/blog/js-forEach-map-reduce-vs-for-for_of/)

我自己的测试（普通的循环）中，forEach 也的确略优于 map。
