import { onBeforeMount } from 'vue'

/**
 * 关闭页面前提示
 */
export const useBeforeUnload = () => {
  onBeforeMount(() => {
    window.onbeforeunload = () => {
      return '关闭提示'
    }
  })
}
