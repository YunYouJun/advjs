import type { Ref } from 'vue'
import { ref, shallowRef, watch } from 'vue'

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock
 * @returns
 */
export function useScreenLock() {
  const orientation = ref<OrientationLockType>('any')
  const error = shallowRef(undefined) as Ref<any>

  watch(orientation, () => {
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
