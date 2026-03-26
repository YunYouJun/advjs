/**
 * 通用飞书多维表格 CRUD composable
 *
 * 封装对 /api/feishu/bitable/records 的调用
 */
export function useFeishuBitable<T extends Record<string, any>>(tableId: string, appToken?: string) {
  const loading = ref(false)
  const error = ref<string | null>(null)

  const buildParams = (extra?: Record<string, any>) => ({
    table_id: tableId,
    ...(appToken ? { app_token: appToken } : {}),
    ...extra,
  })

  /**
   * 获取记录列表
   */
  async function list(options?: { pageSize?: number, pageToken?: string }) {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch('/api/feishu/bitable/records', {
        method: 'GET',
        params: buildParams({
          page_size: options?.pageSize,
          page_token: options?.pageToken,
        }),
      })
      return data as {
        records: T[]
        total: number
        hasMore: boolean
        pageToken?: string
      }
    }
    catch (e: any) {
      error.value = e.message || 'Failed to fetch records'
      throw e
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 获取单条记录
   */
  async function get(recordId: string) {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch('/api/feishu/bitable/records', {
        method: 'GET',
        params: buildParams({ record_id: recordId }),
      })
      return (data as any).record as T
    }
    catch (e: any) {
      error.value = e.message || 'Failed to fetch record'
      throw e
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 创建记录
   */
  async function create(fields: Partial<T>) {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch('/api/feishu/bitable/records', {
        method: 'POST',
        body: {
          ...buildParams(),
          fields,
        },
      })
      return data as { record_id: string, fields: Record<string, any> }
    }
    catch (e: any) {
      error.value = e.message || 'Failed to create record'
      throw e
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 更新记录
   */
  async function update(recordId: string, fields: Partial<T>) {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch('/api/feishu/bitable/records', {
        method: 'PUT',
        body: {
          ...buildParams(),
          record_id: recordId,
          fields,
        },
      })
      return data as { record_id: string, fields: Record<string, any> }
    }
    catch (e: any) {
      error.value = e.message || 'Failed to update record'
      throw e
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 删除记录
   */
  async function remove(recordId: string) {
    loading.value = true
    error.value = null
    try {
      await $fetch('/api/feishu/bitable/records', {
        method: 'DELETE',
        body: {
          ...buildParams(),
          record_id: recordId,
        },
      })
      return true
    }
    catch (e: any) {
      error.value = e.message || 'Failed to delete record'
      throw e
    }
    finally {
      loading.value = false
    }
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    list,
    get,
    create,
    update,
    remove,
  }
}
