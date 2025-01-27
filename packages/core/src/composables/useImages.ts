import type { MaybeRefOrGetter, UseImageOptions, UseImageReturn } from '@vueuse/core'
import type { Ref } from 'vue'
import { useImage } from '@vueuse/core'
import { computed, ref, toValue } from 'vue'

/**
 * useImage Array for loading
 */
export function useImages(options: MaybeRefOrGetter<UseImageOptions[]>) {
  const images = toValue(options)
  const imagesQueue: Ref<UseImageReturn[]> = ref([])
  images.forEach((image: UseImageOptions) => {
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
