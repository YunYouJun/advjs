/**
 * Features that aren't finished, in one place for the whole docs site. Finished features have no
 * entry and get no tag. Render a tag with `<FeatureStatus id="…" />` (registered globally).
 *
 * - `preview`: usable now; behaviour or API may still change. Fine on the home page, product
 *   pages and docs.
 * - `unreleased`: in the repository but not in the published npm packages or app release yet.
 *   Fine anywhere; give `target` when the release it ships in is known.
 * - `planned`: not built. Roadmap pages only: never shown or demoed as a feature on the home page.
 *
 * Statuses are checked against what is actually published (npm `latest`, GitHub releases, live
 * sites), not against the docs alone. Record the evidence in `note` and the date in `checked`.
 * Last full pass: 2026-10-22, against npm 0.1.4 (published 2026-10-12) and GitHub release v0.1.4.
 */
export type FeatureStatusKind = 'preview' | 'unreleased' | 'planned'

export interface Localized {
  zh: string
  en: string
}

export interface FeatureStatusEntry {
  status: FeatureStatusKind
  /** The feature's name. */
  label: Localized
  /** What is and isn't there yet, and how we know. Shown as the tag's tooltip. */
  note?: Localized
  /** Where the detail lives. */
  docs?: string
  /** First version it shipped in (for `preview`). */
  since?: string
  /** The release it is expected in, when known (for `unreleased` / `planned`). */
  target?: string
  /** When this entry was last checked, `YYYY-MM-DD`. */
  checked: string
}

export const statusText: Record<FeatureStatusKind, Localized> = {
  preview: { zh: '预览', en: 'Preview' },
  unreleased: { zh: '未发布', en: 'Unreleased' },
  planned: { zh: '规划中', en: 'Planned' },
}

export const featureStatus: Record<string, FeatureStatusEntry> = {
  // Engine and plugins

  'three': {
    status: 'unreleased',
    label: { zh: 'Three.js 场景与实体绑定', en: 'Three.js scenes and entity binding' },
    note: {
      zh: '`createThreeEntityRegistry` 等接口只在仓库里；npm 上的 @advjs/plugin-three@0.0.1 只有 README，没有代码。',
      en: '`createThreeEntityRegistry` and friends exist only in the repository; @advjs/plugin-three@0.0.1 on npm contains only a README.',
    },
    docs: '/guide/runtime/three',
    checked: '2026-10-22',
  },
  'qwen-tts': {
    status: 'unreleased',
    label: { zh: 'Qwen TTS 插件', en: 'Qwen TTS plugin' },
    note: {
      zh: '@advjs/plugin-qwen-tts 在仓库里（0.1.0），还没有发布到 npm。',
      en: '@advjs/plugin-qwen-tts is in the repository (0.1.0) but not on npm yet.',
    },
    docs: '/guide/authoring-voice',
    checked: '2026-10-22',
  },
  'adv-theme': {
    status: 'unreleased',
    label: { zh: 'adv theme 命令与 adv-theme Skill', en: 'The adv theme command and adv-theme Skill' },
    note: {
      zh: '仓库里的 CLI 有 `adv theme`；npm 上的 advjs@0.1.4 没有这个命令，也不带 adv-theme Skill。',
      en: 'The CLI in the repository has `adv theme`; advjs@0.1.4 on npm has neither the command nor the adv-theme Skill.',
    },
    checked: '2026-10-22',
  },

  // Products

  'editor-desktop': {
    status: 'unreleased',
    label: { zh: 'Editor 桌面客户端', en: 'Editor desktop client' },
    note: {
      zh: '打包流程在仓库里（apps/desktop 0.1.5）；GitHub Release v0.1.4 还没有附带客户端安装包。',
      en: 'The packaging pipeline is in the repository (apps/desktop 0.1.5); GitHub release v0.1.4 has no client builds attached yet.',
    },
    docs: '/guide/editor/desktop',
    checked: '2026-10-22',
  },
  'studio': {
    status: 'preview',
    label: { zh: 'ADV.JS Studio', en: 'ADV.JS Studio' },
    note: {
      zh: 'studio.advjs.org 已上线；公共 AI 积分计费、跨设备同步和完整的移动端 Agent 流程不在首发范围内。',
      en: 'Live at studio.advjs.org; public AI credit billing, cross-device sync and the full mobile agent flow are outside the first release.',
    },
    docs: '/about/launch-known-limitations',
    checked: '2026-10-22',
  },
  'studio-ai': {
    status: 'preview',
    label: { zh: 'Studio 托管 AI', en: 'Studio managed AI' },
    note: {
      zh: '剧情大纲、章节草稿、情节建议、角色扮演模拟和一致性检查已对登录的云乐坊账号开放；计费倍率尚未正式生效，聊天、日记、图片和云端 TTS 未开放。',
      en: 'Outlines, chapter drafts, plot suggestions, role-play simulation and consistency checks are open to signed-in Yunle accounts; the pricing policy is not final, and chat, diaries, images and cloud TTS are not open.',
    },
    docs: '/guide/studio/ai-service',
    checked: '2026-10-22',
  },
  'studio-ios': {
    status: 'unreleased',
    label: { zh: 'Studio iPhone／iPad 原生 App', en: 'Native Studio app for iPhone and iPad' },
    note: {
      zh: 'apps/studio-ios 的 P0 只在模拟器上验收过，尚未上架 App Store。',
      en: 'The P0 in apps/studio-ios has only been accepted on simulators; it is not in the App Store.',
    },
    docs: '/reports/studio-native-ios-acceptance',
    checked: '2026-10-22',
  },

  // Planned: roadmap pages only

  'skip-read': {
    status: 'planned',
    label: { zh: '只快进已读、标记已选选项', en: 'Skip read text only; mark taken choices' },
    note: { zh: '运行时已记录已读节点，客户端的快进还不区分已读未读。', en: 'The runtime records read nodes; the client\'s skip ignores them.' },
    docs: '/guide/runtime/navigation-and-saves',
    checked: '2026-10-22',
  },
  'controls': {
    status: 'planned',
    label: { zh: '完整快捷键与手柄', en: 'Full keyboard and gamepad controls' },
    note: { zh: '目前只绑定空格、A 与 Ctrl。', en: 'Only Space, A and Ctrl are bound today.' },
    checked: '2026-10-22',
  },
  'endings': {
    status: 'planned',
    label: { zh: '结局列表与成就', en: 'Endings list and achievements' },
    note: { zh: '跨周目进度能保存数据，还没有给玩家看的界面。', en: 'Progression can store the data; there is no player-facing screen.' },
    docs: '/guide/runtime/meta-progression',
    checked: '2026-10-22',
  },
  'replay': {
    status: 'planned',
    label: { zh: '场景回想与音乐鉴赏', en: 'Scene replay and music room' },
    checked: '2026-10-22',
  },
  'route-map': {
    status: 'planned',
    label: { zh: '玩家路线图', en: 'Route map for players' },
    note: { zh: '客户端的 AdvFlowChart 还是占位数据。', en: 'The client\'s AdvFlowChart still renders placeholder data.' },
    checked: '2026-10-22',
  },
  'ruby': {
    status: 'planned',
    label: { zh: '注音与行内文字效果', en: 'Ruby text and inline text effects' },
    checked: '2026-10-22',
  },
  'camera': {
    status: 'planned',
    label: { zh: '镜头震动、缩放与天气粒子', en: 'Camera shake, zoom and weather particles' },
    checked: '2026-10-22',
  },
  'video': {
    status: 'planned',
    label: { zh: '视频播放', en: 'Video playback' },
    checked: '2026-10-22',
  },
  'nvl': {
    status: 'planned',
    label: { zh: 'NVL 全屏文字模式', en: 'NVL full-screen text' },
    checked: '2026-10-22',
  },
  'timed-choices': {
    status: 'planned',
    label: { zh: '限时选项与名字输入', en: 'Timed choices and name entry' },
    note: { zh: '现在可以先用宿主活动实现。', en: 'Build them as host activities for now.' },
    docs: '/guide/runtime/plugins-and-activities',
    checked: '2026-10-22',
  },
  'live2d': {
    status: 'planned',
    label: { zh: 'Live2D / Spine 立绘与口型同步', en: 'Live2D / Spine sprites and lip sync' },
    checked: '2026-10-22',
  },
}
