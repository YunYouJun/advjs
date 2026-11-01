/**
 * What a visual novel engine is expected to do and ADV.JS already does, for the home page's
 * capability index:
 * - `shown`: plays in this page's own demos, on the real runtime;
 * - `engine`: in ADV.JS but not shown here.
 * Unbuilt features don't belong on the home page: they live as `planned` in
 * `../../../data/feature-status.ts`, for roadmap pages. A partly finished feature names its
 * entry there in `feature`, which tags it (preview / unreleased).
 * Names live in `copy.ts` under `capabilities.items`, keyed by id. Links go to the guide (Chinese
 * only for now) or, where the guide has no page yet, to the source on GitHub.
 */
export type CapabilityStatus = 'shown' | 'engine'

export interface Capability {
  id: string
  status: CapabilityStatus
  href: string
  /** Id in `feature-status.ts` when the feature isn't finished. */
  feature?: string
}

const SOURCE = 'https://github.com/YunYouJun/advjs/blob/dev/'

export const capabilities: Capability[] = [
  // Shown on this page
  { id: 'syntax', status: 'shown', href: '/guide/advscript/syntax' },
  { id: 'jumps', status: 'shown', href: '/guide/runtime/navigation-and-saves#稳定节点与精确跳转' },
  { id: 'chapters', status: 'shown', href: '/guide/project-structure#adv-chapters' },
  { id: 'conditions', status: 'shown', href: '/guide/runtime/conditions-and-actions#条件' },
  { id: 'choiceActions', status: 'shown', href: '/guide/runtime/conditions-and-actions#条件选择与选择动作' },
  { id: 'snapshots', status: 'shown', href: '/guide/runtime/navigation-and-saves#snapshot-与-checkpoint' },
  { id: 'backlog', status: 'shown', href: `${SOURCE}packages/client/composables/useAdvAuto.ts` },
  { id: 'transitions', status: 'shown', href: '/guide/runtime/presentation#场景转场' },
  { id: 'hostUi', status: 'shown', href: '/guide/runtime/embedding#对接游戏规则与对白-ui' },
  { id: 'program', status: 'shown', href: '/guide/runtime/embedding#编译与运行分开' },

  // In the engine, not shown here
  { id: 'tachie', status: 'engine', href: '/guide/runtime/presentation#立绘调度与逐帧动画' },
  { id: 'cg', status: 'engine', href: '/guide/runtime/presentation#cg-与跨周目画廊' },
  { id: 'audio', status: 'engine', href: '/guide/audio#mixer' },
  { id: 'voice', status: 'engine', href: '/guide/audio#对白配音绑定' },
  { id: 'saveSlots', status: 'engine', href: '/guide/runtime/navigation-and-saves#浏览器存档槽位' },
  { id: 'progression', status: 'engine', href: '/guide/runtime/meta-progression' },
  { id: 'glossary', status: 'engine', href: '/guide/advscript/glossary' },
  { id: 'richText', status: 'engine', href: '/guide/features#富文本' },
  { id: 'settings', status: 'engine', href: '/guide/runtime/presentation#自定义设置界面' },
  { id: 'skip', status: 'engine', href: `${SOURCE}packages/client/composables/useAdvKeys.ts` },
  { id: 'themes', status: 'engine', href: '/guide/customization/start-screen' },
  { id: 'activities', status: 'engine', href: '/guide/runtime/plugins-and-activities' },
  { id: 'embedding', status: 'engine', href: '/guide/runtime/embedding' },
  { id: 'three', status: 'engine', href: '/guide/runtime/three', feature: 'three' },
  { id: 'check', status: 'engine', href: '/guide/runtime/static-diagnostics' },
  { id: 'devtools', status: 'engine', href: '/guide/runtime/devtools' },

]
