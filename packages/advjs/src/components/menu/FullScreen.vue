<template>
  <div class="col-span-4 text-right adv-menu-item">
    <label for="speechSynthesisSwitch">是否全屏</label>
  </div>
  <div class="col-span-8 text-left">
    <icon-font
      :name="
        $store.state.settings.fullScreen
          ? 'checkbox-line'
          : 'checkbox-blank-line'
      "
      size="3rem"
      @click="$store.commit('settings/toggleFullScreen')"
    />
  </div>
</template>
