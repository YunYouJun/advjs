<template>
  <transition enter-active-class="animate-fadeIn" leave-active-class="animate-fadeOut">
    <div v-if="show" class="absolute h-screen w-screen flex flex-col justify-center items-center animate-animated">
      <div class="text-gray-900 dark:text-gray-200 max-w-1000px transition shadow hover:shadow-md" p="4" m="4">
        <h2 text="xl left" font="black">
          如果你可以看到这行字，就说明游戏<span text="red-500">没有加载成功</span>！
          <br>
          <br>
          这主要是因为 ADV.JS 使用了 ADV 作为大部分 CSS 的命名空间，<br>而 ADV 的缩写和广告（advertisement）类似，导致被 <span text="red-500">Adblock</span> 等广告屏蔽插件<span text="red-500">误当作</span>广告给隐藏了。
          <br>
          <br>
          即刻<span text="red-500">关闭</span>本页面的广告拦截插件以正常显示本页面吧！
        </h2>
        <hr m="4">
        <h2 text="xl left" font="black">
          ADV.JS uses ADV as the namespace for most CSS.
          The abbreviation of ADV is similar to advertisement, resulting in hidden as ads by <span text="red-500">Adblock</span> or other ad blocking plugins.
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
  </transition>
</template>

<script lang="ts" setup>
import { isClient } from '@advjs/shared/utils'

const { t } = useI18n()
const show = ref(false)

onMounted(() => {
  const container = document.querySelector('.adv-container') as HTMLElement
  const hasAdblock = (getComputedStyle(container).display === 'none')
  show.value = hasAdblock
})

const refresh = () => {
  if (isClient)
    window.location.reload()
}
</script>
