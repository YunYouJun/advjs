---
name: adv-theme
description: Design, implement and verify the player-facing UI theme of an ADV.JS game from its story. Use when a game needs its own look (title screen, dialogue box, choices, backlog, save screen, ending), when restyling theme.config.ts tokens, adding project component overrides or scaffolding a theme package, or when fixing adv check ADV_THEME_* diagnostics. Hands texture, title art and background needs to adv-art.
---

# ADV Theme

Give a game a UI that belongs to its story, using the lightest layer that achieves the look, and prove it with `adv check` and screenshots you have actually looked at.

## Tools

| Need                                                         | CLI                                                               | MCP                                     |
| ------------------------------------------------------------ | ----------------------------------------------------------------- | --------------------------------------- |
| Story brief                                                  | `adv context`                                                     | `adv://project/overview`                |
| Token contract, contrast pairs, presets, current theme state | `adv context --theme`                                             | `adv://theme` (JSON)                    |
| Start from a preset                                          | `adv theme init --preset <id> [--force]`                          | —                                       |
| Diagnostics                                                  | `adv check --json` (`ADV_THEME_*` codes)                          | `adv_validate`                          |
| Screenshots                                                  | `adv theme screenshot [--viewport name=WxH] [--url <dev server>]` | `adv_theme_screenshot` (returns images) |

Screenshots need Playwright with Chromium in the project (`npm i -D playwright && npx playwright install chromium`). Without `--url`, the command starts the same project preview the desktop app uses; pass `--url` to reuse a preview that is already running.

## Workflow

### 1. Read the brief

Run `adv context` and `adv context --theme`. From the world, outline, scenes and characters, write a five-line art direction before touching any file:

- **Setting and era** — where the eye is (rain-slick city, Song-dynasty teahouse, school rooftop).
- **Mood** — two or three words (wary, tender, feverish).
- **Materials** — what UI surfaces would be made of in that world (glass HUD, rice paper, lacquer, chalkboard).
- **Palette** — one dominant surface, one ink, one accent, one alert/focus colour, each with a reason from the story.
- **Type** — a body stack that reads CJK well at 20–22px, and an optional display stack. Device font stacks only, ending in a generic family; no web fonts unless the project already ships them.

Name the references the user gave and what you take from each (shape language, colour, typography), never their logos or art.

### 2. Choose the lightest layer

| Layer                    | Use it for                                                | How                                                                                                    |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **L1 tokens**            | Colour, type, radius, shadow, motion                      | `ui.tokens` in `theme.config.ts`; `--adv-theme-*` custom tokens only when your own styles read them    |
| **L2 project overrides** | Structure for this game: title layout, menu shape, ending | `pages/start.vue`, `components/start/StartMenu.vue`, `components/AdvEnd.vue`, `styles/` in the project |
| **L3 theme package**     | One look shared by several games                          | Scaffold from `themes/theme-starter`, extend `ThemeConfig`                                             |

Stay on L1 unless the brief needs a different structure, not just a different colour. Read [references/layers.md](references/layers.md) before L2 or L3.

### 3. Start from a preset, then make it the story's own

Pick the closest preset from `adv context --theme` (`neon-noir` dark/cyberpunk/detective, `paper-ink` light/historical/literary, `after-school` light/slice of life) and write it:

```bash
adv theme init --preset neon-noir
```

Then change it to match the art direction: at minimum the accent, speaker-name colour, dialog surface, choice shape and fonts. A preset shipped unchanged is a failure of this skill. Keep `colorScheme` explicit so contrast is checked against one scheme.

Rules for values (also enforced by `adv check`):

- Only names from the contract, or `--adv-theme-*`. Typos are silently ignored at runtime, so the check fails them.
- CSS strings with units: `'6px'`, `'180ms'`, `'0 2px 8px rgb(0 0 0 / 30%)'`. Only `0` may omit a length unit.
- Text pairs reach 4.5:1, large ending text and focus rings 3:1. Translucent surfaces must pass over both dark and light scene art, so prefer ≥ 0.9 opacity behind text.
- Declare `--adv-choice-color` whenever you change choice backgrounds; it otherwise inherits.

### 4. Hand image needs to adv-art

Textures, title art, logos, ornaments and backgrounds are assets, not CSS tricks. List each one (purpose, size, transparency, where it is used) and run `$adv-art` for it. Reference accepted assets from `--adv-theme-*` tokens or L2 styles. Do not inline base64 images or generate art ad hoc in this skill.

### 5. Check

```bash
adv check --json
```

Fix every `ADV_THEME_*` error. Treat `ADV_THEME_LOW_CONTRAST` warnings marked `uncertain` as real unless the screenshot proves the surface sits on art that keeps the contrast. `ADV_THEME_CONTRAST_UNVERIFIED` means a colour the checker cannot compute (for example `oklch()` or an image); verify that pair by eye in the screenshots.

| Code                                                        | Meaning                                             |
| ----------------------------------------------------------- | --------------------------------------------------- |
| `ADV_THEME_UNKNOWN_TOKEN`                                   | Name not in the contract and not `--adv-theme-*`    |
| `ADV_THEME_MISSING_UNIT`                                    | Length, shadow or duration without a unit           |
| `ADV_THEME_INVALID_TOKEN_VALUE`                             | Non-string, empty, `;`, braces or `!important`      |
| `ADV_THEME_INVALID_COLOR`                                   | A colour token that is not a colour                 |
| `ADV_THEME_INVALID_COLOR_SCHEME`                            | `colorScheme` other than `light` / `dark`           |
| `ADV_THEME_LOW_CONTRAST`                                    | A declared pair below WCAG 2.2 AA                   |
| `ADV_THEME_CONTRAST_UNVERIFIED`                             | A declared pair the checker cannot compute          |
| `ADV_THEME_CONFIG_LOAD_FAILED` / `ADV_THEME_INVALID_CONFIG` | `theme.config` does not load or has the wrong shape |

### 6. Look, critique, iterate

```bash
adv theme screenshot
```

This writes `.adv/theme-screenshots/<viewport>/{1-title,2-dialogue,3-choice,4-backlog,5-save,6-long-dialogue,7-long-choice}.png` for a 1280×720 desktop and a 390×844 narrow canvas, with reduced motion on, plus `report.json` listing unreachable states and console errors. Open every image. Critique against [references/critique.md](references/critique.md) and write the findings down as a short list before editing. Iterate steps 3–6 until the critique is clean; two or three rounds is normal.

If a state is reported missing (for example a story without choices), say so in the report instead of claiming it was reviewed.

### 7. Report

Tell the user: the art direction, the layer used and why, the files changed, the remaining `adv check` warnings with reasons, the screenshot paths you reviewed, and the image needs handed to `adv-art`.

## Avoid the generic look

- No purple-to-blue gradients, glassmorphism, or gradient pill buttons unless the story is literally about them.
- Not every surface rounded the same; choose corners from the world's materials (square terminal panels, torn paper, worn enamel).
- No pure `#000`/`#fff` pairs by default; tint ink and paper toward the palette.
- One accent, used sparingly: speaker names, focus, active controls. Not every border.
- Motion only where it carries meaning; keep durations ≤ 240ms and never animate text reveal against reduced motion.

## Completion rules

- `adv check` passes with no `ADV_THEME_*` errors.
- Every screenshot state was rendered at both viewports and reviewed, or reported missing with the reason.
- Focus rings are visible on every surface; long text wraps without clipping or covering the control bar.
- Styles stay inside `[data-adv-ui="game"]`; the host page, `body` and `html.dark` are untouched.
- Image needs are listed and handed to `adv-art`, not improvised.
