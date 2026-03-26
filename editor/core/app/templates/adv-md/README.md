# {{projectName}}

> 基于 [ADV.JS](https://advjs.org) 的 Markdown 文字冒险游戏工程

## 简介

本项目使用 `.adv.md` 脚本格式编写，适合 AI 辅助创作。

## 文件结构

```bash
├── adv.config.json              # 项目配置（root 指向 adv/）
│
├── public/                      # 静态资源（直接 serve）
│   └── favicon.svg              # 游戏图标
│
├── adv/                         # 游戏内容根目录
│   ├── index.adv.json           # 游戏入口
│   ├── chapters/                # 剧本脚本（按章节拆分）
│   │   └── 1.chapter.md        # 第一章
│   ├── characters/              # 角色卡片库
│   │   ├── aria.character.md    # 角色 Aria
│   │   └── kai.character.md     # 角色 Kai
│   ├── scenes/                  # 场景定义
│   ├── assets/                  # 游戏资源
│   │   └── bgm/                 # 背景音乐
│   └── settings/                # 游戏全局设置
│       └── game.json
│
└── README.md                    # 本文件
```

## 快速开始

在编辑器中打开本目录，即可开始编写剧情。

## 脚本格式

```md
# 第一章

> 旁白内容

@角色名
对话内容

- [ ] 选项A
- [ ] 选项B
```

## 角色卡片

角色卡片存放在 `adv/characters/` 目录下，每个角色对应一个 `.character.md` 文件。

文件头部使用 YAML frontmatter 定义角色的基本属性（ID、名称、立绘、关系等），正文用 Markdown 描述角色详情，便于 AI 理解和生成内容。

## 参考

- [ADV.JS 文档](https://advjs.org)
