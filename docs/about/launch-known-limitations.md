# 首发已知限制

本文随 RC source tree 固定，并由 release manifest 记录 SHA-256。人工验收不得把下列限制描述成已完成能力。

## 平台范围

- 浏览器正式支持范围只有 Chromium Stable；Firefox 与 Safari 尚未进入首发矩阵。
- Ubuntu 执行从 packed 安装到部署验证的完整 journey；macOS 与 Windows 执行 packed CLI、Editor 生命周期、typecheck 与 build smoke。
- 本地 Editor 只监听 `127.0.0.1`。首发不提供远程 bridge、多用户同时编辑或浏览器外网暴露。

## 产品范围

- `@advjs/editor` 是 PC 端本地/在线创作工具；`@advjs/studio` 是移动端/Web 端账号型 AI SaaS。Studio 的公共 AI 积分计费、跨设备团队同步和完整移动端 Agent 闭环不阻塞本地首发。
- Skills 首发自动安装器只固定支持 Codex、Claude Code 与 Cursor；其他兼容 Markdown 指令的 Agent 需要手动安装。
- required CI 会验证 packed Skill 安装、MCP 启动和确定性工具调用，但不会用生产模型凭据执行真实 Agent；固定一句话的 Agent 生成验收属于 L6-07 RC 人工/受控环境门禁。
- Firefox、Safari、原生桌面壳、应用商店分发和离线移动端模型不属于 P0。

## 部署与恢复

- 用户游戏使用独立的 Cloudflare Pages Direct Upload project；ADV.JS 官方 Editor/Studio 继续使用各自现有的 GitHub integration project，两者不能混用。
- 第一次用户部署需要交互式 Cloudflare 授权；非交互 CI 必须预先配置 Wrangler 凭据与明确 account ID。
- P0 恢复来源是本地 `.advjs/releases/<contentRevision>.tar.gz` 和对应 `.release.json`。CLI 支持校验后重部署，但不提供远端 archive 仓库、通用 `adv rollback` 或自定义域名原子切换。
- `.advjs/` 默认被 Git 忽略；需要长期审计时应把 archive、artifact receipt 与 deployment receipt 上传到受控 CI artifact 存储。

## 发布操作

- 同一时间只允许一个 RC/promotion 事务。真实 npm `rc`、`main`、Pages production、tag 和 GitHub Release 变更必须经过受保护 environment 人工批准。
- 不可逆点是正式 tag 或 GitHub Release 任一可见。此前可以按 manifest 整体恢复；此后只能保持锁并续跑同一 RC，不能回滚后换包。

## RC 人工试玩清单

验收者必须在同一个 RC SHA 和 Preview URL 上逐项完成，并把证据附入 release manifest：

- [ ] 使用默认 Skills 生成可运行项目，并记录 Skill revision 与生成后的项目 diff。
- [ ] 在本地 Editor 打开项目，修改角色或场景并保存；冲突提示与外部文件刷新行为符合预期。
- [ ] 在 Chromium Stable 完成从开始、选项分支、存档、读档到结局的试玩。
- [ ] 运行 `adv check --json` 与 `adv build --json`，确认输出 schema、contentRevision 和 build receipt 一致。
- [ ] 通过 `adv deploy` 创建 Cloudflare Preview，记录 deployment ID，并验证入口资源、MIME 与 SPA fallback。
- [ ] 在另一个空目录用同一 RC 包重复安装、构建和 archive 恢复部署。
- [ ] 签署验收者、时间、RC SHA、包 integrity、试玩 URL、覆盖场景和已知限制确认。
