<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <p class="inspector-empty">
    {{ t('extensions.selectObject') }}
  </p>
</template>

<style scoped>
.inspector-empty {
  padding: 12px;
  font-size: 13px;
  color: var(--agui-c-text-2);
  line-height: 1.5;
}
</style>
