<script lang="ts" setup>
import { createManualSaveSlot, MANUAL_SAVE_SLOT_COUNT, SAVE_SLOTS_PER_PAGE } from '@advjs/client'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { useSavePager } from '../../composables/useSavePager'

import 'swiper/css'

const perPageNum = SAVE_SLOTS_PER_PAGE
const pages = MANUAL_SAVE_SLOT_COUNT / SAVE_SLOTS_PER_PAGE
const { currentPage, goToPage, motion, onInit, onSlideChange, speed } = useSavePager({ firstPage: 1 })
</script>

<template>
  <SaveMenuLayout :motion="motion">
    <Swiper
      :grab-cursor="true"
      :speed="speed"
      class="save-menu__swiper"
      @init="onInit"
      @slide-change="onSlideChange"
    >
      <SwiperSlide v-for="i in pages" :key="i">
        <SaveSlotsGrid>
          <SavedCard
            v-for="j in perPageNum"
            :key="(i - 1) * perPageNum + j"
            type="save"
            :record-slot="createManualSaveSlot((i - 1) * perPageNum + j)"
          />
        </SaveSlotsGrid>
      </SwiperSlide>
    </Swiper>

    <template #pagination>
      <SavePagination :current-page="currentPage" :pages="pages" @change="goToPage" />
    </template>
  </SaveMenuLayout>
</template>
