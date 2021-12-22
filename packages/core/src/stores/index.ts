import type { AdvRoot } from '@advjs/types'

export const createAdvStore = () => {
  /**
   * 语法树
   */
  const ast = ref<AdvRoot>()

  /**
   * 顺序
   */
  const order = ref(0)
  const node = computed(() => ast.value && ast.value.children[order.value])

  /**
   * 当前对话
   */
  const dialog = ref({
    character: {
      name: '',
      status: '',
    },
    children: [{
      type: 'text',
      value: '',
    }],
  })

  return {
    ast,

    /**
     * 当前
     */
    cur: {
      node,
      order,
      /**
       * 会话
       */
      dialog,
    },
  }
}
