import { useI18n } from 'vue-i18n'

// Local messages work in both the standalone player and the Editor's i18n host.
const messages = {
  'en': {
    controls: {
      label: 'Playback controls',
      history: 'History',
      auto: 'Auto',
      skip: 'Skip',
      save: 'Save',
      load: 'Load',
      hide: 'Hide UI',
      more: 'Menu',
      settings: 'Settings',
      mute: 'Mute music',
      unmute: 'Unmute music',
      hideCharacters: 'Hide characters',
      showCharacters: 'Show characters',
      gallery: 'Gallery',
      rotate: 'Rotate screen',
      fullscreen: 'Full screen',
      exitFullscreen: 'Exit full screen',
      restore: 'Show dialogue',
      quickSave: 'Quick save',
      quickLoad: 'Quick load',
      quickSaved: 'Quick save created',
      quickLoaded: 'Quick save loaded',
      quickEmpty: 'No quick save yet',
      quickSaveFailed: 'Quick save failed',
      quickLoadFailed: 'Quick load failed',
    },
  },
  'zh-CN': {
    controls: {
      label: '剧情播放操作',
      history: '回看',
      auto: '自动',
      skip: '快进',
      save: '存档',
      load: '读档',
      hide: '隐藏',
      more: '菜单',
      settings: '设置',
      mute: '关闭音乐',
      unmute: '开启音乐',
      hideCharacters: '隐藏立绘',
      showCharacters: '显示立绘',
      gallery: '画廊',
      rotate: '旋转画面',
      fullscreen: '全屏',
      exitFullscreen: '退出全屏',
      restore: '显示对话',
      quickSave: '快速存档',
      quickLoad: '快速读档',
      quickSaved: '已快速存档',
      quickLoaded: '已加载快速存档',
      quickEmpty: '暂无快速存档',
      quickSaveFailed: '快速存档失败',
      quickLoadFailed: '快速读档失败',
    },
  },
}

/** Player controls inherit the host locale without requiring Editor-specific keys. */
export function useGameControlsI18n() {
  return useI18n({ useScope: 'local', messages })
}
