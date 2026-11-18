<template>
  <div class="studio-product">
    <ProductHero
      where="【手机上】"
      status="studio"
      platforms="WEB · iPHONE · iPAD"
      title="把项目装进口袋：随时改一章，随手试玩，让托管 AI 先起个草。"
      lead="Studio 打开的是同一套 ADV.JS 项目：工作区看全貌、编辑章节和角色，「游玩」直接跑起来。AI 生成的大纲和章节先进入提案审阅，你确认后才写入项目。"
    >
      <template #actions>
        <ProductAction primary label="在线打开 Studio" href="https://studio.advjs.org" note="手机、平板或电脑浏览器" />
        <ProductAction label="iPhone / iPad 原生版进度" href="/plans/2026-10-21-studio-native-ios" status="studio-ios" note="SwiftUI 客户端开发中" />
      </template>
    </ProductHero>

    <div class="features">
      <ProductFeature index="01" title="在手机上改章节，边改边看">
        <p>章节就是 .adv.md 源码，工具栏帮你插入背景、转场和立绘。切到预览，旁白、对白和场景按读者看到的顺序排开。</p>
      </ProductFeature>

      <ProductFeature index="02" title="角色和世界随身带">
        <p>角色卡列出设定、标签和身份。「世界」页可以浏览世界时钟、事件、关系图谱与时间线，在角色、上帝和访客视角之间切换。</p>
      </ProductFeature>

      <ProductFeature index="03" title="托管 AI：先提案，再落笔" status="studio-ai">
        <p>用云乐坊账号和 AI 点数调用剧情大纲、章节草稿、情节建议、角色扮演模拟和一致性检查。不用填 API Key；任务进度、预占和实际结算显示在 AI 任务轨道里。</p>
      </ProductFeature>
    </div>

    <ProductFamily current="studio" />

    <p class="reference-mark">
      使用参考
    </p>
  </div>
</template>
