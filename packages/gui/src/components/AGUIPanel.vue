<template>
  <div
    class="agui-panel bg-$agui-c-bg-panel"
  >
    <div class="agui-panel__resize-bar" />
    <div class="agui-panel__resize-line" />
    <div class="agui-panel__content absolute bottom-0 left-0 right-0 top-0">
      <slot />
    </div>
  </div>
</template>

<style lang="scss">
// https://juejin.cn/post/7103552735315755045
// https://blog.jioho.cn/blog/demos/css_resize.html
.agui-panel {
  // position: relative;
  display: flex;
  border: 1px solid black;
  // overflow: auto;

  &-resize-bar {
    width: 20px;
    height: inherit;
    cursor: col-resize;
    resize: horizontal;
    // opacity: 0;
    overflow: scroll;

    background-color: red;
  }

  &::-webkit-scrollbar {
    // width: 200px;
    width: 100px;
    height: inherit;
    cursor: col-resize;
    resize: horizontal;
    overflow: scroll;
  }

  &-resize-bar-btn {
    height: 200px;
    width: 2px;
    background: #666;
    position: absolute;
    right: 0;
    top: 0;
  }
}
</style>
