---
name: adv-hamster-demo
description: Maintain the repository-only demo/hamster flagship showcase. Use when changing its seamless 16-chapter route, postgame Echo Simulation, cast/staging, generated art and music, ADV.JS capability demonstrations, or assets published under cos.advjs.yunle.fun/games/hamster/v1/.
---

# ADV Hamster Demo

Apply the fixed decisions for `demo/hamster` without leaking game-specific constants into reusable ADV.JS workflows.

## Required procedure

1. Read [references/demo-contract.md](references/demo-contract.md) completely before changing story, characters, scenes, images, audio, configuration, or deployment paths.
2. Use `adv-adapt` for source coverage, author-metadata separation, source anchors, cast/scene inventories, and the scene-by-scene staging table.
3. Use `adv-art` for the art bible, connected-region keying, five-background alpha QA, expression/CG/background contact sheets, sprite validation, asset manifest, and release audit.
4. Use `tencent-cloud-cos` only for credential-safe COS inspection and publication.
5. Run `adv-debug` for structural facts, then use `adv-review` for chapter-level fidelity before browser playtesting.
6. Run deterministic audits and browser playtesting before calling the demo complete.

## Fixed boundaries

- The playable story is one seamless 16-chapter route. Do not show source division, forewords, postscripts, author notes, adaptation labels, “A+”, or “canon” terminology in the title, chapter map, HUD, or dialogue.
- Source author/title/links appear only in the About page and license documentation. Internal traceability remains in `adv/adaptation.json` and source comments.
- “回声演算” is a world-internal postgame route and is hidden until completion persists.
- The public asset root is `https://cos.advjs.yunle.fun/games/hamster/v1/`.
- The heroine/observer never wears glasses. The assistant/reader also does not require glasses. Preserve each character's approved outfit and silhouette across expressions and CGs.
- Ship 8 stable-ID CGs, 8 reusable loopable BGM motifs, 15 reusable backgrounds, 28 standing variants, and the hamster's six-frame running spritesheet unless the contract is deliberately versioned.
- 禁止把任何 COS 凭证、临时令牌或私有源文件写入仓库。禁止在配置中使用 `latest/` 或覆盖已经按 immutable 缓存发布的对象。
- Keep generic adaptation, image-generation, runtime, and COS instructions in their owning Skills; this Skill stores only demo-specific paths and acceptance gates.
