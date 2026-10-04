# 角色管理系统

ADV.JS 以项目内的 `.character.md` 作为角色的规范来源。人物身份、外貌、性格、关系与视觉约束随 Git 版本管理，游戏和创作工具读取同一份卡片。飞书或 CMS 可作为协作入口，接入时仍需转换、校验并写回这份标准；不在外部系统另建一套人物协议。

## 共享边界

| 层 | 职责 |
| --- | --- |
| `@advjs/types` | `AdvCharacter`、`AdvCharacterVisual`、关系与属性的 TypeScript 定义 |
| `@advjs/parser` | Markdown 解析、序列化、Zod schema 和 AI 导出 |
| `@advjs/character` | 对外复用入口，重导出以上角色 API，校验重复 ID 和关系目标 |
| `@advjs/core` | 编译项目时诊断视觉字段格式错误 |
| Editor | 人物卡、源码编辑、视觉约束与项目参考图预览 |
| MCP | 创建、批量创建和编辑人物卡时使用同一个视觉 schema |
| 游戏仓库 | 具体人物、世界规则、图片、设计版本与内容审批记录 |

其他项目可以使用 `parseCharacterCatalog` / `createCharacterCatalog`，无需依赖整个编辑器。正式字段变更从 types 和 schema 开始，不能只在游戏提示词或表单中增加约定。

## 人物卡的四个部分

- 身份与关系：`id`、`name`、`aliases`、`faction`、`relationships`。
- 故事设定：正文的外貌、性格、背景、理念、说话风格，以及 `attributes` 下的通用或题材属性。
- 视觉身份：`visual` 保存造型版本、参考图、固定特征与允许变化；`imagePrompt` 补充风格和绘制描述。
- 运行时显示：`avatar` 用作头像，`tachies` 用作立绘和表情。作者用多人参考图不自动成为头像或立绘。

好感、生命值和本轮事件等运行时状态不应回写进静态视觉版本。三国、奇幻或校园等题材共用这些结构，各自的人物能力与剧情限制留在游戏内容中。

## 视觉身份协议

`visual` 是可选字段，旧卡无需迁移。提供时必须填写非空 `version`；`references`、`fixedTraits`、`allowedChanges` 都是可选数组。参考项包含 `path` 与可选 `description`，后者可描述多人图中的对应区域。

`path` 相对于包含 `adv.config.json` 的项目根目录，即使内容根目录改成 `story/`，路径基准也不变。使用 `/` 分隔，不允许绝对路径、URL、父目录跳转或编码分隔符。schema 和项目编译校验结构；源码映射可能不包含二进制文件，因此编译器不据此判断图片缺失。编辑器通过工作区实际读取图片，失败时保留路径并显示错误。

版本表示人物设计修订，不表示已审批或历史考证结论。改变脸型、须型、体格或核心衣装等固定特征时创建新版本并保留旧图；审批状态由项目内容流程管理。

## 编辑器与 AI

在项目文件树打开 `.character.md`，可在「视觉设定」和「编辑源码」之间切换。视觉面板与人物详情共用 `CharacterVisualPanel`；图片通过当前工作区读取，切换项目或卸载时释放临时 URL。编辑 `visual` 目前使用源码或 MCP，人物表单保存时保留这些字段。

`exportCharacterForAI` 会包含视觉约束；`exportCharacterVisualForAI` 单独导出绘图说明。完整作者上下文保留人物卡源码。导出参考图路径不等于附上图像：生成工作流必须实际读取并把图片交给模型；此功能不自动调用生图服务。

MCP 的 `create_character`、`create_characters` 接受可选 `visual`。`edit_character` 省略该字段时保留原值，提供对象时整体替换，传 `null` 时删除。这样能明确区分「不修改」与「清除」。

详细字段和示例见[角色管理指南](/guide/editor/character)。
