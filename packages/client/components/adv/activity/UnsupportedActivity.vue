<script setup lang="ts">
import type { AdvActivityRendererEmits, AdvActivityRendererProps } from '../../../types'

const props = defineProps<AdvActivityRendererProps>()
const emit = defineEmits<AdvActivityRendererEmits>()
</script>

<template>
  <div class="unsupported-activity" role="alert">
    <h2 class="unsupported-activity__title">
      当前版本不支持此互动
    </h2>
    <p class="unsupported-activity__description">
      缺少 {{ props.activity.type }} 的界面组件。活动仍保持等待状态，你可以返回上一处选择。
    </p>
    <button type="button" @click="emit('back')">
      返回
    </button>
  </div>
</template>

<style scoped>
.unsupported-activity {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.unsupported-activity__title,
.unsupported-activity__description {
  margin: 0;
}
</style>
