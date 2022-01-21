<template>
  <div class="menu-panel grid grid-cols-12" gap="x-2 y-0" h="full" text="2xl">
    <div col="span-12">
      <h1
        class="adv-font-serif font-black mt-2"
        text="4xl"
      >
        加载存档
      </h1>
      <HorizontalDivider />
    </div>
    <div v-for="i in 6" :key="i" class="animate-animated animate-fadeInDown" :style="{'animation-delay': i*50+'ms'}" col="span-6">
      <SavedCard />
    </div>
    <div col="span-12" class="justify-center items-center">
      <HorizontalDivider />
    </div>
    <div col="span-12">
      <AdvTextButton v-for="i in 10" :key="i" :active="curPage === i" class="mx-4 w-12 animate-animated animate-fadeInDown" :style="{'animation-delay': i*20+'ms'}" :font="(curPage === i) && 'bold'" bg="blue-500 opacity-5" @click="togglePage(i)">
        {{ i }}
      </AdvTextButton>
    </div>
  </div>
</template>

<script lang="ts" setup>
const curPage = ref(1)

const togglePage = (page: number) => {
  curPage.value = page
}
</script>
