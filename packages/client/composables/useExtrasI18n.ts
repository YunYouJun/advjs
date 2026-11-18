import { useI18n } from 'vue-i18n'

// Local messages work in both the standalone player and the Editor's i18n host.
const messages = {
  'en': {
    extras: {
      title: 'Extras',
      back: '← Back to title',
      tabs: 'Extras sections',
      endings: 'Endings',
      achievements: 'Achievements',
      replays: 'Scene replay',
      music: 'Music room',
      route: 'Route chart',
      gallery: 'CG gallery',
      found: '{count} / {total}',
      locked: 'Not found yet',
      lockedHint: 'No hint',
      replayLocked: 'Reach this scene to replay it',
      replayAction: 'Replay',
      replayNote: 'Replays never change saves or progress.',
      unheard: '???',
      play: 'Play',
      stop: 'Stop',
      nowPlaying: 'Now playing',
      empty: 'Nothing here yet.',
    },
    replay: {
      label: 'Replay',
      loading: 'Loading replay…',
      exit: 'End replay',
      finished: 'Replay finished',
      back: 'Back to extras',
      unavailable: 'This scene is not available for replay yet.',
    },
    toast: {
      achievement: 'Achievement unlocked',
      dismiss: 'Dismiss',
    },
    route: {
      visited: '{count} / {total} reached',
      empty: 'Start a story to reveal the route.',
      horizontal: 'Horizontal layout',
      vertical: 'Vertical layout',
    },
  },
  'zh-CN': {
    extras: {
      title: '附录',
      back: '← 返回标题',
      tabs: '附录分类',
      endings: '结局',
      achievements: '成就',
      replays: '回想',
      music: '音乐鉴赏',
      route: '路线图',
      gallery: 'CG 回廊',
      found: '{count} / {total}',
      locked: '尚未达成',
      lockedHint: '暂无提示',
      replayLocked: '抵达该场景后可回想',
      replayAction: '回想',
      replayNote: '回想不会改变存档与进度。',
      unheard: '？？？',
      play: '播放',
      stop: '停止',
      nowPlaying: '正在播放',
      empty: '暂时还没有内容。',
    },
    replay: {
      label: '回想',
      loading: '正在载入回想…',
      exit: '结束回想',
      finished: '回想结束',
      back: '返回附录',
      unavailable: '该场景暂时无法回想。',
    },
    toast: {
      achievement: '成就达成',
      dismiss: '关闭',
    },
    route: {
      visited: '已抵达 {count} / {total}',
      empty: '开始游戏后，这里会逐步显示路线。',
      horizontal: '横向布局',
      vertical: '纵向布局',
    },
  },
}

/** Extras screens inherit the host locale without requiring Editor-specific keys. */
export function useExtrasI18n() {
  return useI18n({ useScope: 'local', messages })
}
