<script setup lang="ts">
import type { TachieState } from '@advjs/client'
import { useAdvContext } from '@advjs/client'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  tachie: TachieState
  characterId: string
  leaving?: boolean
  instant?: boolean
}>(), {
  leaving: false,
  instant: false,
})

const { $adv } = useAdvContext()
const advStore = $adv.store

const active = computed(() => {
  const node = advStore.current
  if (node?.kind !== 'dialog')
    return false
  const character = $adv.gameConfig.value.characters.find(item => item.id === props.characterId)
  if (!character)
    return false
  const speaker = typeof node.data?.character === 'string' ? node.data.character : ''
  return character.id === speaker || character.name === speaker || Boolean(character.aliases?.includes(speaker))
})

const curTachie = computed(() => {
  const tachies = $adv.resources.charactersMap.get(props.characterId)?.tachies
  return tachies?.[props.tachie.status] ?? tachies?.default
})

const position = computed(() => {
  const value = props.tachie.position
  if (value === 'left')
    return 24
  if (value === 'right')
    return 76
  if (value === 'center' || value === undefined)
    return 50
  return Math.max(5, Math.min(95, value <= 1 ? value * 100 : value))
})

const wrapperStyle = computed(() => ({
  '--adv-tachie-x': `${position.value}%`,
  '--adv-tachie-scale': String(props.tachie.scale ?? 1),
  '--adv-tachie-mirror': props.tachie.mirror ? '-1' : '1',
}))

const characterClass = computed(() => {
  const classes = curTachie.value?.class
    ? Array.isArray(curTachie.value.class) ? [...curTachie.value.class] : [curTachie.value.class]
    : []
  if (active.value)
    classes.push('active')
  return classes
})

const motionClass = computed(() => `tachie-motion-${props.tachie.motion ?? 'fade'}`)
const spriteStyle = computed(() => {
  const sprite = curTachie.value?.sprite
  if (!sprite)
    return undefined
  return {
    ...curTachie.value?.style,
    '--adv-sprite-frames': String(sprite.frames),
    '--adv-sprite-steps': String(Math.max(1, sprite.frames - 1)),
    '--adv-sprite-duration': `${sprite.frames / Math.max(1, sprite.fps)}s`,
    '--adv-sprite-width': `${sprite.frameWidth}px`,
    '--adv-sprite-height': `${sprite.frameHeight}px`,
    '--adv-sprite-aspect': String(sprite.frameWidth / sprite.frameHeight),
    '--adv-sprite-iteration': sprite.loop === false ? '1' : 'infinite',
    'backgroundImage': `url("${curTachie.value?.src}")`,
  }
})
</script>

<template>
  <div
    class="tachie-slot"
    :class="[motionClass, { 'has-sprite': Boolean(curTachie?.sprite), 'is-leaving': leaving, 'is-instant': instant }]"
    :style="wrapperStyle"
  >
    <Transition name="adv-tachie-status" mode="out-in">
      <div
        v-if="curTachie?.sprite"
        :key="curTachie.src"
        class="tachie-character tachie-sprite"
        :class="characterClass"
        :style="spriteStyle"
        role="img"
        :aria-label="$adv.resources.charactersMap.get(characterId)?.name"
      />
      <img
        v-else-if="curTachie?.src"
        :key="curTachie.src"
        class="tachie-character"
        :class="characterClass"
        :style="curTachie.style"
        :src="curTachie.src"
        :alt="$adv.resources.charactersMap.get(characterId)?.name || ''"
      >
    </Transition>
  </div>
</template>

<style lang="scss">
.tachie-slot {
  position: absolute;
  bottom: 0;
  left: var(--adv-tachie-x);
  display: flex;
  width: min(42vw, 46rem);
  height: 96%;
  align-items: flex-end;
  justify-content: center;
  transform: translateX(-50%);
  transform-origin: bottom center;
  animation: tachie-enter-fade 360ms ease both;

  &.tachie-motion-slide-left {
    animation-name: tachie-enter-left;
  }
  &.tachie-motion-slide-right {
    animation-name: tachie-enter-right;
  }
  &.tachie-motion-emphasis {
    animation-name: tachie-emphasis;
  }
  &.tachie-motion-shake {
    animation-name: tachie-shake;
  }
  &.tachie-motion-hop {
    animation-name: tachie-hop;
  }
  &.is-leaving {
    animation: tachie-leave 420ms ease both;
  }
  &.is-instant {
    animation: none;
  }
  &.is-instant .tachie-character {
    transition: none;
  }

  // Small sprites use a bottom-center anchor, but the dialogue layer occupies
  // the lower stage. Lift the anchor into the visible playfield without
  // changing the persistent tachie position stored by the runtime.
  &.has-sprite {
    bottom: clamp(11.5rem, 24vh, 14rem);
  }
}

.tachie-character {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  object-position: bottom center;
  filter: brightness(50%);
  transform: scaleX(var(--adv-tachie-mirror)) scale(var(--adv-tachie-scale));
  transform-origin: bottom center;
  transition:
    filter var(--adv-animation-duration-fast) linear,
    transform 220ms ease;

  &.active {
    filter: brightness(100%);
  }
}

.tachie-sprite {
  width: min(var(--adv-sprite-width), 100%);
  height: auto;
  aspect-ratio: var(--adv-sprite-aspect);
  max-height: 100%;
  background-position: 0 0;
  background-repeat: no-repeat;
  background-size: calc(var(--adv-sprite-frames) * 100%) 100%;
  animation: adv-sprite-play var(--adv-sprite-duration) steps(var(--adv-sprite-steps)) var(--adv-sprite-iteration);
}

.adv-tachie-status-enter-active,
.adv-tachie-status-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.adv-tachie-status-enter-from,
.adv-tachie-status-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@keyframes adv-sprite-play {
  to {
    background-position: 100% 0;
  }
}
@keyframes tachie-enter-fade {
  from {
    opacity: 0;
  }
}
@keyframes tachie-enter-left {
  from {
    opacity: 0;
    transform: translateX(calc(-50% - 4rem));
  }
}
@keyframes tachie-enter-right {
  from {
    opacity: 0;
    transform: translateX(calc(-50% + 4rem));
  }
}
@keyframes tachie-emphasis {
  50% {
    transform: translateX(-50%) translateY(-0.8rem);
  }
}
@keyframes tachie-shake {
  25% {
    transform: translateX(calc(-50% - 0.7rem));
  }
  75% {
    transform: translateX(calc(-50% + 0.7rem));
  }
}
@keyframes tachie-hop {
  50% {
    transform: translateX(-50%) translateY(-1.4rem);
  }
}
@keyframes tachie-leave {
  to {
    opacity: 0;
    transform: translateX(-50%) translateY(1rem);
  }
}

@media (max-width: 800px) {
  .tachie-slot {
    bottom: 11rem;
    width: min(58vw, 34rem);
    height: 91%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tachie-slot,
  .tachie-character,
  .tachie-sprite {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
  }
}
</style>
