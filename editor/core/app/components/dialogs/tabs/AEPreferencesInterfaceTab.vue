<script setup lang="ts">
const { t } = useI18n()
const { locale, changeLocale } = useEditorLocale()
const colorMode = useColorMode()

const localeOptions: Array<{ label: string, value: 'en' | 'zh-CN' }> = [
  { label: 'English', value: 'en' },
  { label: '中文（简体）', value: 'zh-CN' },
]

const localeState = reactive<{ language: 'en' | 'zh-CN' }>({
  language: locale.value,
})

watch(() => localeState.language, (code) => {
  changeLocale(code)
})

const properties = computed(() => [
  {
    type: 'select' as const,
    name: t('preferences.theme'),
    description: t('preferences.themeDescription'),
    object: colorMode,
    key: 'preference',
    options: [
      { label: t('preferences.dark'), value: 'dark' },
      { label: t('preferences.light'), value: 'light' },
    ],
  },
  {
    type: 'select' as const,
    name: t('preferences.language'),
    description: t('preferences.languageDescription'),
    object: localeState,
    key: 'language',
    options: localeOptions,
  },
])
</script>

<template>
  <div>
    <div class="mb-1 flex items-center justify-between">
      <h3 class="text-13px font-semibold inline-flex">
        {{ t('preferences.interface') }}
      </h3>
    </div>

    <AGUIPropertiesForm :properties="properties" />
  </div>
</template>
