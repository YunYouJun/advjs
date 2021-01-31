<template>
  <div class="text-center">
    <router-view />
  </div>
</template>

<style lang="scss">
#app {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

#nav {
  padding: 30px;

  a {
    &.router-link-exact-active {
      color: steelblue;
    }
  }
}
</style>
