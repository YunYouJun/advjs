# {{projectName}}

> 基于 [ADV.JS](https://advjs.org) 的节点流程图游戏工程

## 简介

本项目使用可视化节点流程图模式，以 JSON 描述剧情节点与分支跳转关系。

## 文件结构

```
├── adv.config.json   # 项目配置
├── index.adv.json    # 游戏入口（节点定义）
└── README.md         # 本文件
```

## 快速开始

在编辑器中打开本目录，通过可视化节点编辑器管理剧情流程。

## 节点格式

```json
{
  "id": "node_start",
  "dialogues": [{ "speaker": "旁白", "text": "..." }],
  "choices": [
    { "text": "选项A", "nextNodeId": "node_a" }
  ]
}
```

## 参考

- [ADV.JS 文档](https://advjs.org)
