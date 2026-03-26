<script setup lang="ts">
const { t } = useI18n()
const { locale, changeLocale } = useEditorLocale()

const localeOptions = [
  { label: 'English', value: 'en' },
  { label: '中文（简体）', value: 'zh-CN' },
]

const localeState = reactive({
  language: locale.value,
})

watch(() => localeState.language, (code) => {
  changeLocale(code)
})

const properties = computed(() => [
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
      <h3 class="inline-flex text-lg font-bold">
        {{ t('preferences.interface') }}
      </h3>
    </div>

    <AGUIPropertiesForm :properties="properties" />
  </div>
</template>
