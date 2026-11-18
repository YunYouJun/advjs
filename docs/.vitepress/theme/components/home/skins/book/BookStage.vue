<script setup lang="ts">
import { computed } from 'vue'
import { useHomeCopy } from '../../../../composables/home'
import { usePlayer } from '../../../../composables/player'
import HomeTypewriter from '../../HomeTypewriter.vue'
import BookArt from './BookArt.vue'

defineProps<{ still?: boolean }>()

const t = useHomeCopy()
const { current, currentId, choices, said, typed, instant, auto, stage, history, next, choose } = usePlayer()

/** The plate is whatever the script's last `type: background` block set. */
const plate = computed(() => stage.value.background || 'room')
const page = computed(() => history.value.length + 1)
</script>

<template>
  <div class="screen bk" :class="{ 'is-still': still }">
    <div class="page">
      <div class="top">
        <span class="bg">stage.background = "{{ plate }}"</span>
        <button type="button" class="bk-btn" :aria-pressed="auto" @click="auto = !auto">
          {{ t.ui.auto }}
        </button>
      </div>

      <Transition name="plate" mode="out-in">
        <BookArt :key="plate" class="plate" :scene="plate" />
      </Transition>

      <!-- A scene heading is a title page -->
      <Transition name="leaf" mode="out-in">
        <div v-if="current?.kind === 'scene'" :key="currentId" class="title-page">
          <p class="place">
            {{ current.data!.place }}
          </p>
          <p class="time">
            {{ current.data!.time }}
          </p>
        </div>

        <div v-else-if="said" :key="said.key" class="words" @click="next">
          <HomeTypewriter
            as="p"
            class="said"
            :class="{ 'is-dialog': said.speaker }"
            :text="said.speaker ? `${said.speaker}：「${said.text}」` : said.text"
            :speed="44"
            :instant="instant"
            @done="typed = true"
          />
        </div>
      </Transition>

      <div v-if="choices.length" class="options">
        <button
          v-for="choice in choices"
          :key="`${currentId}-${choice.id}`"
          type="button"
          class="bk-btn option"
          :disabled="choice.locked"
          @click="choose(choice)"
        >
          {{ choice.label }}
        </button>
      </div>

      <span class="folio">{{ t.hero.book.page(page) }}</span>
      <button
        type="button"
        class="corner"
        :aria-label="typed ? t.ui.next : t.ui.reveal"
        :disabled="!!choices.length"
        @click="next"
      >
        <span v-show="typed && !choices.length" class="curl" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.bk {
  --bk-paper: #fbf6ea;
  --bk-ink: #3c2f22;
  --bk-mute: #a08d72;
  --bk-kai: 'Kaiti SC', 'STKaiti', 'KaiTi', 'BiauKai', var(--h-story);
  box-sizing: border-box;
  height: 100%;
  padding: 14px;
  border-radius: 16px;
  font-family: var(--bk-kai);
  color: var(--bk-ink);
  background: #d9cdb4;
  container-type: inline-size;
}

.screen.is-still {
  --drive: paused;
}

.page {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  padding: 12px 16px 40px;
  overflow: hidden;
  border-radius: 4px 12px 12px 4px;
  background: var(--bk-paper);
  box-shadow:
    -5px 0 0 -2px #efe6d2,
    0 5px 0 -1px #cbbd9f;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.bg {
  font-family: var(--h-mono);
  font-size: 11px;
  color: var(--bk-mute);
}

.bk-btn {
  height: 30px;
  padding: 0 14px;
  border: 2px solid var(--bk-ink);
  border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
  font-family: var(--bk-kai);
  font-size: 14px;
  color: var(--bk-ink);
  cursor: pointer;
  background: #fff;
}

.bk-btn[aria-pressed='true'] {
  background: #fde7c2;
}

.plate {
  flex: 1;
  min-height: 0;
  margin: 6px 0;
}

.plate-enter-active,
.plate-leave-active {
  transition: opacity 0.45s ease;
}

.plate-enter-from,
.plate-leave-to {
  opacity: 0;
}

.title-page {
  display: grid;
  gap: 4px;
  justify-items: center;
  padding: 6px 0 10px;
}

.place {
  margin: 0;
  font-size: clamp(22px, 5.4cqi, 30px);
  font-weight: 700;
  letter-spacing: 0.12em;
}

.time {
  margin: 0;
  font-size: 15px;
  color: var(--bk-mute);
}

.words {
  min-height: 3.4em;
  cursor: pointer;
}

.said {
  margin: 0 auto;
  max-width: 26em;
  font-size: 18px;
  line-height: 1.8;
  text-align: center;
  text-wrap: balance;
}

@container (min-width: 560px) {
  .said {
    font-size: 20px;
  }
}

.leaf-enter-active,
.leaf-leave-active {
  transition:
    opacity 0.3s ease,
    clip-path 0.45s var(--h-ease);
}

.leaf-enter-from {
  opacity: 0;
  clip-path: inset(0 0 0 100%);
}

.leaf-leave-to {
  opacity: 0;
}

.options {
  position: absolute;
  top: 48px;
  right: 16px;
  z-index: 1;
  display: grid;
  gap: 8px;
  justify-items: end;
}

.option {
  height: auto;
  min-height: 36px;
  padding: 4px 16px;
  font-size: 16px;
  box-shadow: 0 3px 0 rgba(60, 47, 34, 0.15);
  animation: option-in 0.4s var(--h-ease) both;
}

.option:nth-child(2) {
  animation-delay: 90ms;
}

.option:hover,
.option:focus-visible {
  background: #fde7c2;
}

.folio {
  position: absolute;
  bottom: 12px;
  left: 0;
  right: 0;
  font-size: 13px;
  letter-spacing: 0.2em;
  text-align: center;
  color: var(--bk-mute);
}

.corner {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 40px;
  height: 40px;
  cursor: pointer;
}

.corner:disabled {
  cursor: default;
}

.curl {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 26px;
  height: 26px;
  border-radius: 0 0 10px 0;
  background: linear-gradient(135deg, transparent 50%, #e8dcc2 50%);
  animation: curl 1.4s ease-in-out infinite alternate;
}

.bk :is(a, button):focus-visible {
  outline: 2px dashed #e86a4f;
  outline-offset: 3px;
}

@keyframes curl {
  to {
    width: 32px;
    height: 32px;
  }
}

@keyframes option-in {
  from {
    opacity: 0;
    transform: translateY(-6px) rotate(-2deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .plate-enter-active,
  .plate-leave-active,
  .leaf-enter-active,
  .leaf-leave-active {
    transition: none;
  }

  .curl,
  .option {
    animation: none;
  }
}
</style>
