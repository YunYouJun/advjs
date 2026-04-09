# adv-debug

`adv-debug` 是 ADV.JS 的调试分析 Skill，帮助 AI Agent 系统性地检查项目的分支覆盖率、死路径和内容一致性。

## 命令列表

| 命令                                           | 说明               |
| ---------------------------------------------- | ------------------ |
| `adv check [--root]`                           | 验证项目完整性     |
| `adv context [--root] [--full]`                | 读取完整项目上下文 |
| `adv play <script> --session-id <id> --json`   | 加载剧本测试       |
| `adv play next --session-id <id> --json`       | 推进到下一节点     |
| `adv play choose <n> --session-id <id> --json` | 选择分支路径       |
| `adv play list --json`                         | 列出测试会话       |
| `adv play reset --session-id <id>`             | 清理测试会话       |

## 工作流

```
1. Validate  → adv check 获取基础验证结果
2. Context   → adv context --full 读取全部内容
3. Analyze   → 分析分支结构，统计每章的分支点和选项
4. Test      → adv play 自动遍历所有分支路径
5. Report    → 生成覆盖率报告（表格形式）
6. Fix       → 标注问题并给出修复建议
```

## 检查项目

### 结构检查

- 所有 `.adv.md` 文件语法正确
- 所有 `@角色名` 引用都有对应的 `.character.md`
- 所有 `【场所】` 引用都有对应的 `scenes/*.md`

### 分支覆盖

- 每个章节的分支点和选项数量
- 所有分支路径是否都有后续内容
- 是否存在死路径（选择后没有内容）

### 内容一致性

- 角色对话是否符合 `.character.md` 中的性格描述
- 术语使用是否与 `glossary.md` 一致
- 章节过渡是否流畅

## 输出示例

```
## 分支覆盖报告

| 章节 | 分支点 | 选项数 | 已覆盖路径 | 覆盖率 |
|------|--------|--------|------------|--------|
| CH01 | 2      | 4      | 4/4        | 100%   |
| CH02 | 1      | 2      | 2/2        | 100%   |
| CH03 | 1      | 2      | 2/2        | 100%   |

## 发现的问题

1. ⚠ CH02 分支 B → CH03 缺少过渡段落
2. ❌ BAD END 路径未定义
3. ℹ 建议 CH03 在闪回后增加分支点
```

## 参考

- [Skill 定义文件 - GitHub](https://github.com/YunYouJun/advjs/blob/main/skills/adv-debug/SKILL.md)
- [adv check 命令](/guide/cli#check)
- [adv play 命令](/guide/cli#play)
