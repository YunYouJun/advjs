<template>
  <div id="main">
    <span v-show="loading" class="zi-loading-shim" title="Loading">
      <i></i><i></i><i></i>
    </span>

    <div class="containers">
      <div class="container">
        <div class="toolbar">
          <button id="permalink" class="zi-btn success small">Permalink</button>
          <button
            id="clear"
            class="zi-btn danger small"
            @click="inputText = ''"
          >
            Clear
          </button>
        </div>

        <textarea
          id="inputMarkdown"
          class="zi-input md-input"
          v-model="inputText"
          @input="handleInputText(inputText)"
          @compositionstart="isInputZh = true"
          @compositionend="
            () => {
              isInputZh = false;
              handleInputText(inputText);
            }
          "
        ></textarea>
      </div>

      <div class="container">
        <div class="toolbar">
          <button
            id="responseTime"
            class="zi-btn disabled small"
            style="color: black !important"
          >
            Response Time: {{ delayTime }} ms
          </button>

          <div class="zi-select-container mini">
            <select
              id="outputType"
              class="zi-select"
              v-model="outputType"
              @change="setOutputContent(outputType)"
            >
              <option value="adv">ADV Lexer</option>
              <option value="html">Markdown Preview</option>
              <option value="lexer">Markdown Lexer</option>
            </select>
            <i class="arrow zi-icon-up"></i>
          </div>
        </div>

        <div
          id="outputContent"
          :class="['zi-note', 'md-input', noPadding ? 'no-padding' : '']"
          v-html="outputContent"
        ></div>
      </div>
    </div>
  </div>
</template>

<script>
import marked from 'marked';
import Prism from 'prismjs';
import advParser from '../../lib/index';
export default {
  data() {
    return {
      path: './md/test.md',
      // loading status
      loading: true,
      isInputZh: false,
      // 输出类型
      outputType: 'adv',
      // 输入的 markdown 文本
      inputText: '',
      delayTime: 0,
      highlightAdv: '',
      highlightLexer: '',
      html: '',
      // 输出的内容
      outputContent: '',
      noPadding: true,
    };
  },
  async mounted() {
    const markdown = await this.getTestMarkdown(this.path);
    if (markdown) {
      this.loading = false;
      this.handleInputText(markdown);
    }
  },
  methods: {
    getTestMarkdown(path) {
      return fetch(path)
        .then((res) => {
          return res.text();
        })
        .then((text) => {
          if (!this.inputText) {
            this.inputText = text;
          }
          return text;
        });
    },
    handleInputText(markdown) {
      // 中文输入法时不获取值，输入完再执行
      if (this.isInputZh) return;

      const startTime = new Date().valueOf();
      const lexed = marked.lexer(markdown);

      this.highlightLexer = this.highlight(lexed);
      this.highlightAdv = this.highlight(advParser.parse(lexed));
      this.html = marked.parse(markdown);

      this.setOutputContent(this.outputType);

      const endTime = new Date().valueOf();
      this.delayTime = endTime - startTime;
      return this.delayTime;
    },
    highlight(json) {
      Prism.languages.json = {
        property: { pattern: /"(?:\\.|[^\\"\r\n])*"(?=\s*:)/, greedy: !0 },
        string: { pattern: /"(?:\\.|[^\\"\r\n])*"(?!\s*:)/, greedy: !0 },
        comment: { pattern: /\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/, greedy: !0 },
        number: /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
        punctuation: /[{}[\],]/,
        operator: /:/,
        boolean: /\b(?:true|false)\b/,
        null: { pattern: /\bnull\b/, alias: 'keyword' },
      };
      const highlightCode = Prism.highlight(
        JSON.stringify(json, null, 2),
        Prism.languages.json,
        'json'
      );
      return `<pre class="language-json"><code>${highlightCode}</code></pre>`;
    },
    setOutputContent(type) {
      switch (type) {
        case 'adv':
          this.outputContent = this.highlightAdv;
          this.noPadding = true;
          break;
        case 'html':
          this.outputContent = this.html;
          this.noPadding = false;
          break;
        case 'lexer':
          this.outputContent = this.highlightLexer;
          this.noPadding = true;
          break;
        default:
          break;
      }
    },
  },
};
</script>

<style>
/* helper */
.no-padding {
  padding: 0;
}

/* for demo html */
textarea {
  resize: none;
}

pre {
  overflow: scroll;
}

/* for layout */
.containers {
  display: flex;
  height: calc(100vh - 85px);
}

.container {
  flex-basis: 50%;
  padding: 5px;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
}

#outputContent pre[class*='language-'] {
  margin: 0;
}

.md-input {
  flex-grow: 1;
  margin: 5px 0;

  overflow: auto;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  margin: 0;
  padding: 0;
}
</style>
