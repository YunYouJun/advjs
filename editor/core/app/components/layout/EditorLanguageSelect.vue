<script setup lang="ts">
import { Toast } from '@advjs/gui'
import { shallowRef } from 'vue'
import { useEditorLocale } from '../../composables/useEditorLocale'
import { isEditorLocalePreference } from '../../utils/editor-locale'

const { savedLocale, changeLocale } = useEditorLocale()
const { t } = useI18n()
const pending = shallowRef(false)

async function onChange(event: Event) {
  const select = event.target as HTMLSelectElement
  if (!isEditorLocalePreference(select.value))
    return
  pending.value = true
  try {
    await changeLocale(select.value)
  }
  catch {
    select.value = savedLocale.value
    Toast({ title: t('preferences.languageFailed'), type: 'warning' })
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <label class="text-xs inline-flex gap-1 items-center">
    <span class="i-ri-translate-2" aria-hidden="true" />
    <span class="sr-only">{{ $t('preferences.language') }}</span>
    <select
      :value="savedLocale"
      :disabled="pending"
      class="text-inherit px-1 py-0.5 border border-white/15 rounded bg-$agui-c-bg max-w-44"
      @change="onChange"
    >
      <option value="auto">{{ $t('preferences.followBrowser') }}</option>
      <option value="zh-CN">中文（简体）</option>
      <option value="en">English</option>
    </select>
  </label>
</template>
