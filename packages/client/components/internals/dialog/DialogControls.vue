<script setup lang="ts">
import { useAdvContext, useAppStore } from '@advjs/client'
import { useElementSize } from '@vueuse/core'
import { computed, nextTick, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { useDialogBarPreference } from '../../../composables/useDialogBarPreference'
import { useDialogBarVisibility } from '../../../composables/useDialogBarVisibility'
import { useGameControlsI18n } from '../../../composables/useGameControlsI18n'
import QuickSaveControls from '../../save/QuickSaveControls.vue'
import GameControlHint from '../../ui/GameControlHint.vue'

const emit = defineEmits<{ resize: [height: number] }>()
const root = useTemplateRef<HTMLElement>('root')
const { height } = useElementSize(root)
watch(height, value => emit('resize', value), { immediate: true })
const { $adv } = useAdvContext()
const app = useAppStore()
const { t } = useGameControlsI18n()
const mode = useDialogBarPreference()
const saveActive = shallowRef(false)
const { visible, expand, collapse, setHover, focused, hintOpen } = useDialogBarVisibility(mode, saveActive)
const rowId = useId()
const playing = computed(() => $adv.$auto.enabled.value || $adv.$auto.skipEnabled.value)
const groups = ['playback', 'saves', 'utility'] as const
const actions = computed(() => [
  { key: 'history', group: 'playback', run: () => app.toggleHistory() },
  { key: 'auto', group: 'playback', pressed: $adv.$auto.enabled.value, run: () => $adv.$auto.toggle() },
  { key: 'skip', group: 'playback', pressed: $adv.$auto.skipEnabled.value, run: () => $adv.$auto.toggleSkip() },
  { key: 'save', group: 'saves', run: () => app.toggleShowSaveMenu() },
  { key: 'load', group: 'saves', run: () => app.toggleShowLoadMenu() },
  { key: 'hide', group: 'utility', run: () => app.toggleUi() },
])
const actionGroups = computed(() => groups.map(key => ({ key, actions: actions.value.filter(action => action.group === key) })))

function stopPlayback() {
  if ($adv.$auto.skipEnabled.value)
    $adv.$auto.toggleSkip()
  if ($adv.$auto.enabled.value)
    $adv.$auto.toggle()
}

async function fold(event: MouseEvent) {
  collapse()
  await nextTick()
  if (event.detail === 0)
    root.value?.querySelector<HTMLButtonElement>('.dialog-reveal-button')?.focus()
}

async function reveal(event: MouseEvent) {
  expand()
  await nextTick()
  if (event.detail === 0)
    root.value?.querySelector<HTMLButtonElement>('.dialog-control')?.focus()
}

function onPointerOver(event: PointerEvent) {
  if (event.pointerType === 'mouse') {
    // Keep compact buttons in place until their click has completed.
    const compact = (event.target as HTMLElement).closest('.dialog-controls-compact')
    setHover(true, !compact)
  }
}

function onFocusIn(event: FocusEvent) {
  focused.value = (event.target as HTMLElement).matches(':focus-visible')
}

function onFocusOut(event: FocusEvent) {
  if (!root.value?.contains(event.relatedTarget as Node | null))
    focused.value = false
}
</script>

<template>
  <div
    ref="root" class="dialog-controls-shell" @click.stop @pointerdown.stop
    @pointerover="onPointerOver" @pointerleave="setHover(false)"
    @focusin="onFocusIn" @focusout="onFocusOut"
  >
    <div v-if="mode === 'auto' && !visible" class="dialog-controls-hover-zone" aria-hidden="true" />
    <nav
      :id="rowId" class="dialog-controls" :class="{ 'is-collapsed': !visible }"
      :aria-label="t('controls.label')" :inert="!visible || undefined" :aria-hidden="!visible"
    >
      <div v-for="group in actionGroups" :key="group.key" class="dialog-control-group" :class="`dialog-controls-${group.key}`">
        <QuickSaveControls v-if="group.key === 'saves'" show-labels inline :hints-disabled="!visible" @active="saveActive = $event" @hint-open="hintOpen = $event" />
        <GameControlHint
          v-for="action in group.actions" :key="action.key"
          :label="t(`controls.${action.key}`)" :description="t(`hints.${action.key}`)" side="top"
          :disabled="!visible" @open="hintOpen = $event"
        >
          <button type="button" class="dialog-control" :aria-label="t(`controls.${action.key}`)" :aria-pressed="action.pressed" @click="action.run">
            {{ t(action.key === 'hide' ? 'controls.hideShort' : `controls.${action.key}`) }}
          </button>
        </GameControlHint>
        <GameControlHint v-if="group.key === 'utility'" :label="t('controls.collapseBar')" :description="t('hints.collapseBar')" side="top" :disabled="!visible" @open="hintOpen = $event">
          <button type="button" class="dialog-control dialog-fold-button" :aria-label="t('controls.collapseBar')" @click="fold">
            <span i-ri-arrow-down-s-line aria-hidden="true" />
          </button>
        </GameControlHint>
      </div>
    </nav>
    <div v-if="!visible" class="dialog-controls-compact">
      <button v-if="playing" type="button" class="dialog-control playback-stop" @click="stopPlayback">
        <span i-ri-stop-circle-line aria-hidden="true" />
        {{ t($adv.$auto.skipEnabled.value ? 'controls.stopSkip' : 'controls.stopAuto') }}
      </button>
      <GameControlHint :label="t('controls.expandBar')" :description="t('hints.expandBar')" side="top">
        <button type="button" class="dialog-control dialog-reveal-button" :aria-label="t('controls.expandBar')" :aria-controls="rowId" :aria-expanded="false" @click="reveal">
          <span i-ri-arrow-up-s-line aria-hidden="true" />{{ t('controls.bar') }}
        </button>
      </GameControlHint>
    </div>
  </div>
</template>

<style scoped>
.dialog-controls-shell {
  position: absolute;
  right: var(--adv-control-right, 16px);
  bottom: var(--adv-control-bottom, 8px);
  left: var(--adv-control-left, 16px);
  display: grid;
  color: #eee8dd;
  font-size: calc(14px / var(--adv-screen-scale, 1));
  pointer-events: none;
}

.dialog-controls,
.dialog-controls-compact {
  grid-area: 1 / 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  align-self: end;
  justify-content: flex-end;
  gap: calc(4px / var(--adv-screen-scale, 1));
}

.dialog-control-group {
  display: flex;
  align-items: center;
  gap: calc(4px / var(--adv-screen-scale, 1));
}

/* Reserve the row's space so auto-hiding never moves the dialogue mid-sentence. */
.dialog-controls.is-collapsed {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 160ms ease,
    visibility 0s 160ms;
}

.dialog-controls {
  transition: opacity 160ms ease;
}

.dialog-controls:not(.is-collapsed),
.dialog-controls-compact {
  pointer-events: auto;
}

.dialog-controls-hover-zone {
  position: absolute;
  inset: auto 0 0;
  height: var(--adv-control-target, 44px);
  pointer-events: auto;
}

.dialog-control {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3em;
  min-width: var(--adv-control-target, 36px);
  min-height: var(--adv-control-target, 36px);
  padding: 0.25em 0.5em;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-shadow: 0 1px 3px black;
  cursor: pointer;
  touch-action: manipulation;
}

.dialog-control:hover,
.dialog-control:focus-visible {
  background: rgb(255 255 255 / 10%);
  outline: 1px solid currentColor;
}

.dialog-control[aria-pressed='true'],
.playback-stop {
  color: #f1d8a4;
  background: rgb(217 189 131 / 10%);
}

.dialog-fold-button,
.dialog-reveal-button {
  color: #c9bdac;
}

@container (max-width: 480px) {
  .dialog-controls {
    display: grid;
    grid-template-areas: 'playback utility' 'saves saves';
    grid-template-columns: 1fr auto;
    column-gap: calc(8px / var(--adv-screen-scale, 1));
  }

  .dialog-controls-playback {
    grid-area: playback;
  }
  .dialog-controls-saves {
    grid-area: saves;
    justify-content: center;
  }
  .dialog-controls-utility {
    grid-area: utility;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dialog-controls,
  .dialog-controls.is-collapsed {
    transition: none;
  }
}
</style>
