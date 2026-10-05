# Game UI Contract

Read [the design system](../../docs/about/design/design-system.md) and [game UI specification](../../docs/about/design/game-ui.md) before changing player-facing UI.

- Keep runtime behavior and story state independent of visual themes. Use existing actions for navigation, choices, settings and saves.
- Use `ThemeConfig.ui` and the public game token contract. New shared tokens need a real consumer, documented defaults and tests; theme-specific tokens use `--adv-theme-*`.
- `AdvContainer` owns local theme application; `AdvGame` supplies its runtime theme. Do not mutate `html.dark` or import AGUI / Studio skins to implement a game theme.
- Scope game styles and resets to game components. Keep portals within the theme scope, or explicitly carry the theme to their target.
- Preserve keyboard names/focus, text readability and motion preferences. Verify custom/default themes, narrow layouts and isolation from adjacent authoring controls.
- Historical hardcoded styles or missing accessibility behavior are migration work, not precedents.
