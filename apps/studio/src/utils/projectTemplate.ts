import { writeFileToDir } from './fileAccess'

const README_TEMPLATE = `# {projectName}

An [ADV.JS](https://advjs.org) visual novel project.

## Structure

\`\`\`
adv/
├── world.md          # 世界观设定
├── outline.md        # 故事大纲
├── chapters/         # 章节文件
│   └── 01.adv.md     # 第一章
└── characters/       # 角色设定（可选）
\`\`\`

## Getting Started

Edit files in \`adv/\` to create your story. Use [AdvScript](https://advjs.org/guide/advscript/) syntax in \`.adv.md\` files.

## Preview

Run with ADV.JS CLI:

\`\`\`bash
npx advjs dev
\`\`\`
`

const WORLD_TEMPLATE = `# 世界观设定

## 背景

> 在这里描述你的故事世界观。

## 角色

### 主角

- **名字**：待定
- **性格**：待定
- **背景**：待定

### 配角

（在此添加更多角色）
`

const OUTLINE_TEMPLATE = `# 故事大纲

## 概要

一句话概括你的故事。

## 章节规划

### 第一章：开端

- 场景：待定
- 主要事件：待定
- 情感基调：待定

### 第二章：发展

- 场景：待定
- 主要事件：待定
- 情感基调：待定

### 第三章：高潮

- 场景：待定
- 主要事件：待定
- 情感基调：待定
`

const CHAPTER_TEMPLATE = `---
scene: classroom
background: classroom.png
---

> 清晨的阳光透过教室的窗户洒落进来。

@主角
今天开始，一切都将不同。

---

> 走廊里传来脚步声。

@配角
早上好！你来得真早。

@主角
嗯，我有些事情想提前准备。

---

> 两人相视一笑，新的故事就此展开。
`

/**
 * Create a new ADV.JS project from template.
 *
 * @param parentDir - Parent directory handle where the project folder will be created
 * @param projectName - Name of the project (used as folder name)
 * @returns The created project directory handle
 */
export async function createProjectFromTemplate(
  parentDir: FileSystemDirectoryHandle,
  projectName: string,
): Promise<FileSystemDirectoryHandle> {
  const projectDir = await parentDir.getDirectoryHandle(projectName, { create: true })
  await writeFileToDir(projectDir, 'README.md', README_TEMPLATE.replace('{projectName}', projectName))
  await writeFileToDir(projectDir, 'adv/world.md', WORLD_TEMPLATE)
  await writeFileToDir(projectDir, 'adv/outline.md', OUTLINE_TEMPLATE)
  await writeFileToDir(projectDir, 'adv/chapters/01.adv.md', CHAPTER_TEMPLATE)
  return projectDir
}
