<template>
  <div class="editor-product">
    <ProductHero
      where="【电脑前】"
      platforms="WEB · DESKTOP"
      title="在大屏上把整部作品摊开：剧本、试玩、流程和素材同在一处。"
      lead="改一行 .adv.md 并保存，游戏面板直接从源码重新编译，不用先 build。在线版用浏览器打开本地文件夹，桌面客户端打开同一个项目，Agent 写进来的修改也会实时刷新。"
    >
      <template #actions>
        <ProductAction primary label="在线打开 Editor" href="https://editor.advjs.org" note="Chromium 内核浏览器" />
        <ProductAction label="桌面客户端" href="/guide/editor/desktop" status="editor-desktop" note="暂未提供安装包，按文档从源码打包" />
        <ProductAction label="用本机 CLI 打开项目" command="adv editor ./my-game" />
      </template>
    </ProductHero>

    <div class="features">
      <ProductFeature index="01" title="流程图看全局，点一下回到源码">
        <p>章节、段落、选项与跳转画成一张图，条件分支和跨章跳转一眼可见。点任一节点，文件面板跳到它在 .adv.md 里的那一行。</p>
      </ProductFeature>

      <ProductFeature index="02" title="素材按目录浏览，双击就预览">
        <p>图片、音频、视频与模型可以筛选、搜索，切换缩略图或列表。双击在主区域预览，「在项目中定位」回到文件树，单击只选中，不打断正在写的剧本。</p>
      </ProductFeature>

      <ProductFeature index="03" title="人物卡就是一份 Markdown">
        <p>在属性面板里改别名、立绘、关系，设计并试听角色音色；保存写回同一个 <code>.character.md</code>，Agent 和 Studio 读到的也是它。</p>
      </ProductFeature>
    </div>

    <ProductFamily current="editor" />

    <p class="reference-mark">
      使用参考
    </p>
  </div>
</template>
