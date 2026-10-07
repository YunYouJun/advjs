<script setup lang="ts">
// cos
</script>

<template>
  <div>
    <fieldset class="mb-[15px] flex gap-5 items-center">
      <label
        class="text-grass11 text-sm text-right w-[90px]"
        for="name"
      > Name </label>
      <input
        id="name"
        class="text-grass11 shadow-green7 focus:shadow-green8 text-sm leading-none px-[10px] outline-none rounded-lg bg-stone-50 inline-flex flex-1 h-[35px] w-full shadow-[0_0_0_1px] items-center justify-center focus:shadow-[0_0_0_2px]"
        defaultValue="Pedro Duarte"
      >
    </fieldset>
    <fieldset class="mb-[15px] flex gap-5 items-center">
      <label
        class="text-grass11 text-sm text-right w-[90px]"
        for="username"
      > Username </label>
      <input
        id="username"
        class="text-grass11 shadow-green7 focus:shadow-green8 text-sm leading-none px-[10px] outline-none rounded-lg bg-stone-50 inline-flex flex-1 h-[35px] w-full shadow-[0_0_0_1px] items-center justify-center focus:shadow-[0_0_0_2px]"
        defaultValue="@peduarte"
      >
    </fieldset>
  </div>
</template>
