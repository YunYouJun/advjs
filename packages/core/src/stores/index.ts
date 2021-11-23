export const createAdvStore = () => {
  /**
   * 顺序
   */
  const order = ref(0)

  /**
   * 当前对话
   */
  const dialog = ref({
    character: {
      name: '',
      status: 'default',
    },
    children: [{
      type: 'text',
      value: '',
    }],
  })

  return {
    /**
     * 当前
     */
    cur: {
      order,
      /**
       * 会话
       */
      dialog,
    },
  }
}
