<template>
  <div class="hello">
    <h1 class="text-4xl my-5">
      {{ props.msg }}
    </h1>
    <h2 class="text-gray-500">
      {{ t('intro.desc') }}
    </h2>
    <h3 class="my-5">
      {{ t('intro.progress') }}
    </h3>
    <h3 class="my-5">
      ...
    </h3>
    <p class="text-2xl gradient-text from-blue-600 to-green-500 bg-gradient-to-r">
      {{ t('intro.hi') }}<br />
    </p>

    <div class="my-10">
      <router-link to="/demo">
        <button
          class="bg-blue-500 hover:bg-blue-400 text-white font-bold py-2 px-4 border-b-4 border-blue-700 hover:border-blue-500 rounded"
        >
          {{ t('button.start') }}
        </button>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const props = defineProps<{msg: string}>()
</script>
