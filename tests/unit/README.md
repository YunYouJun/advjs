# 单元测试

使用 [Vitest](https://vitest.dev) 验证产品行为、模块契约与回归。按功能模块放在一层目录中，文件名保留被测功能的名称，便于检索和单独运行。

| 目录        | 范围                                               |
| ----------- | -------------------------------------------------- |
| `assets/`   | 素材目录、创作命令与工作流                         |
| `cli/`      | ADV CLI、项目检查、分支覆盖率、部署与 Vite 集成    |
| `client/`   | 游戏播放器、客户端状态、运行时呈现、存档与主题交互 |
| `demo/`     | Starter、Hamster 示例项目与剧情契约                |
| `desktop/`  | 原生菜单、项目创建与镜像、预览窗口及桌面发布       |
| `devtools/` | 开发工具、JSON 展示、高亮与 Vite 插件              |
| `editor/`   | 编辑器工作区、创作、素材、预览、流程图与源码定位   |
| `gui/`      | AGUI 共享控件、导航与文件树                        |
| `mcp/`      | MCP 资源、工具、批量操作与工作区 App               |
| `parser/`   | 人物 Markdown 解析与场景结构校验                   |
| `runtime/`  | Core 运行时、编译、宿主兼容、项目读写与 Node 存储  |
| `tooling/`  | CI、发布、依赖安全、内容技能与工作区准备           |

运行全部单测：

```bash
pnpm vitest run tests/unit --reporter=default
```

运行一个模块或单个测试文件：

```bash
pnpm vitest run tests/unit/editor
pnpm vitest run tests/unit/runtime/core-runtime-entry.test.ts
```

默认使用 jsdom；依赖 Node 文件系统或进程的测试用 `@vitest-environment node` 标注。共享 helper 位于 `tests/helpers/`，固定输入位于 `tests/fixtures/`，快照跟随所属测试目录。端到端测试与发布安装验收分别位于 `tests/e2e/` 和 `tests/launch/`，独立运行。
