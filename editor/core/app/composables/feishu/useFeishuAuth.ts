/**
 * 飞书授权状态管理 composable
 *
 * 提供飞书 OAuth 登录状态检查、授权 URL、登出、表格列表等功能
 */
export function useFeishuAuth() {
  const { user, session, clear: logout } = useUserSession()

  const feishuUser = computed(() => user.value?.feishu)
  const isFeishuAuthed = computed(() => !!feishuUser.value)

  const loginUrl = '/api/auth/feishu'

  /**
   * 列出用户可访问的多维表格数据表
   */
  async function listTables(appToken: string) {
    const data = await $fetch('/api/feishu/bitable/apps', {
      params: { app_token: appToken },
    })
    return data as {
      tables: Array<{
        table_id: string
        name: string
        revision: number
      }>
    }
  }

  return {
    feishuUser,
    isFeishuAuthed,
    loginUrl,
    session,
    logout,
    listTables,
  }
}
