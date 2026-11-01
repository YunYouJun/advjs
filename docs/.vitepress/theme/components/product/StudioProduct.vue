<script setup lang="ts">
// Product section of /guide/studio/. Captures come from studio.advjs.org on a 393 × 852 phone viewport,
// with the 「雪夜庄园」 competition demo loaded (docs/public/img/products/studio-*.webp).
</script>

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
        <ProductAction label="iPhone / iPad App" status="studio-ios" note="原生版开发中，尚未上架 App Store" />
      </template>

      <div class="hero-phones">
        <ProductShot
          frame="phone"
          src="/img/products/studio-workspace.webp"
          alt="Studio 工作区总览：雪夜庄园的项目健康、章节、角色、场景与世界观设定"
          :width="786"
          :height="1704"
          eager
        />
        <ProductShot
          class="back"
          frame="phone"
          src="/img/products/studio-play.webp"
          alt="Studio 游玩页：管家霍金斯的第一句对白"
          :width="786"
          :height="1704"
          eager
        />
      </div>
      <p class="hero-caption">
        studio.advjs.org 载入赛事 Demo「雪夜庄园」：左为工作区，右为「游玩」。
      </p>
    </ProductHero>

    <div class="features">
      <ProductFeature index="01" title="在手机上改章节，边改边看" layout="side">
        <p>章节就是 .adv.md 源码，工具栏帮你插入背景、转场和立绘。切到预览，旁白、对白和场景按读者看到的顺序排开。</p>
        <template #shot>
          <ProductShot
            src="/img/products/studio-preview.webp"
            alt="章节编辑页的预览：场景标题、旁白，以及管家与侄子的对白气泡"
            :width="786"
            :height="1120"
            caption="章节预览 · 第一幕「发现」"
          />
        </template>
      </ProductFeature>

      <ProductFeature index="02" title="角色和世界随身带" layout="side" flip>
        <p>角色卡列出设定、标签和身份。「世界」页可以浏览世界时钟、事件、关系图谱与时间线，在角色、上帝和访客视角之间切换。</p>
        <template #shot>
          <ProductShot
            src="/img/products/studio-characters.webp"
            alt="角色列表：伊芙琳·罗斯、霍金斯、詹姆斯·哈特利医生等角色卡"
            :width="786"
            :height="1240"
            caption="角色 · 雪夜庄园的六位角色"
          />
        </template>
      </ProductFeature>

      <ProductFeature index="03" title="托管 AI：先提案，再落笔" status="studio-ai">
        <p>用云乐坊账号和 AI 点数调用剧情大纲、章节草稿、情节建议、角色扮演模拟和一致性检查。不用填 API Key；任务进度、预占和实际结算显示在 AI 任务轨道里。</p>
        <template #shot>
          <div class="ai-shot">
            <ProductShot
              src="/img/products/studio-ai.webp"
              alt="AI 任务轨道：未登录时提示登录后使用托管 AI"
              :width="786"
              :height="460"
              caption="AI 任务轨道 · 未登录时的状态"
            />
          </div>
        </template>
      </ProductFeature>
    </div>

    <ProductFamily current="studio" />

    <p class="reference-mark">
      使用参考
    </p>
  </div>
</template>

<style scoped lang="scss">
.hero-phones {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 260px));
  gap: 0 6%;
  justify-content: center;

  .back {
    margin-top: 56px;
  }
}

.vp-doc .hero-caption {
  margin: 18px 0 0;
  font-size: 12px;
  line-height: 1.6;
  letter-spacing: 0.04em;
  text-align: center;
  color: var(--vp-c-text-3);
}

.features {
  margin-top: 72px;
}

.ai-shot {
  max-width: 400px;
}
</style>
