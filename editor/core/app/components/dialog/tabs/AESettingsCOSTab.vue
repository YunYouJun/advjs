<script setup lang="ts">
// cos
</script>

<template>
  <div>
    <fieldset class="mb-[15px] flex items-center gap-5">
      <label
        class="text-grass11 w-[90px] text-right text-sm"
        for="name"
      > Name </label>
      <input
        id="name"
        class="text-grass11 h-[35px] w-full inline-flex flex-1 items-center justify-center rounded-lg bg-stone-50 px-[10px] text-sm leading-none shadow-[0_0_0_1px] shadow-green7 outline-none focus:shadow-[0_0_0_2px] focus:shadow-green8"
        defaultValue="Pedro Duarte"
      >
    </fieldset>
    <fieldset class="mb-[15px] flex items-center gap-5">
      <label
        class="text-grass11 w-[90px] text-right text-sm"
        for="username"
      > Username </label>
      <input
        id="username"
        class="text-grass11 h-[35px] w-full inline-flex flex-1 items-center justify-center rounded-lg bg-stone-50 px-[10px] text-sm leading-none shadow-[0_0_0_1px] shadow-green7 outline-none focus:shadow-[0_0_0_2px] focus:shadow-green8"
        defaultValue="@peduarte"
      >
    </fieldset>
  </div>
</template>
