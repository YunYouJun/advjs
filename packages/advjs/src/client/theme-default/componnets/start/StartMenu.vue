<template>
  <div>
    <!-- <button @click="settings.toggleFullScreen">
      Go Fullscreen
    </button>
    <button @click="screenLock">
      Go Fullscreen
    </button> -->
    <ul class="start-menu flex flex-col items-end absolute">
      <li
        v-for="(item, i) in menuItems"
        :key="i"
        class="start-menu-item adv-font-serif transition scale-50"
        @click="item.do"
      >
        {{ item.title }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
// import { useSettingsStore } from '~/stores/settings'
// const settings = useSettingsStore()

// const screenLock = async() => {
//   await screen.orientation.lock('landscape').catch(e => alert(e.message))
// }

const { t } = useI18n()
const router = useRouter()

interface StartMenuItem {
  title: string
  do?: () => void
}

const menuItems: StartMenuItem[] = [
  {
    title: t('start-menu.new-game'),
    do: () => {
      router.push('/game')
    },
  },
  {
    title: t('start-menu.load-game'),
    do: () => {
      window.alert('存档？不存在的 ╮(￣▽￣"")╭')
    },
  },
  {
    title: t('start-menu.settings'),
    do: () => {
      router.push('/settings')
    },
  },
  {
    title: t('start-menu.help'),
    do: () => {
      router.push('/help')
    },
  },
  {
    title: t('start-menu.quit'),
    do: () => {
      window.alert('为什么不直接关浏览器窗口呢？╮(￣▽￣"")╭')
    },
  },
]
</script>

<style lang="scss">
@use 'sass:map';
.start-menu {
  font-size: 2.5rem;

  right: 4rem;
  bottom: 3rem;
}

.start-menu-item {
  cursor: pointer;
  color: white;
  font-weight: bold;
  text-shadow: 2px 2px 5px rgba(0, 0, 0, 0.8);

  &:hover {
    text-shadow: 2px 2px 5px rgba(0, 0, 0, 0.1);
    background-size: 100%;
    background-clip: text;
    -webkit-background-clip: text;
    -moz-background-clip: text;
    -webkit-text-fill-color: transparent;
    -moz-text-fill-color: transparent;
    @apply transition transform scale-110 -translate-x-2 from-blue-500 to-green-500 bg-gradient-to-r;
  }
}
</style>
