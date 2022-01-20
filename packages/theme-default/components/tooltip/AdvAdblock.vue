<template>
  <div class="absolute h-screen w-screen flex flex-col justify-center items-center animate-animated animate-fadeIn">
    <div class="max-w-1000px transition shadow hover:shadow-md" p="4" m="4">
      <h2 text="xl left" font="black" class="text-gray-900 dark:text-gray-200">
        如果你可以看到这行字，就说明游戏<span text="red-500">没有加载成功</span>！
        <br>
        <br>
        这主要是因为 ADV.JS 使用了 ADV 作为大部分 CSS 的命名空间，<br>而 ADV 的缩写和广告（advertisement）类似，导致被 <span text="red-500">Adblock</span> 等广告屏蔽插件<span text="red-500">误当作</span>广告给隐藏了。
        <br>
        <br>
        即刻<span text="red-500">关闭</span>本页面的广告拦截插件以正常显示本页面吧！
      </h2>
      <br>
      <AdvButton @click="refresh">
        我现在关闭啦！刷新本页！
      </AdvButton>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { isClient } from '@advjs/shared/utils'

const refresh = () => {
  if (isClient)
    window.location.reload()
}
</script>
