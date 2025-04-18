<script setup lang="ts">
import type { Menu } from './types'
import {
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarItemIndicator,
  MenubarMenu,
  MenubarPortal,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarRoot,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from 'radix-vue'
import { ref } from 'vue'

import './menu-bar.scss'

withDefaults(defineProps<{
  menus?: Menu[]
}>(), {
  menus: () => [],
})

const currentMenu = ref('')
const checkboxOne = ref(false)
const checkboxTwo = ref(false)
const person = ref('pedro')
function handleClick() {
  // alert('hello!')
}

// const RADIO_ITEMS = ['Andy', 'Benoît', 'Luis']
// const CHECK_ITEMS = ['Always Show Bookmarks Bar', 'Always Show Full URLs']
</script>

<template>
  <MenubarRoot v-model="currentMenu" class="MenubarRoot">
    <template v-if="menus?.length">
      <MenubarMenu v-for="menu in menus" :key="menu.name">
        <MenubarTrigger
          class="MenubarTrigger"
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
                {{ menuItem.label }}

                <div class="RightSlot">
                  {{ menuItem.accelerator }}
                </div>
              </MenubarItem>
            </template>
          </MenubarContent>
        </MenubarPortal>
      </MenubarMenu>
    </template>

    <MenubarMenu>
      <MenubarTrigger
        class="MenubarTrigger"
      >
        Edit
      </MenubarTrigger>
      <MenubarPortal>
        <MenubarContent
          class="MenubarContent"
          align="start"
          :side-offset="5"
          :align-offset="-3"
        >
          <MenubarItem
            class="MenubarItem"
          >
            Undo
            <div class="RightSlot">
              ⌘ Z
            </div>
          </MenubarItem>
          <MenubarItem
            class="MenubarItem"
          >
            Redo
            <div class="RightSlot">
              ⇧ ⌘ Z
            </div>
          </MenubarItem>
          <MenubarSeparator class="MenubarSeparator" />
          <MenubarSub>
            <MenubarSubTrigger
              class="MenubarItem"
            >
              Find
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
                  class="MenubarItem group"
                >
                  Search the web…
                </MenubarItem>
                <MenubarSeparator class="MenubarSeparator" />
                <MenubarItem
                  class="MenubarItem"
                >
                  Find…
                </MenubarItem>
                <MenubarItem
                  class="MenubarItem"
                >
                  Find Next
                </MenubarItem>
                <MenubarItem
                  class="MenubarItem"
                >
                  Find Previous
                </MenubarItem>
              </MenubarSubContent>
            </MenubarPortal>
          </MenubarSub>
          <MenubarSeparator class="MenubarSeparator" />
          <MenubarItem
            class="MenubarItem"
          >
            Cut
          </MenubarItem>
          <MenubarItem
            class="MenubarItem"
          >
            Copy
          </MenubarItem>
          <MenubarItem
            class="MenubarItem"
          >
            Paste
          </MenubarItem>
        </MenubarContent>
      </MenubarPortal>
    </MenubarMenu>

    <MenubarMenu>
      <MenubarTrigger
        class="MenubarTrigger"
      >
        View
      </MenubarTrigger>
      <MenubarPortal>
        <MenubarContent
          class="MenubarContent"
          align="start"
          :side-offset="5"
          :align-offset="-14"
        >
          <MenubarCheckboxItem
            v-model="checkboxOne"
            class="MenubarCheckboxItem"
          >
            <MenubarItemIndicator class="MenubarItemIndicator">
              <div class="i-radix-icons:check" />
            </MenubarItemIndicator>
            Show Bookmarks
            <div
              class="RightSlot"
            >
              ⌘+B
            </div>
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            v-model="checkboxTwo"
            class="MenubarCheckboxItem"
          >
            <MenubarItemIndicator class="MenubarItemIndicator">
              <div class="i-radix-icons:check" />
            </MenubarItemIndicator>
            Show Full URLs
          </MenubarCheckboxItem>
          <MenubarSeparator class="MenubarSeparator" />
          <MenubarItem
            class="MenubarItem"
          >
            Reload
            <div class="RightSlot">
              ⌘ R
            </div>
          </MenubarItem>
          <MenubarItem
            class="MenubarItem"
            disabled
          >
            Force Reload
            <div class="RightSlot">
              ⇧ ⌘ R
            </div>
          </MenubarItem>
          <MenubarSeparator class="MenubarSeparator" />
          <MenubarItem
            class="MenubarItem"
          >
            Toggle Fullscreen
          </MenubarItem>
          <MenubarSeparator class="MenubarSeparator" />
          <MenubarItem
            class="MenubarItem"
          >
            Hide Sidebar
          </MenubarItem>
        </MenubarContent>
      </MenubarPortal>
    </MenubarMenu>

    <MenubarMenu>
      <MenubarTrigger
        class="MenubarTrigger"
      >
        Profiles
      </MenubarTrigger>
      <MenubarPortal>
        <MenubarContent
          class="MenubarContent"
          align="start"
          :side-offset="5"
          :align-offset="-14"
        >
          <MenubarRadioGroup v-model="person">
            <MenubarRadioItem
              class="MenubarCheckboxItem inset"
              value="pedro"
            >
              <MenubarItemIndicator class="MenubarItemIndicator">
                <div class="i-radix-icons:dot-filled" />
              </MenubarItemIndicator>
              Pedro Duarte
            </MenubarRadioItem>
            <MenubarRadioItem
              class="MenubarCheckboxItem inset"
              value="colm"
            >
              <MenubarItemIndicator class="MenubarItemIndicator">
                <div class="i-radix-icons:dot-filled" />
              </MenubarItemIndicator>
              Colm Tuite
            </MenubarRadioItem>
          </MenubarRadioGroup>
          <MenubarSeparator class="MenubarSeparator" />
          <MenubarItem
            class="MenubarItem"
            @click="handleClick"
          >
            Edit…
          </MenubarItem>
          <MenubarSeparator class="MenubarSeparator" />
          <MenubarItem
            class="MenubarItem"
          >
            Add Profile…
          </MenubarItem>
        </MenubarContent>
      </MenubarPortal>
    </MenubarMenu>
  </MenubarRoot>
</template>
