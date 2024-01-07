<script lang="ts" setup>
import { ref } from 'vue'
import { bCssVars } from '../styles/icons'
import type { AGUIPanelProps } from '../types'

defineProps<{
  title?: string
  panels?: AGUIPanelProps[]
}>()

const expanded = ref(true)

// const transformPanel = reactive({
//   x: 0,
//   y: 0,
//   z: 0,
// })

const globalCSSVars = bCssVars()
</script>

<template>
  <div class="gui-container" :style="globalCSSVars">
    <!-- <h3 v-if="title">
      {{ title }}
    </h3> -->
    <template v-if="panels">
      <template v-for="panel in panels" :key="panel.title">
        <AGUIPanel :expanded="expanded" :title="panel.title">
          <template v-if="!panel.type || panel.type === 'common'">
            <AGUIProperty
              v-for="property in panel.properties"
              :key="property.label"
              :label="property.label"
            >
              <AGUINumberField
                v-if="property.object && typeof property.object[property.property] === 'number'"
                v-model="property.object[property.property]"
                :step="property.step"
                @change="property.onChange"
              />
            </AGUIProperty>
          </template>

          <AGUITree
            v-else-if="panel.type === 'tree'"
            :data="panel.data"

            @node-activate="panel.onNodeActivate"
            @node-collapse="panel.onNodeCollapse"
            @node-expand="panel.onNodeExpand"
            @node-show="panel.onNodeShow"
            @node-hide="panel.onNodeHide"
            @node-selected="panel.onNodeSelected"
            @node-unselected="panel.onNodeUnselected"
          />
        </AGUIPanel>
      </template>
    </template>
  </div>
</template>

<style lang="scss">
.gui-container {
  color: var(--agui-c-text, #fff);
  background-color: var(--agui-c-bg, #303030);

  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;

  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  // padding: 8px;
  box-sizing: border-box;
}
</style>
