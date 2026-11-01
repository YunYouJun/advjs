<script setup lang="ts">
// Product section of /guide/editor/. Captures come from the real Editor running the Starter sample
// (docs/public/img/products/editor-*.webp).
</script>

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

      <div class="hero-visual">
        <ProductShot
          frame="browser"
          url="editor.advjs.org"
          src="/img/products/editor-script.webp"
          alt="ADV.JS Editor 工作区：左侧项目文件树，中间是 hello.adv.md 的源码，底部素材面板显示立绘和背景"
          :width="1800"
          :height="1125"
          eager
        />
        <ProductShot
          class="hero-playtest"
          src="/img/products/editor-playtest.webp"
          alt="同一章节在游戏面板中试玩：向导小云的头像与对白"
          :width="1000"
          :height="687"
          eager
        />
      </div>
      <p class="hero-caption">
        编辑器里打开的是「你好，ADV.JS」示例项目；右下角是同一章在「游戏」面板里的样子。
      </p>
    </ProductHero>

    <div class="features">
      <ProductFeature index="01" title="流程图看全局，点一下回到源码">
        <p>章节、段落、选项与跳转画成一张图，条件分支和跨章跳转一眼可见。点任一节点，文件面板跳到它在 .adv.md 里的那一行。</p>
        <template #shot>
          <ProductShot
            src="/img/products/editor-flow.webp"
            alt="流程图面板：第一章「你好，ADV.JS」的段落节点与跨章跳转"
            :width="1400"
            :height="1010"
            caption="流程图 · 第一章的段落与通往第二章的跳转"
          />
        </template>
      </ProductFeature>

      <ProductFeature index="02" title="素材按目录浏览，双击就预览">
        <p>图片、音频、视频与模型可以筛选、搜索，切换缩略图或列表。双击在主区域预览，「在项目中定位」回到文件树，单击只选中，不打断正在写的剧本。</p>
        <template #shot>
          <ProductShot
            src="/img/products/editor-assets.webp"
            alt="素材面板中双击立绘后，主区域显示大图，右侧属性面板提供在项目中定位"
            :width="1600"
            :height="936"
            caption="素材 · 双击立绘，属性面板给出路径与定位"
          />
        </template>
      </ProductFeature>

      <ProductFeature index="03" title="人物卡就是一份 Markdown" layout="side">
        <p>在属性面板里改别名、立绘、关系，设计并试听角色音色；保存写回同一个 <code>.character.md</code>，Agent 和 Studio 读到的也是它。</p>
        <template #shot>
          <ProductShot
            src="/img/products/editor-character.webp"
            alt="人物属性面板：向导的音色与对白、视觉设定、别名和立绘"
            :width="634"
            :height="860"
            caption="人物 · 向导的属性面板"
          />
        </template>
      </ProductFeature>
    </div>

    <ProductFamily current="editor" />

    <p class="reference-mark">
      使用参考
    </p>
  </div>
</template>

<style scoped lang="scss">
.hero-visual {
  position: relative;
  padding-bottom: 12%;
}

.hero-playtest {
  position: absolute;
  right: -4px;
  bottom: 0;
  width: 46%;

  :deep(.device) {
    border-color: rgba(255, 255, 255, 0.14);
    box-shadow: var(--p-shadow);
  }
}

.vp-doc .hero-caption {
  margin: 14px 0 0;
  font-size: 12px;
  line-height: 1.6;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-3);
}

.features {
  margin-top: 72px;
}
</style>
