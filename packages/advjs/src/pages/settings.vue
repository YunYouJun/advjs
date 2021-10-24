<template>
  <router-link to="/start">
    <AdvIconButton class="absolute left-5 top-5 cursor-pointer">
      <AdvIcon>
        <i-ri-arrow-left-line />
      </AdvIcon>
    </AdvIconButton>
  </router-link>
  <MenuPanel />
</template>

<route lang="yaml">
meta:
  layout: start
</route>
