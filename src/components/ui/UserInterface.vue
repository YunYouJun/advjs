<template>
  <div class="ui fixed w-screen top-0 z-10">
    <menu-setting class="menu-setting-button" @click="showMenu = true" />
    <base-modal v-show="showMenu" @close="showMenu = false">
      <template v-slot:body>
        <menu-panel />
      </template>
    </base-modal>
  </div>
</template>

<script>
import BaseModal from '../base/BaseModal.vue';
import MenuSetting from './MenuSetting.vue';
import MenuPanel from '../menu/MenuPanel.vue';
export default {
  components: {
    BaseModal,
    MenuPanel,
    MenuSetting,
  },
  data() {
    return {
      showMenu: false,
    };
  },
};
</script>

<style>
.ui {
  position: relative;
}
.menu-setting-button {
  position: absolute;
  top: 1rem;
  right: 1rem;
}
</style>
