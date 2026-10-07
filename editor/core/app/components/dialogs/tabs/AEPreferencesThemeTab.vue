<script setup lang="ts">
const { t } = useI18n()
const colorMode = useColorMode()

const properties = computed(() => [
  {
    type: 'select' as const,
    name: t('preferences.themePreset'),
    description: t('preferences.themeDescription'),
    object: colorMode,
    key: 'preference',
    options: [
      { label: t('preferences.system'), value: 'system' },
      { label: t('preferences.light'), value: 'light' },
      { label: t('preferences.dark'), value: 'dark' },
    ],
  },
])
</script>

<template>
  <div>
    <h3 class="text-13px font-semibold mb-1">
      {{ t('preferences.theme') }}
    </h3>
    <AGUIPropertiesForm :properties="properties" />
  </div>
</template>
