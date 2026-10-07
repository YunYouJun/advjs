export function useInspectorOnlineFile() {
  const onlineStore = useOnlineStore()

  const icon = ref('i-vscode-icons:file-type-json')

  const name = computed(() => {
    const value = onlineStore.onlineAdvConfigFileUrl
    if (!value)
      return ''

    try {
      const url = new URL(value)
      return url.pathname.split('/').pop() || ''
    }
    catch {
      return ''
    }
  })

  const language = computed<MonacoEditorLanguage>(() => {
    return name.value?.endsWith('.json') ? 'json' : 'plaintext'
  })

  return {
    name,
    icon,
    language,
  }
}
