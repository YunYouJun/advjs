# Theme layers

Read `themes/AGENTS.md` and `docs/about/design/game-ui.md` in the ADV.JS repository (or the published game UI docs) before writing L2 or L3 code.

## L1 — tokens

`theme.config.ts` in the project root:

```ts
import { defineThemeConfig } from 'advjs'

export default defineThemeConfig({
  ui: {
    colorScheme: 'dark',
    tokens: {
      '--adv-c-primary': '#2de2c8',
      '--adv-dialog-bg': 'rgba(7, 9, 12, 0.92)',
      '--adv-dialog-name-color': '#ff4f8b',
      // Custom tokens need a consumer in your own styles.
      '--adv-theme-scanline-opacity': '0.06',
    },
  },
})
```

The tokens apply only to the game container. Config wins over theme CSS without `!important`; removing a token restores the default. The default theme also reads `--adv-theme-start-*` and `--adv-theme-logo-color` on its title screen; `adv context --theme` lists them with their defaults.

## L2 — project overrides

Project files override theme and client files with the same name (components) or path (pages, layouts):

| File                                                         | Replaces                                    |
| ------------------------------------------------------------ | ------------------------------------------- |
| `pages/start.vue`                                            | Title screen layout                         |
| `components/start/StartMenu.vue`                             | Title menu buttons                          |
| `components/AdvEnd.vue`                                      | Ending screen                               |
| `styles/index.css`, `styles/index.scss` or `styles/index.ts` | Extra scoped styles, loaded after the theme |

Rules:

- Scope every selector under `[data-adv-ui="game"]` or a component class. Never style `body`, `html`, bare `button` or `.dark`.
- Reuse runtime actions (`useAdvStartActions`, the `ended` state, save/load composables) instead of re-implementing state.
- Read colours from tokens (`var(--adv-c-primary)`) so later L1 edits still apply.
- Keep `:focus-visible` outlines; wrap motion in `@media (prefers-reduced-motion: no-preference)`.
- Size text and hit targets in the logical canvas and divide fixed pixels by `var(--adv-screen-scale, 1)` like the default theme does.

Example scoped style for a custom token:

```css
[data-adv-ui='game'] .adv-dialog-box::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgb(255 255 255 / var(--adv-theme-scanline-opacity, 0)) 0 1px,
    transparent 1px 3px
  );
}
```

## L3 — theme package

Only when several games share the look. Copy `themes/theme-starter`, rename the package and `--adv-theme-name`, extend `ThemeConfig` for theme-specific options, and set `theme` in each game's `adv.config`. Put shared token defaults in the package's `styles/css-vars.scss` under `[data-adv-ui='game']`, and keep `ui.tokens` for per-game adjustments.
