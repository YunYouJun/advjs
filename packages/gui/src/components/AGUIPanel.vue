<template>
  <div
    class="agui-panel"
  >
    <div class="agui-panel__resize-bar" />
    <div class="agui-panel__resize-line" />
    <div class="agui-panel__content">
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
  // border: 1px solid black;

  background-color: var(--agui-c-bg-panel);
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
