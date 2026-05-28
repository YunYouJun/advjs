# adv-debug

`adv-debug` 是 ADV.JS 的调试分析 Skill，帮助 AI Agent 系统性地检查项目的分支覆盖率、死路径和内容一致性。

## 命令列表

| 命令                                                                     | 说明                       |
| ------------------------------------------------------------------------ | -------------------------- |
| `adv check [--root] [--fix]`                                             | 验证项目完整性，可自动补桩 |
| `adv context [--root] [--full]`                                          | 读取完整项目上下文         |
| `adv debug branches <script> [--format=mermaid\|json\|text] [-o <file>]` | 生成剧本分支图             |
| `adv play <script> --session-id <id> --json`                             | 加载剧本测试               |
| `adv play next --session-id <id> --json`                                 | 推进到下一节点             |
| `adv play choose <n> --session-id <id> --json`                           | 选择分支路径               |
| `adv play list --json`                                                   | 列出测试会话               |
| `adv play reset --session-id <id>`                                       | 清理测试会话               |

## 工作流

```
1. Validate  → adv check 获取基础验证结果（必要时加 --fix 自动补桩）
2. Context   → adv context --full 读取全部内容
3. Analyze   → adv debug branches <script> --format=json 获取分支图结构
4. Test      → 按图驱动 adv play 遍历所有路径
5. Report    → 生成覆盖率报告（表格 + 嵌入 mermaid 图）
6. Fix       → adv check --fix 修可自动化的；剩下的人工补全
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

## 分支图

`adv debug branches` 直接解析 AST 输出分支图，是覆盖率分析的起点：

```bash
# 默认输出 mermaid
adv debug branches adv/chapters/01.adv.md

# 结构化数据，便于驱动遍历
adv debug branches adv/chapters/01.adv.md --format=json

# 终端友好的缩进树
adv debug branches adv/chapters/01.adv.md --format=text
```

`json` 形态会标注 `kind: "dead"` 的死路径（选择后没有任何后续节点），是死路径检测的依据。

## 自动修复

```bash
# 给未定义的 @角色 / 【场景】 自动生成 stub 文件
adv check --fix
```

注意：`--fix` 只创建新文件、永不覆盖；语法错误等需要人工修复。

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
