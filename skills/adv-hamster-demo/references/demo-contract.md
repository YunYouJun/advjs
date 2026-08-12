# `demo/hamster` contract

## 1. Source ledger and player-facing route

Internal source order remains:

1. `hamster` — YunYouJun, 《仓鼠》, `https://www.yunyoujun.cn/posts/hamster`
2. `the-common-hamster` — YunYouJun, 《仓生》, `https://www.yunyoujun.cn/posts/the-common-hamster`

Lock fetched revisions in `demo/hamster/adv/adaptation.json`. The player sees neither this boundary nor source-work labels during play. Author forewords, postscripts, contest notes, and adaptation commentary remain optional manifest records with `excludedReason: author-metadata`; only story prose becomes playable.

The first play is one continuous 16-chapter route. Chapter 5 flows directly into the forty-second simulation. The final chapter owns completion persistence, ending unlock, and closing narration. Source links and attribution appear only in About and license documentation.

## 2. Echo Simulation

- The title page shows “回声演算” only after `canonicalCompleted` has persisted.
- Present it as the observer starting another set of simulation parameters inside the world. Never explain it with authorial terms such as “not the original”, “A+”, “canon”, or “interpretive route”.
- It may reuse star-map comparison, civilization initialization, conditions/actions, navigation, save/load, checkpoints, rollback, read state, and Inspector trace.

## 3. Stage and UI

- Maintain a scene-by-scene staging table. Characters enter on actual first appearance, change expression/position at story beats, and leave when the shot no longer contains them.
- The visual system is “orbital archive”: deep navy, amber, and cyan across title, HUD, settings, activities, dialogue, and gallery.
- Narration uses generous line height and controlled measure. Character name and first dialogue baseline must align; mobile moves the name above the body.
- The observer/heroine does not wear glasses. Do not remove facial features during chroma keying.
- Every chapter explicitly configures a suitable BGM and transition.

## 4. Public assets

Use only:

```text
https://cos.advjs.yunle.fun/games/hamster/v1/
```

Object keys:

```text
games/hamster/v1/characters/{character-id}/standing/{expression}.{hash}.webp
games/hamster/v1/characters/{character-id}/animations/{state}.{hash}.webp
games/hamster/v1/backgrounds/{scene-id}.{hash}.webp
games/hamster/v1/cg/{shot-id}.{hash}.webp
games/hamster/v1/cg/{shot-id}.thumbnail.{hash}.webp
games/hamster/v1/audio/bgm/{track-id}.{hash}.ogg
games/hamster/v1/manifests/assets.json
```

Never create `cg/part-01` or `cg/part-02`; paths must not expose source division. Never use `latest/` or overwrite a hashed object. Use the `tencent-cloud-cos` Skill with least-privilege or STS credentials. Upload immutable objects first and the manifest last.

Required inventory for v1:

- 28 connected-region-keyed standing variants with five-background QA and alpha report;
- 15 cohesive reusable backgrounds with no foreground characters and a contact sheet;
- 8 CGs: star-in-hand, old-world-collapse, newborn-earth, tyrannosaurus-encounter, fingertip-sunflower, explorer-awakening, stars-volley, reality-workstation;
- one six-frame horizontal hamster `running` spritesheet with stable bottom-center anchor;
- 8 original loopable BGM motifs covering all 16 chapters.

## 5. Required checks

```bash
node skills/adv-adapt/scripts/audit-coverage.mjs \
  demo/hamster/adv/adaptation.json \
  demo/hamster/public/md/chapters
node skills/adv-art/scripts/audit-assets.mjs demo/hamster/adv/assets.json
pnpm vitest run tests/unit/hamster-adaptation-contract.test.ts
pnpm typecheck
pnpm lint
pnpm build:advjs
pnpm build:demo:hamster
```

Before release, also verify:

- 16 chapters complete in one run and banned metadata text is absent from rendered story/title/HUD;
- 回声演算 is hidden before completion and survives refresh afterward;
- all referenced IDs exist and CG/animation/BGM metadata passes audit;
- five alpha QA sheets have no face/body holes, sprite anchors do not jump, contact sheets share one art direction, and BGM has no clipping or obvious loop pop;
- COS GET/HEAD/CORS and immutable metadata pass for every object;
- desktop/mobile Playwright screenshots cover title, dialogue, narration, three-character staging, activities, settings, gallery, save/load/rollback, and finale;
- Studio selectors, command previews, line diagnostics, current CG, tachie slots, and ordered Effects remain usable.
