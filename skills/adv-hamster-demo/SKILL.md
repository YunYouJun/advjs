---
name: adv-hamster-demo
description: Maintain the repository-only demo/hamster showcase adapted from YunYouJun's sequential works hamster and the-common-hamster. Use when changing its canonical A+ story, chapter/cast/source coverage, character expressions, generated art, ADV.JS capability demonstrations, or assets published under cos.advjs.yunle.fun/games/hamster/v1/.
---

# ADV Hamster Demo

Apply the fixed decisions for `demo/hamster` without leaking game-specific constants into reusable ADV.JS workflows.

## Required procedure

1. Read [references/demo-contract.md](references/demo-contract.md) completely before changing story, characters, scenes, images, audio, configuration, or deployment paths.
2. Use `adv-adapt` for source order, manifest, source anchors, cast/scene inventories, and fidelity review.
3. Use `adv-art` for the art bible, expression matrix, generated derivatives, asset manifest, and release validation.
4. Use `tencent-cloud-cos` only for credential-safe COS inspection and publication.
5. Run `adv-debug` before `adv-review`; replay accepted revisions with `adv-story`.

## Fixed boundaries

- Canonical mode covers 《仓鼠》 before 《仓生》; interpretive routes unlock only after canonical completion.
- The public asset root is `https://cos.advjs.yunle.fun/games/hamster/v1/`.
- 禁止把任何 COS 凭证、临时令牌或私有源文件写入仓库。
- 禁止在游戏配置中使用 `latest/` 或覆盖已经按 immutable 缓存发布的对象。
- Keep generic adaptation, image-generation, and COS instructions in their owning Skills; this Skill stores only the demo contract and acceptance gates.
