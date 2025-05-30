export function useInspectorOnlineFile() {
  const onlineStore = useOnlineStore()

  const icon = ref('i-vscode-icons:file-type-json')

  const name = computed(() => {
    const url = new URL(onlineStore.onlineAdvConfigFileUrl)
    const path = url.pathname
    return path.split('/').pop() || ''
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
