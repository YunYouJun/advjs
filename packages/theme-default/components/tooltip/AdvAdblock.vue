<script lang="ts" setup>
import { isClient } from '@vueuse/core'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const show = ref(false)

onMounted(() => {
  const containerName = '.adv-screen'
  const container = document.querySelector(containerName) as HTMLElement
  if (container) {
    const hasAdblock = (getComputedStyle(container).display === 'none')
    show.value = hasAdblock
  }
})

function refresh() {
  if (isClient)
    window.location.reload()
}
</script>

<template>
  <Transition enter-active-class="animate-fade-in" leave-active-class="animate-fade-out">
    <div v-if="show" class="absolute h-screen w-screen flex flex-col animate-duration-200 items-center justify-center">
      <div class="max-w-1000px text-gray-900 shadow transition dark:text-gray-200 hover:shadow-md" p="4" m="4">
        <h2 text="xl left" font="black">
          如果你可以看到这行字，就说明游戏<span text="red-500">没有加载成功</span>！
          <br>
          <br>
          这主要是因为 ADV.JS 使用了 ADV 作为大部分 CSS 的命名空间，<br>而 ADV 和广告（advertisement）的缩写类似，导致被 <span text="red-500">Adblock</span> 等广告屏蔽插件<span text="red-500">误当作</span>广告给隐藏了。
          <br>
          <br>
          即刻<span text="red-500">关闭</span>本页面的广告拦截插件以正常显示本页面吧！
        </h2>
        <hr m="4">
        <h2 text="xl left" font="black">
          ADV.JS uses ADV as the namespace for most CSS.
          ADV is similar to the abbreviation of advertisement, resulting in hidden as ads by <span text="red-500">Adblock</span> or other ad blocking plugins.
          <br>
          <br>
          <span text="red-500">Turn off</span> the ad blocking plugin on this page to display this page normally!
          <br>
        </h2>
        <br>
        <AdvButton @click="refresh">
          {{ t('button.had_closed_adblock') }}
        </AdvButton>
      </div>
    </div>
  </Transition>
</template>
