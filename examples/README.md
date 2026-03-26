# Examples

最小化的 ADV.JS 示例，每个示例聚焦于一个特定功能或用法。适合快速理解某个概念或作为代码参考。

## 示例列表

| 示例                  | 说明                                                              |
| --------------------- | ----------------------------------------------------------------- |
| **singlefile**        | 单文件导出 — 将整个游戏打包为一个 `index.html`，使用 Pominis 主题 |
| **singlefile-script** | 编程式构建 — 通过 TypeScript API 调用构建，适合 CI/CD 集成        |
| **adv-format**        | 格式参考 — 展示 `.adv.md`、`.fountain` 等不同脚本格式的写法       |

## 与 demo 的区别

- **examples/** — 最小化代码示例，聚焦于单一功能点，文件少、配置简单，适合快速上手
- **demo/** — 完整的游戏工程，包含多章节、角色、资源等，适合作为项目模板和深入学习

## 运行示例

```bash
# 单文件导出
cd examples/singlefile
pnpm dev      # 开发模式
pnpm build    # 构建为单个 index.html

# 编程式构建
cd examples/singlefile-script
pnpm build    # 通过 TypeScript API 构建
```
