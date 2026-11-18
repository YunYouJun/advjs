/**
 * Previews for the cast section, taken from real runs, not mocked.
 *
 * - `terminal`: `adv` v0.1.4 run on 2026-10-22: `adv init`, then the last-tram story from
 *   `stories/last-tram/` copied into `adv/`, then `adv check` and `adv build`. Only the scratch
 *   path is shortened to `~/last-tram`, and the middle of the build's asset list is cut where
 *   marked.
 * - `review`: Claude Code following `packages/advjs/skills/adv-review/SKILL.md` on that same
 *   project, after `adv check` and `adv debug coverage`. Lines are quoted from its report.
 */
export interface TerminalLine {
  text: string
  kind?: 'cmd' | 'ok' | 'info' | 'dim' | 'cut'
}

export const terminal: TerminalLine[] = [
  { text: 'adv init last-tram --name 末班电车', kind: 'cmd' },
  { text: '◐ Creating project in ~/last-tram...', kind: 'dim' },
  { text: '✔ Project created successfully (16 files)', kind: 'ok' },
  { text: 'adv check', kind: 'cmd' },
  { text: '✔ Script syntax (4 files, 0 errors)', kind: 'ok' },
  { text: '✔ Runtime compilation and plugin capabilities (all valid)', kind: 'ok' },
  { text: '✔ Character references (all valid)', kind: 'ok' },
  { text: '✔ All checks passed!', kind: 'ok' },
  { text: 'adv build', kind: 'cmd' },
  { text: '🎮 ADV.JS  v0.1.4   ⚔️ Game  末班电车', kind: 'info' },
  { text: '✓ 2198 modules transformed.', kind: 'dim' },
  { text: '… 22 assets', kind: 'cut' },
  { text: '✓ built in 3.22s', kind: 'ok' },
]

export const review = {
  skill: 'adv-review',
  agent: 'Claude Code',
  prompt: '用 adv-review 审一下末班电车。',
  lines: [
    { text: '先跑了 adv check：通过，2 章 4 个文件。', kind: 'dim' },
    { text: '必须修复 · 设定一致', kind: 'fix' },
    { text: 'tram/02-bookshop.adv.md:5 — 小云是「末班车的乘务员」，却在旧书店里开口。', kind: 'body' },
    { text: '建议：> 车门合上前，小云隔着玻璃对你说：后半本，要你自己来写。', kind: 'suggest' },
    { text: '亮点：「窗外的灯，一盏一盏往后退。」', kind: 'keep' },
  ] as { text: string, kind: 'dim' | 'fix' | 'body' | 'suggest' | 'keep' }[],
}
