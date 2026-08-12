<script setup lang="ts">
import { useEditorCapabilities } from '../composables/useEditorCapabilities'

const online = useOnline()
const capabilities = useEditorCapabilities()
</script>

<template>
  <div>
    <Suspense>
      <ClientOnly>
        <PageView v-if="online && capabilities.integrations.analytics" />
        <div v-else text-gray:80>
          Online services are unavailable
        </div>
      </ClientOnly>
      <template #fallback>
        <div italic op50>
          <span animate-pulse>Loading...</span>
        </div>
      </template>
    </Suspense>
  </div>
</template>
