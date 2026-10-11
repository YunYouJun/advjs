<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'

defineProps<{ dirty: boolean, busy: boolean, canUndo: boolean, canRedo: boolean }>()
defineEmits<{ undo: [], redo: [], reload: [], validate: [], save: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flow-toolbar" data-testid="flow-toolbar">
    <span role="status">{{ t(dirty ? 'flowEditor.unsaved' : 'flowEditor.saved') }}</span>
    <SButton size="lg" variant="outline" :disabled="busy || !canUndo" @click="$emit('undo')">
      {{ t('flowEditor.undo') }}
    </SButton>
    <SButton size="lg" variant="outline" :disabled="busy || !canRedo" @click="$emit('redo')">
      {{ t('flowEditor.redo') }}
    </SButton>
    <SButton size="lg" variant="ghost" :disabled="busy" :title="t('flowEditor.reloadHint')" @click="$emit('reload')">
      {{ t('flowEditor.reload') }}
    </SButton>
    <SButton size="lg" variant="outline" :disabled="busy" @click="$emit('validate')">
      {{ t('flowEditor.validate') }}
    </SButton>
    <SButton size="lg" :disabled="busy || !dirty" :loading="busy" @click="$emit('save')">
      {{ t('flowEditor.save') }}
    </SButton>
  </div>
</template>
