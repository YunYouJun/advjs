<script setup lang="ts">
import { useJsonHighlight } from '../composables/useJsonHighlight'

const props = withDefaults(defineProps<{ code: string, enabled?: boolean }>(), { enabled: true })
const tokens = useJsonHighlight(() => props.code, () => props.enabled)
</script>

<template>
  <pre class="json-code"><template v-if="tokens"><span v-for="(token, index) in tokens" :key="index" :style="{ color: token.color }">{{ token.content }}</span></template><template v-else>{{ code }}</template></pre>
</template>
