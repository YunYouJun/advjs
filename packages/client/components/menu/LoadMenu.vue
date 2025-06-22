<script lang="ts" setup>
import type { CreativeEffectOptions, Swiper as SwiperClass } from 'swiper/types'

import { EffectCreative } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { ref } from 'vue'

import 'swiper/css/effect-creative'
import 'swiper/css'

const swiperRef = ref<SwiperClass>()
const modules = [EffectCreative]

/**
 * 总页数
 */
const pages = ref(10)
/**
 * 每页显示的存档数量
 */
const perPageNum = ref(6)

const curPage = ref(1)

function togglePage(page: number) {
  if (!swiperRef.value)
    return
  swiperRef.value.slideTo(page - 1)
}

function onInit(swiper: SwiperClass) {
  if (!swiper)
    return
  swiperRef.value = swiper
  swiper.slideTo(curPage.value - 1)
}

function onSlideChange() {
  if (!swiperRef.value)
    return
  curPage.value = swiperRef.value.activeIndex + 1
}

const creativeEffect: CreativeEffectOptions = {
  prev: {
    shadow: true,
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
  <div class="menu-panel size-full flex flex-col justify-between" gap="x-2 y-0" text="2xl">
    <div class="flex flex-grow" col="span-12">
      <Swiper
        effect="creative"
        :grab-cursor="true"
        :creative-effect="creativeEffect"
        class="mySwiper"
        :modules="modules"
        @init="onInit"
        @slide-change="onSlideChange"
      >
        <SwiperSlide v-for="i in pages" :key="i">
          <div grid="~ cols-2 gap-4" p="2" class="items-center justify-center">
            <SavedCard
              v-for="j in perPageNum" :key="(i - 1) * perPageNum + j" type="load"
              class="animate-fade-in-up animate-duration-200"
              :style="{ 'animation-delay': `${j * 50}ms` }" :no="(i - 1) * perPageNum + j"
            />
          </div>
        </SwiperSlide>
      </Swiper>
    </div>

    <HorizontalDivider />

    <div class="adv-pagination-container py-4 text-4xl">
      <AdvTextButton
        v-for="i in 10" :key="i"
        :active="curPage === i"
        class="mx-4 w-20 animate-fade-in-down animate-duration-200"
        :style="{ 'animation-delay': `${i * 20}ms` }"
        :font="(curPage === i) && 'bold'"
        bg="blue-500 opacity-5"
        @click="togglePage(i)"
      >
        {{ i }}
      </AdvTextButton>
    </div>
  </div>
</template>
