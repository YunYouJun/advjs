import type { Swiper as SwiperClass } from 'swiper/types'
import { computed, readonly, shallowRef, watch } from 'vue'
import { useAdvMotionPreference } from './useAdvMotionPreference'

interface UseSavePagerOptions {
  firstPage: 0 | 1
}

const FULL_MOTION_SPEED = 200
const REDUCED_MOTION_SPEED = 120

/** Shared paging and motion policy for save/load menus. */
export function useSavePager(options: UseSavePagerOptions) {
  const swiper = shallowRef<SwiperClass>()
  const currentPage = shallowRef<number>(options.firstPage)
  const motion = useAdvMotionPreference()

  const speed = computed(() => {
    if (motion.value === 'none')
      return 0
    return motion.value === 'reduced' ? REDUCED_MOTION_SPEED : FULL_MOTION_SPEED
  })

  watch(speed, (value) => {
    if (swiper.value)
      swiper.value.params.speed = value
  })

  function goToPage(page: number) {
    swiper.value?.slideTo(page - options.firstPage, speed.value)
  }

  function onInit(instance: SwiperClass) {
    swiper.value = instance
    instance.params.speed = speed.value
    instance.slideTo(currentPage.value - options.firstPage, 0)
  }

  function onSlideChange(instance: SwiperClass) {
    currentPage.value = instance.activeIndex + options.firstPage
  }

  return {
    currentPage: readonly(currentPage),
    motion,
    speed,
    goToPage,
    onInit,
    onSlideChange,
  }
}
