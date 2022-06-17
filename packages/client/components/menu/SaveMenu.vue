<script lang="ts" setup>
import type { Swiper } from 'swiper'
import type { CreativeEffectOptions } from 'swiper/types'
import { ref } from 'vue'

const swiperRef = ref<Swiper>()
const perPageNum = ref(6)

const curPage = ref(1)

const togglePage = (page: number) => {
  if (!swiperRef.value)
    return
  swiperRef.value.slideTo(page - 1)
}

const onInit = (swiper: Swiper) => {
  swiperRef.value = swiper
}

const onSlideChange = () => {
  if (!swiperRef.value)
    return
  curPage.value = swiperRef.value.activeIndex + 1
}

const creativeEffect: CreativeEffectOptions = {
  prev: {
    translate: [
      0,
      0,
      -400,
    ],
  },
  next: {
    translate: [
      '100%',
      0,
      0,
    ],
  },
}
</script>

<template>
  <div class="menu-panel flex flex-col justify-between" gap="x-2 y-0" h="full" text="2xl">
    <div col="span-12">
      <VSwiper
        effect="creative"
        :grab-cursor="true"
        :creative-effect="creativeEffect"
        class="mySwiper"
        @init="onInit"
        @slide-change="onSlideChange"
      >
        <VSwiperSlide v-for="i in 10" :key="i">
          <div grid="~ cols-2 gap-4" p="2">
            <div v-for="j in 6" :key="(i - 1) * 6 + j">
              <SavedCard type="save" class="animate-animated animate-fadeInDown" :style="{ 'animation-delay': `${j * 50}ms` }" :no="(i - 1) * perPageNum + j" />
            </div>
          </div>
        </VSwiperSlide>
      </VSwiper>
    </div>

    <HorizontalDivider />

    <div class="adv-pagination-container">
      <AdvTextButton v-for="i in 10" :key="i" :active="curPage === i" class="mx-4 w-12 animate-animated animate-fadeInDown" :style="{ 'animation-delay': `${i * 20}ms` }" :font="(curPage === i) && 'bold'" bg="blue-500 opacity-5" @click="togglePage(i)">
        {{ i }}
      </AdvTextButton>
    </div>
  </div>
</template>
