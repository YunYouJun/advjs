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
    <div v-for="i in 6" :key="i" col="span-6">
      <transition :duration="{enter: 1000+i*50, leave: 100}" enter-active-class="animate-fadeInDown" leave-active-class="animate-fadeOut">
        <SavedCard v-if="showCard" class="animate-animated" :style="{'animation-delay': i*50+'ms'}" :no="(curPage-1)*perPageNum+i" />
      </transition>
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
const perPageNum = ref(6)

const curPage = ref(1)

const showCard = ref(false)

const togglePage = (page: number) => {
  showCard.value = false
  setTimeout(() => {
    curPage.value = page
    showCard.value = true
  }, 100)
}

onMounted(() => {
  showCard.value = true
})
</script>
