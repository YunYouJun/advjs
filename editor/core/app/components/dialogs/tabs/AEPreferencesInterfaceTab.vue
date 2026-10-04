<template>
  <div class="flex flex-col gap-3">
    <h3 class="text-lg font-bold">
      {{ $t('preferences.interface') }}
    </h3>
    <p class="text-sm op-70">
      {{ $t('preferences.languageDescription') }}
    </p>
    <EditorLanguageSelect />
  </div>
</template>
