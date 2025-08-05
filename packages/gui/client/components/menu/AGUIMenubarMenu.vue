<script setup lang="ts">
import {
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarPortal,
  MenubarSeparator,
  MenubarTrigger,
} from 'reka-ui'
</script>

<template>
  <MenubarMenu>
    <MenubarTrigger
      class="text-grass11 flex select-none items-center justify-between gap-[2px] rounded px-3 py-2 text-[13px] font-semibold leading-none outline-none data-[highlighted]:bg-green4 data-[state=open]:bg-green4"
    >
      <slot name="trigger" />
    </MenubarTrigger>
    <MenubarPortal>
      <MenubarContent
        class="will-change-[transform,opacity] [animation-duration:_400ms] [animation-timing-function:_cubic-bezier(0.16,_1,_0.3,_1)] min-w-[220px] rounded-md bg-white p-[5px] shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] outline-none"
        align="start"
        :side-offset="5"
        :align-offset="-14"
      >
        <MenubarItem
          class="text-grass11 group data-[highlighted]:to-green10 data-[state=open]:text-grass11 data-[disabled]:text-mauve8 data-[highlighted]:bg-linear-to-br relative h-[25px] flex select-none items-center rounded px-[10px] pl-5 text-[13px] leading-none outline-none data-[disabled]:pointer-events-none data-[state=open]:bg-green4 data-[highlighted]:from-green9 data-[highlighted]:text-green1 data-[highlighted]:data-[state=open]:text-green1"
        >
          Reload
          <div class="text-mauve9 group-data-[disabled]:text-mauve8 ml-auto pl-5 group-data-[highlighted]:text-white">
            ⌘ R
          </div>
        </MenubarItem>
        <MenubarItem
          class="group text-grass11 data-[state=open]:text-grass11 data-[highlighted]:to-green10 data-[disabled]:text-mauve8 data-[highlighted]:bg-linear-to-br relative h-[25px] flex select-none items-center rounded px-[10px] pl-5 text-[13px] leading-none outline-none data-[disabled]:pointer-events-none data-[state=open]:bg-green4 data-[highlighted]:from-green9 data-[highlighted]:text-green1 data-[highlighted]:data-[state=open]:text-green1"
          disabled
        >
          Force Reload
          <div class="text-mauve9 group-data-[disabled]:text-mauve8 ml-auto pl-5 group-data-[highlighted]:text-white">
            ⇧ ⌘ R
          </div>
        </MenubarItem>
        <MenubarSeparator class="m-[5px] h-[1px] bg-green6" />
        <MenubarItem
          class="text-grass11 data-[state=open]:text-grass11 data-[highlighted]:to-green10 data-[disabled]:text-mauve8 data-[highlighted]:bg-linear-to-br relative h-[25px] flex select-none items-center rounded px-[10px] pl-5 text-[13px] leading-none outline-none data-[disabled]:pointer-events-none data-[state=open]:bg-green4 data-[highlighted]:from-green9 data-[highlighted]:text-green1 data-[highlighted]:data-[state=open]:text-green1"
        >
          Toggle Fullscreen
        </MenubarItem>
        <MenubarSeparator class="m-[5px] h-[1px] bg-green6" />
        <MenubarItem
          class="text-grass11 data-[state=open]:text-grass11 data-[highlighted]:to-green10 data-[disabled]:text-mauve8 data-[highlighted]:bg-linear-to-br relative h-[25px] flex select-none items-center rounded px-[10px] pl-5 text-[13px] leading-none outline-none data-[disabled]:pointer-events-none data-[state=open]:bg-green4 data-[highlighted]:from-green9 data-[highlighted]:text-green1 data-[highlighted]:data-[state=open]:text-green1"
        >
          Hide Sidebar
        </MenubarItem>
      </MenubarContent>
    </MenubarPortal>
  </MenubarMenu>
</template>
