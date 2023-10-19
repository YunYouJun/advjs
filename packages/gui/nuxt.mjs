import { createResolver, defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  hooks: {
    'components:dirs': (dirs) => {
      const { resolve } = createResolver(import.meta.url)
      // Add ./components dir to the list
      dirs.push({
        path: resolve('./src/components'),
        prefix: '',
      })
    },
  },
})
