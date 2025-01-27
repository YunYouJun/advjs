import type { OrientationLockType } from '@vueuse/core'
import type { Ref } from 'vue'
import { ref, shallowRef, watch } from 'vue'

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock
 * @see [MDN Reference](https://developer.mozilla.org/docs/Web/API/ScreenOrientation/type)
 */
export function useScreenLock() {
  const orientation = ref<OrientationLockType>('any')
  const error = shallowRef(undefined) as Ref<any>

  watch(orientation, () => {
    // @ts-expect-error lock
    screen.orientation.lock('landscape').catch(e => (error.value = e))
  })

  function toggle(type: OrientationLockType) {
    orientation.value = type
  }

  return {
    orientation,

    error,

    toggle,
  }
}
