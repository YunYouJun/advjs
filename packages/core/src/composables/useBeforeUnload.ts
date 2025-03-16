import { onBeforeMount } from 'vue'

/**
 * 关闭页面前提示
 */
export function useBeforeUnload() {
  onBeforeMount(() => {
    window.onbeforeunload = () => {
      return '关闭提示'
    }
  })
}
