<script setup lang="ts">
import { useAdvContext, useAppStore } from '@advjs/client'
import { useElementSize, useFullscreen } from '@vueuse/core'
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameControlsI18n } from '../../composables/useGameControlsI18n'
import GameIconButton from './GameIconButton.vue'

withDefaults(defineProps<{ showHelper?: boolean }>(), { showHelper: true })
const emit = defineEmits<{ resize: [height: number] }>()
const { $adv } = useAdvContext()
const app = useAppStore()
const router = useRouter()
const { t } = useGameControlsI18n()
const root = useTemplateRef<HTMLElement>('root')
const actions = useTemplateRef<HTMLElement>('actions')
const { height: actionsHeight } = useElementSize(actions)
const { width: toolbarWidth, height: toolbarHeight } = useElementSize(root)
watch([actionsHeight, toolbarWidth, toolbarHeight], () => {
  if (root.value)
    emit('resize', actionsHeight.value + Number.parseFloat(getComputedStyle(root.value).paddingTop) + 8)
})
const screen = computed(() => root.value?.closest<HTMLElement>('.adv-viewport') ?? root.value?.closest<HTMLElement>('.adv-screen'))
const { isFullscreen, isSupported, toggle } = useFullscreen(screen)
const fullscreenPending = shallowRef(false)
const fullscreenFailed = shallowRef(false)

async function toggleFullscreen() {
  if (fullscreenPending.value)
    return
  fullscreenPending.value = true
  fullscreenFailed.value = false
  try {
    await toggle()
  }
  catch {
    fullscreenFailed.value = true
  }
  finally {
    fullscreenPending.value = false
  }
}
</script>

<template>
  <div ref="root" class="game-toolbar" @click.stop @pointerdown.stop>
    <nav ref="actions" class="game-toolbar-actions" :aria-label="t('controls.system')">
      <GameIconButton :label="t(app.showTachie ? 'controls.hideCharacters' : 'controls.showCharacters')" :description="t('hints.characters')" :aria-pressed="!app.showTachie" @click="app.toggleTachie()">
        <span v-if="app.showTachie" i-ri-user-line />
        <span v-else i-ri-user-unfollow-line />
      </GameIconButton>
      <GameIconButton v-if="showHelper" :label="t('controls.rotate')" :description="t('hints.rotate')" @click="app.rotate()">
        <span i-ri-clockwise-line :style="{ transform: `rotate(${app.rotation}deg)` }" />
      </GameIconButton>
      <GameIconButton v-if="$adv.gameConfig.value.gallery" :label="t('controls.gallery')" :description="t('hints.gallery')" @click="router.push('/gallery')">
        <span i-ri-gallery-line />
      </GameIconButton>
      <GameIconButton :label="t($adv.$bgm.isMuted.value ? 'controls.unmute' : 'controls.mute')" :description="t('hints.music')" :aria-pressed="$adv.$bgm.isMuted.value" @click="$adv.$bgm.toggleMute()">
        <span v-if="$adv.$bgm.isMuted.value" i-ri-volume-mute-line />
        <span v-else i-ri-volume-up-line />
      </GameIconButton>
      <GameIconButton v-if="showHelper && isSupported" :label="t(isFullscreen ? 'controls.exitFullscreen' : 'controls.fullscreen')" :description="t('hints.fullscreen')" :aria-pressed="isFullscreen" :disabled="fullscreenPending" @click="toggleFullscreen">
        <span v-if="isFullscreen" i-ri-fullscreen-exit-line />
        <span v-else i-ri-fullscreen-line />
      </GameIconButton>
      <GameIconButton :label="t('controls.settings')" :description="t('hints.settings')" @click="app.menus.settings = true">
        <span i-ri-settings-3-line />
      </GameIconButton>
    </nav>
    <p v-if="fullscreenFailed" class="game-toolbar-feedback" role="status">
      {{ t('controls.fullscreenFailed') }}
    </p>
  </div>
</template>

<style scoped>
/* Outside the scaled stage: hit targets keep their physical size in previews. */
.game-toolbar {
  --adv-toolbar-target: 36px;
  --adv-toolbar-icon: 24px;
  --adv-toolbar-top: max(10px, env(safe-area-inset-top, 0px));
  --adv-toolbar-right: max(12px, env(safe-area-inset-right, 0px));
  --adv-toolbar-left: max(12px, env(safe-area-inset-left, 0px));
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: var(--adv-toolbar-top) var(--adv-toolbar-right) 0 var(--adv-toolbar-left);
  color: white;
  pointer-events: none;
}

.game-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  border-radius: 8px;
  background: radial-gradient(ellipse at center, rgb(0 0 0 / 16%), transparent 75%);
  pointer-events: auto;
}

.game-toolbar-feedback {
  position: absolute;
  top: calc(var(--adv-toolbar-top) + var(--adv-toolbar-target) + 8px);
  right: var(--adv-toolbar-right);
  max-width: calc(100% - var(--adv-toolbar-right) - var(--adv-toolbar-left));
  padding: 8px 12px;
  border-radius: 6px;
  background: rgb(24 23 21 / 95%);
  font-size: 13px;
}

@container adv-viewport (max-width: 600px) {
  .game-toolbar {
    --adv-toolbar-target: 48px;
    --adv-toolbar-icon: 28px;
  }
}

@media (any-pointer: coarse), (max-width: 1000px) and (max-height: 500px) {
  .game-toolbar {
    --adv-toolbar-target: 48px;
    --adv-toolbar-icon: 28px;
  }
}

.is-landscape-phone .game-toolbar {
  --adv-toolbar-target: 48px;
  --adv-toolbar-icon: 28px;
  --adv-toolbar-right: max(12px, env(safe-area-inset-bottom, 0px));
  --adv-toolbar-left: max(12px, env(safe-area-inset-top, 0px));
  --adv-toolbar-top: max(10px, env(safe-area-inset-left, 0px));
}
</style>
