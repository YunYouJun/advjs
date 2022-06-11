import { Swiper, SwiperSlide } from 'swiper/vue'

// Import Swiper Vue.js components
// Import Swiper styles in main
import 'swiper/css'
import 'swiper/css/effect-creative'

// import Swiper core and required modules
// import 'swiper/css/navigation'
import SwiperCore, {
  EffectCreative,
  // Navigation,
} from 'swiper'

import type { UserModule } from '@advjs/client/types'

export const install: UserModule = ({ app }) => {
  SwiperCore.use([EffectCreative])
  app.component('VSwiper', Swiper)
  app.component('VSwiperSlide', SwiperSlide)
}
