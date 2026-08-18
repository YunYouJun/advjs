<template>
  <main class="policy-page">
    <article class="policy-document">
      <header class="policy-header">
        <a class="policy-brand" href="/">ADV.JS Studio</a>
        <h1 class="policy-title">
          隐私政策
        </h1>
        <p class="policy-meta">
          更新日期：2026 年 8 月 18 日 · 生效日期：2026 年 8 月 18 日
        </p>
        <p class="policy-summary">
          ADV.JS Studio 是由 ADV.JS 项目维护者（YunYouJun）提供的互动叙事创作工具。本政策说明我们处理哪些信息、处理原因、保存方式，以及你可以如何管理自己的信息。
        </p>
      </header>

      <section class="policy-section">
        <h2 class="policy-heading">
          一、适用范围与基本原则
        </h2>
        <p class="policy-copy">
          本政策适用于 advjs.yunle.fun、studio.advjs.org 网站及其对应的移动应用版本。我们遵循目的明确、最小必要、公开透明和安全保护原则。无需登录即可使用本地项目编辑等基础能力；账号、云同步、社区和托管 AI 属于需要联网的可选能力。
        </p>
      </section>

      <section class="policy-section">
        <h2 class="policy-heading">
          二、信息处理清单
        </h2>
        <div class="policy-table-wrap">
          <table class="policy-table">
            <thead>
              <tr>
                <th>场景</th>
                <th>信息种类</th>
                <th>目的与方式</th>
                <th>保存规则</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>本地创作</td>
                <td>项目脚本、角色、场景、素材引用和应用偏好</td>
                <td>保存在你选择的本地工作区、IndexedDB、localStorage 或移动应用 Documents 目录，用于编辑和恢复项目</td>
                <td>由你控制；清除站点数据、删除本地文件或卸载应用后移除</td>
              </tr>
              <tr>
                <td>云乐坊账号</td>
                <td>CloudBase 用户标识、昵称、头像及登录会话；界面可能显示脱敏手机号</td>
                <td>通过云乐坊 SSO 验证身份，用于云同步、社区、托管 AI 和点数结算</td>
                <td>会话按认证服务期限保存；账号资料保留至账号注销或实现服务目的不再需要</td>
              </tr>
              <tr>
                <td>云同步与发布</td>
                <td>你主动选择同步的项目文件、二进制素材、对象路径和修改时间</td>
                <td>通过账号授权的短期单对象权限上传或下载，用于跨设备同步和作品发布；浏览器不会获得永久 COS 密钥</td>
                <td>保留至你删除对应云端项目或账号；备份和日志按安全、审计所需最短期限处理</td>
              </tr>
              <tr>
                <td>托管 AI</td>
                <td>你提交的指令、所选能力所需的已保存项目文件、任务状态、令牌用量和点数流水</td>
                <td>发送至 ADV.JS AI Runtime 及服务端选择的模型服务商，用于生成结果、恢复任务和完成计费对账</td>
                <td>已解决任务正文通常在终态后 7 天清理；未决对账记录保留至问题解决；用量和点数流水按审计需要保存</td>
              </tr>
              <tr>
                <td>匿名使用统计（默认关闭）</td>
                <td>页面和按钮等聚合事件、截断后的错误信息、应用版本、语言、平台和随机会话标识</td>
                <td>仅在你主动开启后发送至自托管 CloudBase 服务，用于稳定性分析和产品改进</td>
                <td>关闭后停止发送并清除本地待上报队列；服务端仅在分析所需期限内保存</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="policy-copy">
          匿名统计不会包含项目正文、AI 对话原文、生成结果、API Key、登录凭证、手机号或用户标识。Studio 生产环境不会要求或保存模型供应商 API Key。
        </p>
      </section>

      <section class="policy-section">
        <h2 class="policy-heading">
          三、共享、委托处理与第三方服务
        </h2>
        <p class="policy-copy">
          为提供联网能力，我们会使用腾讯云 CloudBase、云存储及服务端配置的模型服务。相关服务仅为认证、存储、任务执行、安全与运维目的处理必要信息。除获得你的单独同意或法律法规另有要求外，我们不会出售个人信息，也不会将信息用于广告画像或跨站追踪。
        </p>
        <p class="policy-copy">
          当功能需要向境外接收方提供个人信息时，我们将在启用该功能前另行告知接收方、信息种类、目的和方式，并依法取得所需同意；未完成相应告知与合规措施的能力不会在生产环境开放。
        </p>
      </section>

      <section class="policy-section">
        <h2 class="policy-heading">
          四、权限与设备能力
        </h2>
        <p class="policy-copy">
          Studio 仅在你主动选择文件、目录、分享或其他设备能力时请求相应权限。拒绝非必要权限不会影响本地编辑等无关功能。你可以在浏览器或系统设置中撤回权限。
        </p>
      </section>

      <section class="policy-section">
        <h2 class="policy-heading">
          五、你的权利与选择
        </h2>
        <ul class="policy-list">
          <li>在“我的 → 隐私”中开启或关闭匿名统计，并清除待上报队列。</li>
          <li>在应用设置中清除本地缓存，或直接删除本地项目文件。</li>
          <li>退出登录，停止继续使用依赖账号的联网能力。</li>
          <li>通过下方联系方式申请查阅、更正、复制或删除个人信息，以及注销账号。</li>
          <li>撤回同意不影响撤回前基于同意开展的信息处理。</li>
        </ul>
      </section>

      <section class="policy-section">
        <h2 class="policy-heading">
          六、信息安全
        </h2>
        <p class="policy-copy">
          我们采取 HTTPS 传输、精确 Origin 与回跳地址校验、PKCE、短期单次授权码、最小权限和服务端凭证隔离等措施保护信息。互联网环境无法保证绝对安全；如发生可能影响你权益的安全事件，我们会依法采取补救并进行告知。
        </p>
      </section>

      <section class="policy-section">
        <h2 class="policy-heading">
          七、未成年人保护
        </h2>
        <p class="policy-copy">
          Studio 不专门面向不满十四周岁的未成年人提供服务。未成年人应在监护人指导下使用；如我们发现未经监护人同意处理了未成年人的个人信息，将尽快删除或采取其他必要措施。
        </p>
      </section>

      <section class="policy-section">
        <h2 class="policy-heading">
          八、政策更新
        </h2>
        <p class="policy-copy">
          功能或信息处理方式发生重要变化时，我们会更新本页面，并在必要时通过应用内提示再次征得同意。页面顶部的更新日期表示最近一次修订时间。
        </p>
      </section>

      <section class="policy-section">
        <h2 class="policy-heading">
          九、联系我们
        </h2>
        <p class="policy-copy">
          个人信息处理者：ADV.JS 项目维护者（YunYouJun）。如需咨询、投诉或行使个人信息权利，请通过
          <a class="policy-link" href="https://github.com/YunYouJun/advjs/issues" target="_blank" rel="noopener noreferrer">ADV.JS GitHub Issues</a>
          联系我们。我们会核验请求并在法律规定的期限内处理。
        </p>
      </section>

      <footer class="policy-footer">
        <a class="policy-link" href="/">返回 ADV.JS Studio</a>
        <a class="policy-link" href="https://github.com/YunYouJun/advjs" target="_blank" rel="noopener noreferrer">查看开源代码</a>
      </footer>
    </article>
  </main>
</template>

<style scoped>
.policy-page {
  min-height: 100%;
  padding: max(32px, env(safe-area-inset-top)) 20px max(48px, env(safe-area-inset-bottom));
  color: var(--ion-text-color, #202124);
  background:
    radial-gradient(circle at top left, rgb(124 58 237 / 10%), transparent 32rem), var(--ion-background-color, #f7f7fb);
}

.policy-document {
  width: min(100%, 860px);
  margin: 0 auto;
  padding: clamp(28px, 5vw, 56px);
  border: 1px solid rgb(127 127 127 / 18%);
  border-radius: 24px;
  background: var(--adv-surface-card, #fff);
  box-shadow: 0 20px 60px rgb(27 20 50 / 8%);
}

.policy-header {
  padding-bottom: 28px;
  border-bottom: 1px solid rgb(127 127 127 / 18%);
}

.policy-brand,
.policy-link {
  color: #7c3aed;
  text-decoration: none;
}

.policy-brand {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.policy-brand:hover,
.policy-link:hover {
  text-decoration: underline;
}

.policy-title {
  margin: 20px 0 8px;
  font-size: clamp(34px, 7vw, 52px);
  line-height: 1.08;
  letter-spacing: -0.04em;
}

.policy-meta {
  margin: 0;
  color: var(--adv-text-secondary, #667085);
  font-size: 14px;
}

.policy-summary {
  margin: 24px 0 0;
  font-size: 17px;
  line-height: 1.8;
}

.policy-section {
  margin-top: 36px;
}

.policy-heading {
  margin: 0 0 14px;
  font-size: 21px;
  line-height: 1.4;
}

.policy-copy,
.policy-list {
  margin: 0;
  color: var(--adv-text-secondary, #475467);
  font-size: 15px;
  line-height: 1.85;
}

.policy-copy + .policy-copy {
  margin-top: 12px;
}

.policy-list {
  padding-left: 22px;
}

.policy-list li + li {
  margin-top: 8px;
}

.policy-table-wrap {
  overflow-x: auto;
  margin-bottom: 18px;
  border: 1px solid rgb(127 127 127 / 18%);
  border-radius: 14px;
}

.policy-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  color: var(--adv-text-secondary, #475467);
  font-size: 13px;
  line-height: 1.65;
}

.policy-table th,
.policy-table td {
  padding: 13px 14px;
  border-bottom: 1px solid rgb(127 127 127 / 14%);
  text-align: left;
  vertical-align: top;
}

.policy-table th {
  color: var(--ion-text-color, #202124);
  background: rgb(124 58 237 / 7%);
  font-weight: 650;
}

.policy-table tr:last-child td {
  border-bottom: 0;
}

.policy-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  margin-top: 44px;
  padding-top: 24px;
  border-top: 1px solid rgb(127 127 127 / 18%);
  font-size: 14px;
}

@media (max-width: 640px) {
  .policy-page {
    padding-right: 0;
    padding-left: 0;
    background: var(--ion-background-color, #fff);
  }

  .policy-document {
    padding: 28px 20px 44px;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
}

@media (prefers-color-scheme: dark) {
  .policy-page {
    color: #f4f4f5;
    background: radial-gradient(circle at top left, rgb(139 92 246 / 16%), transparent 32rem), #0f0f17;
  }

  .policy-document {
    background: #171720;
  }

  .policy-meta,
  .policy-copy,
  .policy-list,
  .policy-table {
    color: #c3c3ce;
  }

  .policy-heading,
  .policy-table th {
    color: #fafafa;
  }
}
</style>
