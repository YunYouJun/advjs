<script setup lang="ts">
import {
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarPortal,
  MenubarSeparator,
  MenubarTrigger,
} from 'reka-ui'
import './menu-bar.scss'
</script>

<template>
  <MenubarMenu>
    <MenubarTrigger
      class="MenubarTrigger"
    >
      <slot name="trigger" />
    </MenubarTrigger>
    <MenubarPortal>
      <MenubarContent
        class="MenubarContent"
        align="start"
        :side-offset="5"
        :align-offset="-14"
      >
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
</template>
