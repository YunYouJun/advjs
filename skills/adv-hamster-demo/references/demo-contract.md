# `demo/hamster` contract

## 1. Sources and order

The canonical adaptation target is the following sequence:

1. `hamster` — YunYouJun, 《仓鼠》
   - Published page: `https://www.yunyoujun.cn/posts/hamster`
   - Repository source: `https://raw.githubusercontent.com/YunYouJun/yunyoujun.github.io/master/pages/posts/hamster.md`
2. `the-common-hamster` — YunYouJun, 《仓生》
   - Published page: `https://www.yunyoujun.cn/posts/the-common-hamster`
   - Repository source: `https://raw.githubusercontent.com/YunYouJun/yunyoujun.github.io/master/pages/posts/the-common-hamster.md`

The second work identifies itself as a continuation of the first. Never reverse them or present them as unrelated routes. Record the fetched revision/commit in `demo/hamster/adv/adaptation.json` before final fidelity review.

## 2. A+ mode

### Canonical mode

- Make canonical mode the first-play default.
- Map every heading-level source section, including foreword/postscript sections unless the content owner explicitly excludes one.
- Allow choices to vary perspective, optional dialogue, presentation, and traceable state, then rejoin before the next required source anchor.
- Do not allow a choice, activity failure, or media failure to skip a required source section.
- Continue from the end of 《仓鼠》 into 《仓生》 as one ordered work.

### Interpretive mode

- Unlock only after canonical completion has persisted successfully.
- Reuse `star-map/compare`, `civilization/initialize`, conditions, actions, cross-chapter navigation, save/load, checkpoint, rollback, history, read-state, and Inspector trace where they serve the story.
- Keep all new routes labeled as non-canonical in the adaptation manifest.
- Provide at least three reachable endings and explain their conditions through player-observable state and runtime diagnostics.

## 3. Public asset root

Use only:

```text
https://cos.advjs.yunle.fun/games/hamster/v1/
```

Object keys:

```text
games/hamster/v1/characters/{character-id}/{pose}/{expression}.{hash}.webp
games/hamster/v1/backgrounds/{scene-id}.{hash}.webp
games/hamster/v1/cg/part-01/{shot-id}.{hash}.webp
games/hamster/v1/cg/part-02/{shot-id}.{hash}.webp
games/hamster/v1/audio/bgm/{track-id}.{hash}.ogg
games/hamster/v1/audio/sfx/{sound-id}.{hash}.ogg
games/hamster/v1/manifests/assets.json
```

禁止在配置中使用 `latest/`。禁止在 Skill、manifest、源码、提交、日志或对话中记录 COS 凭证。Use `tencent-cloud-cos` with least-privilege or STS credentials for publication.

## 4. Art minimums

- Build the full cast from both source works before generating final art.
- Every visible speaking character needs a `.character.md` card and a manifest entry.
- Recurring principal characters require `default`, `smile`, `curious`, `worried`, `sad`, and `determined` unless the art bible records why an expression is inapplicable.
- Character variants share identity, outfit, transparent canvas, scale, and ground line.
- Each reusable location/time variant has a scene card and background requirement.
- Key source moments may use `cg/part-01` or `cg/part-02`; a CG never replaces a reusable background definition.

## 5. Required checks

Run source traceability:

```bash
node skills/adv-adapt/scripts/audit-coverage.mjs \
  demo/hamster/adv/adaptation.json \
  demo/hamster/public/md/chapters
```

Run asset completeness:

```bash
node skills/adv-art/scripts/audit-assets.mjs demo/hamster/adv/assets.json
```

Run project/runtime checks:

```bash
adv check --root demo/hamster/adv
adv debug coverage --root demo/hamster/adv --format=json
pnpm vitest run tests/unit/hamster-demo-runtime.test.ts
pnpm build:demo:hamster
pnpm exec playwright test tests/e2e/hamster.spec.ts
```

Before release, also verify:

- required source coverage is 100%, with no missing, duplicate, or unknown anchors;
- canonical mode reaches the end of both works without entering interpretive-only content;
- interpretive mode remains locked before canonical completion and persists afterward;
- every required character expression exists in the asset manifest and responds with HTTP 200;
- `ASSETS.md` and `LICENSE.content.md` distinguish source prose, adaptation additions, generated art, fonts/icons, and audio;
- Studio compilation, diagnostics, playtest Inspector, and recent trace remain usable with the full script set.
