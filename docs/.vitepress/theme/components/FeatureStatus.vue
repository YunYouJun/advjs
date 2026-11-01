<script setup lang="ts">
import type { FeatureStatusKind } from '../data/feature-status'
import { useData, withBase } from 'vitepress'
import { computed } from 'vue'
import { featureStatus, statusText } from '../data/feature-status'

/**
 * A short status tag for an unfinished feature: `<FeatureStatus id="three" />`.
 * Renders nothing for ids without an entry, so a finished feature simply loses its tag.
 * The tooltip carries the detail; with `link`, the tag also points to the feature's docs.
 */
const props = withDefaults(defineProps<{ id: string, link?: boolean }>(), { link: false })

const { localeIndex } = useData()
const lang = computed(() => localeIndex.value === 'en' ? 'en' : 'zh')

const BADGE: Record<FeatureStatusKind, 'tip' | 'warning' | 'info'> = {
  preview: 'tip',
  unreleased: 'warning',
  planned: 'info',
}

const entry = computed(() => featureStatus[props.id])
const text = computed(() => entry.value && statusText[entry.value.status][lang.value])
const title = computed(() => {
  const e = entry.value
  if (!e)
    return undefined
  const detail = e.note?.[lang.value].replace(/`/g, '') ?? ''
  const target = e.target ? (lang.value === 'zh' ? `预计 ${e.target}` : `Expected in ${e.target}`) : ''
  return [`${e.label[lang.value]}: ${text.value}`, detail, target].filter(Boolean).join('\n')
})
</script>

<template>
  <a
    v-if="entry && link && entry.docs"
    class="feature-status"
    :href="withBase(entry.docs)"
    :title="title"
    :data-status="entry.status"
  ><Badge :type="BADGE[entry.status]" :text="text" /></a>
  <span
    v-else-if="entry"
    class="feature-status"
    :title="title"
    :data-status="entry.status"
  ><Badge :type="BADGE[entry.status]" :text="text" /></span>
</template>

<style scoped>
.feature-status {
  display: inline-flex;
  vertical-align: middle;
  text-decoration: none;
  white-space: nowrap;
}

.feature-status :deep(.VPBadge) {
  margin-left: 0;
  transform: none;
  line-height: 20px;
}
</style>
