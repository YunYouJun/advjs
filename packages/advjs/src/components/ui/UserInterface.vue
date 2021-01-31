<template>
  <div class="ui fixed w-screen top-0 z-10">
    <div class="flex flex-row p-4">
      <display-history class="mr-4" />
      <hide-ui />
    </div>

    <menu-setting @click="showMenu = true" />
    <base-modal v-show="showMenu" @close="showMenu = false">
      <template v-slot:body>
        <menu-panel />
      </template>
    </base-modal>
  </div>
</template>

<script>
import BaseModal from '../base/BaseModal.vue';
import DisplayHistory from './DisplayHistory.vue';
import HideUi from './HideUi.vue';
import MenuSetting from './MenuSetting.vue';
import MenuPanel from '../menu/MenuPanel.vue';
export default {
  components: {
    BaseModal,
    DisplayHistory,
    HideUi,
    MenuPanel,
    MenuSetting,
  },
  data() {
    return {
      showMenu: false,
      showUi: true,
    };
  },
};
</script>

<style lang="scss">
.ui {
  position: relative;
}

.adv-icon-button {
  display: inline-block;
  border-radius: 50%;
  padding: 0.6rem;
  cursor: pointer;
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}
</style>
