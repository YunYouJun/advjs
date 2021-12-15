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
    <p
      class="text-2xl gradient-text from-blue-600 to-green-500 bg-gradient-to-r"
    >
      {{ t('intro.hi') }}<br>
    </p>

    <div class="my-10">
      <router-link to="/demo">
        <PressButton>{{ t('button.start') }}</PressButton>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import PressButton from '~/client/app/components/global/PressButton.vue'
const { t } = useI18n()
const props = defineProps<{ msg: string }>()
</script>
