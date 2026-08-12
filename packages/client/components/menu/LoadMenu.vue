<script lang="ts" setup>
import type { AdvGameSaveSlot } from '@advjs/client'
import { AUTO_SAVE_SLOT_COUNT, createAutoSaveSlot, createManualSaveSlot, MANUAL_SAVE_SLOT_COUNT, QUICK_SAVE_SLOT, SAVE_SLOTS_PER_PAGE } from '@advjs/client'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { useSavePager } from '../../composables/useSavePager'

import 'swiper/css'

/**
 * 总页数
 */
const pages = MANUAL_SAVE_SLOT_COUNT / SAVE_SLOTS_PER_PAGE
/**
 * 每页显示的存档数量
 */
const perPageNum = SAVE_SLOTS_PER_PAGE

const systemSlots: AdvGameSaveSlot[] = [
  QUICK_SAVE_SLOT,
  ...Array.from({ length: AUTO_SAVE_SLOT_COUNT }, (_, index) => createAutoSaveSlot(index + 1)),
]
const { currentPage, goToPage, motion, onInit, onSlideChange, speed } = useSavePager({ firstPage: 0 })
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
      <SwiperSlide>
        <SaveSlotsGrid>
          <SavedCard
            v-for="slot in systemSlots"
            :key="slot.kind === 'quick' ? slot.kind : `${slot.kind}:${slot.index}`"
            type="load"
            :record-slot="slot"
          />
        </SaveSlotsGrid>
      </SwiperSlide>
      <SwiperSlide v-for="i in pages" :key="i">
        <SaveSlotsGrid>
          <SavedCard
            v-for="j in perPageNum" :key="(i - 1) * perPageNum + j" type="load"
            :record-slot="createManualSaveSlot((i - 1) * perPageNum + j)"
          />
        </SaveSlotsGrid>
      </SwiperSlide>
    </Swiper>

    <template #pagination>
      <SavePagination :current-page="currentPage" :pages="pages" has-system-page @change="goToPage" />
    </template>
  </SaveMenuLayout>
</template>
