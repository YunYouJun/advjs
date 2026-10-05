# Game Themes

Read [the game UI specification](../docs/about/design/game-ui.md) and [design system](../docs/about/design/design-system.md).

- Extend `ThemeConfig` from `@advjs/types` for theme-specific options; the shared `ui` field has the same meaning in every theme.
- Prefer semantic game tokens for skin changes, and component overrides for structural differences. Reuse runtime actions instead of duplicating state.
- Themes own the game's art direction. AGUI editor density and Studio brand styling do not constrain game artwork or player UI.
- Scope styles to game components or `[data-adv-ui="game"]`; do not reset the host's `body`, buttons or global color mode. Keep overlays in scope.
- Validate defaults as well as custom tokens, keyboard focus, long text, narrow layouts and embedded previews.
