export function useInspectorOnlineFile() {
  const fileStore = useFileStore()

  const icon = ref('i-vscode-icons:file-type-json')

  const name = computed(() => {
    return fileStore.onlineAdvConfigFileUrl.split('/').pop()
  })
  const language = computed(() => {
    return name.value?.endsWith('.json') ? 'json' : 'text'
  })

  return {
    name,
    icon,
    language,
  }
}
