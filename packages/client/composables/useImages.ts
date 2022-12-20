import type { Ref } from 'vue'
import { computed, ref } from 'vue'
import type { MaybeComputedRef, UseImageOptions, UseImageReturn } from '@vueuse/core'
import { resolveUnref, useImage } from '@vueuse/core'

/**
 * useImage Array for loading
 * @param images
 * @returns
 */
export function useImages(options: MaybeComputedRef<UseImageOptions[]>) {
  const images = resolveUnref(options)
  const imagesQueue: Ref<UseImageReturn[]> = ref([])
  images.forEach((image) => {
    const img: UseImageReturn = useImage(image)
    if (img)
      imagesQueue.value.push(img)
  })
  // isLoading is boolean
  const isLoading = computed(() => imagesQueue.value.filter(item => !!item).reduce((acc, cur: any) => {
    return acc || cur.isLoading
  }, false))

  return {
    isLoading,
    imagesQueue,
  }
}
