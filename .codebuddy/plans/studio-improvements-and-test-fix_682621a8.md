---
name: studio-improvements-and-test-fix
overview: 修复三个改进项：1) MessageActions.vue 中 aria-label 硬编码英文改为 i18n；2) useProjectContent.ts 中 catch 块统一 push loadErrors；3) 修复 embeddingClient.test.ts 中 contentHash 测试用例。
todos:
  - id: fix-i18n-and-locales
    content: MessageActions.vue 第96/109行 aria-label 改用 t() 并在 en.json/zh-CN.json 新增 goodResponse、badResponse 翻译
    status: completed
  - id: unify-load-errors
    content: useProjectContent.ts 中 loadFromDir 和 loadFromCos 共6处 catch 块统一补充 loadErrors.value.push(msg)
    status: completed
  - id: fix-tests
    content: 修复 embeddingClient.test.ts contentHash 测试匹配 FNV-1a 实现，修复 projectValidation.test.ts makeChapter 字段名
    status: completed
  - id: run-tests
    content: 运行全部 studio 测试确认 171 个用例全部通过
    status: completed
    dependencies:
      - fix-i18n-and-locales
      - unify-load-errors
      - fix-tests
---

## 用户需求

对 advjs studio 应用进行两项代码质量改进，并修复一个失败的单元测试。

## 核心功能

### 1. MessageActions.vue aria-label 国际化

- 第 96 行 `aria-label="Good response"` 和第 109 行 `aria-label="Bad response"` 硬编码英文
- 组件已引入 `useI18n()` 且其他按钮已使用 `t()` 函数
- 需要在 en.json 和 zh-CN.json 的 `chat` 命名空间下新增对应翻译 key，并替换硬编码字符串

### 2. useProjectContent.ts 错误收集统一化

- `loadFromDir` 方法中场景(第190行)、位置(第223行)、音频(第255行)的 catch 块只有 `console.warn`，缺少 `loadErrors.value.push(msg)`
- `loadFromCos` 方法中也存在相同问题：场景(第373行)、位置(第402行)、音频(第431行)
- 需要统一补充 `loadErrors.value.push(msg)`，与章节和角色的 catch 块保持一致模式

### 3. 修复失败测试 embeddingClient.test.ts

- `contentHash` 函数已从返回字符串长度改为 FNV-1a 32位哈希，但测试仍期望旧行为（如 `contentHash('hello') === 5`）
- 需要更新测试用例，验证 FNV-1a 哈希的正确行为（返回数字、确定性、空字符串返回 offset basis 值）
- 同时修复 `projectValidation.test.ts` 中 `makeChapter` 辅助函数使用了不存在的 `title` 字段（应为 `name` 和 `preview`）

## 技术栈

- 框架: Vue 3 + TypeScript + Ionic
- 国际化: vue-i18n（已有 en.json / zh-CN.json 两个 locale 文件）
- 测试: Vitest
- 包管理: pnpm monorepo

## 实现方案

### 1. aria-label i18n 化

在 `en.json` 和 `zh-CN.json` 的 `chat` 对象中新增两个 key：

- `chat.goodResponse` / `chat.badResponse`

在 `MessageActions.vue` 中将第 96、109 行的硬编码字符串替换为 `t('chat.goodResponse')` 和 `t('chat.badResponse')`，与同文件中其他 aria-label 的模式完全一致。

### 2. useProjectContent.ts 错误收集统一

在 `loadFromDir` 和 `loadFromCos` 两个方法中，将场景、位置、音频的 catch 块统一改为先构造 `msg` 变量，再同时执行 `console.warn(msg)` 和 `loadErrors.value.push(msg)`。参照同文件中章节(第134-138行)和角色(第159-163行)的 catch 块模式：

```typescript
catch (err) {
  const msg = `Failed to parse scene ${file}: ${err instanceof Error ? err.message : String(err)}`
  console.warn(msg)
  loadErrors.value.push(msg)
}
```

共 6 处 catch 块需要修改（loadFromDir 3 处 + loadFromCos 3 处）。

### 3. 修复 embeddingClient.test.ts

`contentHash` 已改为 FNV-1a 哈希，测试需同步更新：

- 空字符串返回 FNV offset basis `2166136261`
- `contentHash('hello')` 返回确定性的 32 位无符号整数
- 相同输入返回相同结果（确定性）
- 不同输入返回不同结果（区分度）
- 返回类型为 number

### 4. 修复 projectValidation.test.ts 类型问题

`makeChapter` 辅助函数使用了不存在的 `title` 字段，应改为 `name` 和 `preview` 以匹配 `ChapterInfo` 接口定义 `{ file, name, preview, content? }`。

## 实现注意事项

- **向后兼容**: 所有修改都是 bug 修复和改进级别，不改变公开 API
- **i18n key 命名**: 遵循已有的 `chat.xxxMessage` / `chat.xxx` 命名约定
- **catch 块模式**: 严格遵循已有的 `const msg = ...; console.warn(msg); loadErrors.value.push(msg)` 三行模式，保持代码风格一致
- **测试修复**: 不修改源代码实现，只更新测试期望值以匹配当前实际行为

## 目录结构

```
apps/studio/src/
├── components/
│   └── MessageActions.vue              # [MODIFY] 第96/109行 aria-label 改用 t() 函数
├── composables/
│   └── useProjectContent.ts            # [MODIFY] 6处 catch 块补充 loadErrors.value.push(msg)
├── i18n/locales/
│   ├── en.json                         # [MODIFY] chat 对象新增 goodResponse、badResponse
│   └── zh-CN.json                      # [MODIFY] chat 对象新增 goodResponse、badResponse 中文翻译
└── __tests__/
    ├── embeddingClient.test.ts          # [MODIFY] 更新 contentHash 测试用例匹配 FNV-1a 实现
    └── projectValidation.test.ts        # [MODIFY] 修复 makeChapter 辅助函数字段名
```

## Agent Extensions

### MCP

- **advjs**
- Purpose: 修改完成后使用 `adv_validate` 工具验证项目完整性，确保改动未引入回归
- Expected outcome: 项目验证通过，无新增错误