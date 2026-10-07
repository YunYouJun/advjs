<script setup lang="ts">
import { shallowRef } from 'vue'
import AdvThemeScope from '../../../packages/client/components/internals/AdvThemeScope.vue'
import AGUIDetails from '../../../packages/gui/client/components/AGUIDetails.vue'
import AGUIProperty from '../../../packages/gui/client/components/AGUIProperty.vue'
import AGUISlider from '../../../packages/gui/client/components/AGUISlider.vue'
import AdvSlider from '../../../themes/theme-default/components/ui/AdvSlider.vue'
import '../../../packages/gui/client/styles/css-vars.scss'
import '../../../packages/client/styles/slider.scss'

const exposure = shallowRef(0.5)
const volume = shallowRef(0.5)
</script>

<template>
  <main class="slider-fixture">
    <section class="editor-panel" aria-label="编辑器属性">
      <AGUIDetails title="显示 / Display" open>
        <AGUIProperty label="曝光 / Exposure" for="exposure">
          <AGUISlider id="exposure" v-model="exposure" label="Exposure" :min="0" :max="1" :step="0.05" show-input />
        </AGUIProperty>
        <AGUIProperty label="锁定曝光 / Locked exposure" for="locked-exposure">
          <AGUISlider id="locked-exposure" :model-value="0.4" label="Locked exposure" :min="0" :max="1" :step="0.05" show-input disabled />
        </AGUIProperty>
      </AGUIDetails>
    </section>
    <AdvThemeScope
      class="game-panel" aria-label="游戏音频"
      :theme="{ ui: { colorScheme: 'dark', tokens: { '--adv-c-primary': '#b58748', '--adv-control-radius': '0px' } } }"
    >
      <AdvSlider v-model="volume" label="音乐音量" :min="0" :max="1" :step="0.05" />
      <AdvSlider :model-value="0.4" label="锁定音量" :min="0" :max="1" :step="0.05" disabled />
    </AdvThemeScope>
  </main>
</template>

<style>
body {
  margin: 0;
  padding: 16px;
  font-family: Arial, sans-serif;
  background: var(--agui-c-bg);
}
.slider-fixture {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.editor-panel {
  min-width: 0;
  background: var(--agui-c-bg-panel);
}
.game-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  font-size: 16px;
}
@media (max-width: 600px) {
  .slider-fixture {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
