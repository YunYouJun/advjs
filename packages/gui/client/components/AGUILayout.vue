<script lang="ts" setup>
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
</script>

<template>
  <Splitpanes vertical>
    <Pane size="75">
      <Splitpanes horizontal>
        <Pane size="64">
          <Splitpanes vertical>
            <Pane size="30" :min-size="20" :max-size="80">
              <slot name="left-top" />
            </Pane>
            <Pane size="70">
              <slot />
            </Pane>
          </Splitpanes>
        </Pane>
        <Pane :min-size="20" size="36">
          <slot name="left-bottom" />
        </Pane>
      </Splitpanes>
    </Pane>
    <Pane :min-size="20" :max-size="50" size="25">
      <slot name="right">
        <Splitpanes horizontal>
          <Pane :min-size="20">
            <slot name="right-top" />
          </Pane>
          <Pane :min-size="20">
            <slot name="right-bottom" />
          </Pane>
        </Splitpanes>
      </slot>
    </Pane>
  </Splitpanes>
</template>
