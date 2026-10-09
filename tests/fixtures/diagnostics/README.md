# 静态诊断验收样例

`valid` 包含三个可达章节、合法变量、存在的本地 SVG 及有出口的循环。
`broken` 在相同结构中引入五类缺陷；两者均为可直接执行 `adv check` 的项目。

在仓库根目录执行 `pnpm build:advjs`，然后：

```bash
cd tests/fixtures/diagnostics/valid
node ../../../../packages/advjs/bin/adv.mjs check --json
```

`valid` 应退出 0，诊断为空。切换至同级 `broken` 后，命令应退出 1。

| broken 中的缺陷                     | 修复                           | 消失的诊断                       |
| ----------------------------------- | ------------------------------ | -------------------------------- |
| `start.adv.md` 引用 `missing#extra` | 改成 `extra`                   | `ADV_RUNTIME_UNKNOWN_TARGET`     |
| `extra` 没有可达入口                | 同上，连接到 `extra`           | `ADV_STATIC_UNREACHABLE_CHAPTER` |
| `/missing.svg` 不存在               | 改成 `/room.svg`               | `ADV_STATIC_MISSING_RESOURCE`    |
| `raedy` 拼写错误                    | 改成初始变量 `ready`           | `ADV_STATIC_UNKNOWN_VARIABLE`    |
| `loop` 只有自循环选项               | 添加 `- [Leave](start#finish)` | `ADV_STATIC_DEAD_END`            |

`tests/unit/cli/check-static.test.ts` 在临时副本中逐项修复并验证，不修改这些原始样例。
