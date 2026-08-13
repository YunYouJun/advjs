---
name: adv-art
description: Plan, generate, normalize, validate, and publish visual assets for an ADV.JS game. Use when creating character tachie and expression variants, backgrounds, CG illustrations, thumbnails, or an asset manifest; replacing placeholders with original artwork; preparing immutable CDN/COS object paths; or auditing provenance, licenses, dimensions, hashes, and required expressions.
---

# ADV Art Pipeline

Turn story requirements into reproducible, licensed, runtime-ready visual assets. Keep logical asset identity separate from versioned public URLs.

## Workflow

### 1. Freeze an art bible

Read character cards, scene cards, the story outline, and existing UI proportions. Define:

- shared style, line quality, palette, lighting, period, camera language, and prohibited motifs;
- character silhouette, body proportions, clothing, fixed accessories, color swatches, and pose rules;
- a required expression matrix per visible character;
- background aspect ratios and which moments require one-off CG rather than reusable scenery.

Do not generate final images until the recurring character design and expression names are stable.

### 2. Plan logical assets

Use stable lowercase IDs. Keep pose and expression names semantic (`standing/sad`), not sequential (`image-07`). Add every required character expression to the manifest before generation so missing variants are detectable.

Read [references/asset-manifest.md](references/asset-manifest.md) before creating the manifest.

### 3. Generate and review originals

When an image-generation capability is available, generate original assets from the art bible and each card's `imagePrompt`. Keep character identity, outfit, crop, lighting, and transparent-background requirements explicit in every expression request.

Inspect each result before accepting it. Reject identity drift, accidental text, extra limbs, clipped ears/hands/tails, inconsistent costume details, opaque halos, or backgrounds embedded in tachie. Preserve the model/tool name, prompt version, generation date, and content license in provenance metadata.

For scene backgrounds in a local Codex workflow, read [references/codex-authoring.md](references/codex-authoring.md) and use the task/candidate protocol. Codex built-in image generation is the preferred first executor when available, but it is not part of the asset domain contract. A successful generation is only a candidate; never register it before the user visually confirms that exact file.

### 4. Normalize release derivatives

- Export tachie with alpha, consistent canvas dimensions, ground line, and framing.
- For generated transparency, choose a flat chroma color with strong separation from the subject. Remove only color regions connected to canvas edges; never erase every similar pixel across the image, because faces, eyes, fabric highlights, or accessories may share the key hue. Apply spill removal and feathering only around the resulting alpha boundary.
- Use `scripts/key-connected-chroma.mjs` for the repository hamster pipeline or implement the same edge-connected flood-fill contract. Generate checker, black, white, warm, and cool composites plus an alpha report. Reject face/body holes, opaque mats, colored halos, and disconnected floating pixels.
- Export backgrounds and CG in the game's target aspect ratio.
- Build one background contact sheet and one CG contact sheet. Review palette, line quality, camera height, light direction, saturation, and prohibited foreground characters across the full set rather than accepting images one at a time.
- For spritesheets, normalize every frame to the same canvas, visual volume, bottom-center anchor, ground line, and shadow. Record frame width/height, count, FPS, loop policy, and total sheet dimensions; preview the actual runtime animation before release.
- Prefer WebP for broad browser compatibility; add AVIF only when the runtime provides a tested fallback.
- Strip unnecessary metadata while retaining provenance in the manifest.
- Compute SHA-256 after final optimization and include an 8–64 character prefix in the public filename.

Do not publish editable source files, rejected generations, or secret prompts embedded with credentials.

### 5. Prepare the release

When an adaptation inventory and normalized WebP directory are available, generate content-hashed objects and the manifest together:

```bash
node skills/adv-art/scripts/prepare-release.mjs \
  --adaptation <project>/adv/adaptation.json \
  --asset-root <local-art-root> \
  --release-root <local-release-root> \
  --manifest <project>/adv/assets.json \
  --cos-release-plan <project>/adv/cos-release.json \
  --public-base-url https://assets.example.com/ \
  --object-prefix games/example/v1/ \
  --license 'CC BY-NC-SA 4.0' \
  --model imagegen-built-in \
  --prompt-version example-art-bible-v1 \
  --created-at 2026-07-17
```

The local art root may contain `characters/{id}/standing/{expression}.webp`, `characters/{id}/animations/{state}.webp`, `backgrounds/{scene-id}.webp`, `cg/{shot-id}.webp` with thumbnails, and `audio/bgm/{track-id}.ogg`. The script fails on missing declared assets or invalid sprite dimensions, reads image/audio metadata, computes SHA-256, copies hashed release objects, writes `assets.json`, copies the stable public manifest, and emits a credential-free `cos-release.json` with exact upload order and HTTP metadata.

Run its regression tests after changing release behavior:

```bash
pnpm vitest run skills/adv-art/tests/prepare-release.test.mjs
```

### 6. Validate the manifest

Run:

```bash
node skills/adv-art/scripts/audit-assets.mjs <project>/adv/assets.json
node skills/adv-art/scripts/audit-cos-release.mjs <project>/adv/cos-release.json <local-release-root>
node skills/adv-art/scripts/audit-cos-remote.mjs <project>/adv/cos-release.json
```

The first two commands validate the local catalog and exact upload plan. Run the remote audit after publication; it downloads every current object, recomputes SHA-256, sends identity-encoded HEAD requests, and verifies MIME, cache semantics, byte length, checksum metadata, GET/HEAD CORS, and exposed headers. Require exit code `0` and an empty `errors` list before replacing local placeholders or declaring publication complete.

### 7. Publish safely

Read [references/cos-publishing.md](references/cos-publishing.md) when the target is Tencent COS. Delegate bucket inspection, CORS changes, upload, and HEAD verification to the `tencent-cloud-cos` Skill rather than copying its SDK or credential workflow.

Publish immutable objects first, verify their metadata and public reads, then update the manifest/config. Never overwrite an object at a URL already shipped with an immutable cache policy.

### 8. Integrate and playtest

Update character `avatar`/`tachies`, scene backgrounds, and CG references from logical manifest entries. Verify missing-media fallbacks, cross-origin Canvas/WebGL use, common viewport crops, transitions, and expression changes in a real browser. Run `adv-debug` and game E2E tests after asset replacement.

## Completion rules

- Every shipped asset has a logical ID, dimensions or audio duration, byte size, SHA-256, provenance, license, and immutable URL.
- Every declared required expression has exactly one matching character asset.
- Public URLs are versioned and content-hashed; never use `latest/` in game configuration.
- Credentials never enter source control, prompts, manifests, logs, or Skill files.
- Generated art is not accepted solely because generation succeeded; visual inspection is mandatory.
