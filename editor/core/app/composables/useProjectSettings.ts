import type { AGUIPropertyItem } from '@advjs/gui'
import { LogLevels } from 'consola'

/**
 * get properties from the project settings
 */
export function useProjectSettings() {
  const projectStore = useProjectStore()
  projectStore.advConfig.runtimeConfig.canvasHeight = projectStore.advConfig.canvasWidth / projectStore.advConfig.aspectRatio

  watch(
    () => [
      projectStore.advConfig.canvasWidth,
      projectStore.advConfig.runtimeConfig.canvasHeight,
    ],
    () => {
      projectStore.advConfig.aspectRatio = projectStore.advConfig.canvasWidth / projectStore.advConfig.runtimeConfig.canvasHeight
    },
  )

  const commonProperties = ref<AGUIPropertyItem[]>([
    {
      type: 'select',
      name: '日志等级',
      object: projectStore.advConfig,
      key: 'logLevel',
      options: [
        {
          label: 'debug',
          value: LogLevels.debug,
        },
        {
          label: 'info',
          value: LogLevels.info,
        },
        {
          label: 'log',
          value: LogLevels.log,
        },
        {
          label: 'warn',
          value: LogLevels.warn,
        },
        {
          label: 'error',
          value: LogLevels.error,
        },
      ],
    },
    {
      type: 'select',
      name: '主题',
      object: projectStore.advConfig,
      key: 'theme',
      options: [
        {
          label: '默认',
          value: 'default',
        },
        {
          label: 'Pominis',
          value: 'pominis',
        },
      ],
    },
    {
      type: 'number',
      name: '宽高比',
      object: projectStore.advConfig,
      key: 'aspectRatio',
      disabled: true,
    },
    {
      type: 'number-field',
      name: '画布宽度',
      object: projectStore.advConfig,
      key: 'canvasWidth',
      step: 1,
      min: 0,
      max: 10000,
    },
    {
      type: 'number-field',
      name: '画布高度',
      object: projectStore.advConfig.runtimeConfig,
      key: 'canvasHeight',
      step: 1,
      min: 0,
      max: 10000,
    },
    {
      type: 'checkbox',
      name: '是否可选中文本',
      description: '是否允许用户选中游戏文本',
      object: projectStore.advConfig,
      key: 'selectable',
    },
  ])

  /**
   * cdn
   */
  const cdnProperties = ref<AGUIPropertyItem[]>([
    {
      type: 'checkbox',
      name: '是否启用',
      object: projectStore.advConfig.cdn,
      key: 'enable',
    },
    {
      type: 'input',
      name: 'CDN 资源路径前缀',
      object: projectStore.advConfig.cdn,
      key: 'prefix',
    },
  ])

  ;[commonProperties.value, cdnProperties.value].forEach((ps) => {
    ps.forEach((p) => {
      p.showKey = true
    })
  })

  const properties = computed(() => {
    switch (projectStore.curAdvConfigTab.name?.toLowerCase()) {
      case 'common':
        return commonProperties.value
      case 'cdn':
        return cdnProperties.value
      default:
        return []
    }
  })

  return {
    commonProperties,
    cdnProperties,

    properties,
  }
}
