import { h, reactive, createApp } from 'vue';
import { CompilerOptions } from '@vue/compiler-dom';
import pkg from '../package.json';

export const compilerOptions: CompilerOptions = reactive({
  mode: 'module',
  prefixIdentifiers: false,
  optimizeImports: false,
  hoistStatic: false,
  cacheHandlers: false,
  scopeId: null,
  inline: false
});

const App = {
  setup() {
    return () => {
      const isModule = compilerOptions.mode === 'module';

      return [
        h('h1', `Advjs Editor`),
        h('span', { id: 'editor-version' }, pkg.version),

        h('div', { id: 'options-wrapper' }, [
          h('div', { id: 'options-label' }, 'Options ↘'),
          h('ul', { id: 'options' }, [
            // mode selection
            h('li', { id: 'mode' }, [
              h('span', { class: 'label' }, 'Mode: '),
              h('input', {
                type: 'radio',
                id: 'mode-module',
                name: 'mode',
                checked: isModule,
                onChange() {
                  compilerOptions.mode = 'module';
                }
              }),
              h('label', { for: 'mode-module' }, 'module'),
              ' ',
              h('input', {
                type: 'radio',
                id: 'mode-function',
                name: 'mode',
                checked: !isModule,
                onChange() {
                  compilerOptions.mode = 'function';
                }
              }),
              h('label', { for: 'mode-function' }, 'function')
            ]),

            // toggle scopeId
            h('li', [
              h('input', {
                type: 'checkbox',
                id: 'scope-id',
                disabled: !isModule,
                checked: isModule && compilerOptions.scopeId,
                onChange(e: Event) {
                  compilerOptions.scopeId =
                    isModule && (e.target as HTMLInputElement).checked
                      ? 'scope-id'
                      : null;
                }
              }),
              h('label', { for: 'scope-id' }, 'scopeId')
            ]),

            // inline mode
            h('li', [
              h('input', {
                type: 'checkbox',
                id: 'inline',
                checked: compilerOptions.inline,
                onChange(e: Event) {
                  compilerOptions.inline = (e.target as HTMLInputElement).checked;
                }
              }),
              h('label', { for: 'inline' }, 'inline')
            ])
          ])
        ])
      ];
    };
  }
};

export function initOptions() {
  createApp(App).mount(document.getElementById('header')!);
}
