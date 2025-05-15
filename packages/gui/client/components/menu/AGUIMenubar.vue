<script setup lang="ts">
import type { Menu } from './types'
import {
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarItemIndicator,
  MenubarMenu,
  MenubarPortal,
  // MenubarRadioGroup,
  // MenubarRadioItem,
  MenubarRoot,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from 'reka-ui'
import './menu-bar.scss'

withDefaults(defineProps<{
  menus?: Menu[]
}>(), {
  menus: () => [],
})

const currentMenu = defineModel('currentMenu', {
  type: String,
  default: '',
})
</script>

<template>
  <MenubarRoot v-model="currentMenu" class="MenubarRoot">
    <template v-if="menus?.length">
      <MenubarMenu v-for="menu in menus" :key="menu.name">
        <MenubarTrigger
          class="MenubarTrigger"
          :class="menu.class"
        >
          {{ menu.name }}
        </MenubarTrigger>
        <MenubarPortal>
          <MenubarContent
            class="MenubarContent"
            align="start"
            :side-offset="5"
            :align-offset="-3"
          >
            <template v-for="menuItem in menu.items" :key="menuItem.label">
              <MenubarCheckboxItem
                v-if="menuItem.type === 'checkbox'"
                v-model:checked="menuItem.checked"
                class="MenubarCheckboxItem inset"
              >
                <MenubarItemIndicator class="MenubarItemIndicator">
                  <div class="i-radix-icons:check" />
                </MenubarItemIndicator>
                {{ menuItem.label }}
              </MenubarCheckboxItem>

              <MenubarSeparator
                v-else-if="menuItem.type === 'separator'"
                class="MenubarSeparator"
              />

              <MenubarSub v-else-if="menuItem.type === 'submenu'">
                <MenubarSubTrigger
                  class="MenubarItem"
                >
                  {{ menuItem.label }}
                  <div
                    class="RightSlot"
                  >
                    <div class="i-radix-icons:chevron-right" />
                  </div>
                </MenubarSubTrigger>
                <MenubarPortal>
                  <MenubarSubContent
                    class="MenubarContent"
                    :align-offset="-5"
                  >
                    <MenubarItem
                      v-for="(subItem, key) in menuItem.children"
                      :key="key"
                      class="MenubarItem"
                      @click="subItem.onClick"
                    >
                      {{ subItem.label }}
                      <div class="RightSlot">
                        {{ subItem.accelerator }}
                      </div>
                    </MenubarItem>
                  </MenubarSubContent>
                </MenubarPortal>
              </MenubarSub>

              <MenubarItem
                v-else
                class="MenubarItem"
                :disabled="menuItem.disabled"
                @click="menuItem.onClick"
              >
                {{ menuItem.label }}<span v-if="menuItem.ellipsis">…</span>
                <div class="RightSlot">
                  {{ menuItem.accelerator }}
                </div>
              </MenubarItem>
            </template>
          </MenubarContent>
        </MenubarPortal>
      </MenubarMenu>
    </template>
  </MenubarRoot>
</template>
