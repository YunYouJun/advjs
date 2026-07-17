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

### 4. Normalize release derivatives

- Export tachie with alpha, consistent canvas dimensions, ground line, and framing.
- Export backgrounds and CG in the game's target aspect ratio.
- Prefer WebP for broad browser compatibility; add AVIF only when the runtime provides a tested fallback.
- Strip unnecessary metadata while retaining provenance in the manifest.
- Compute SHA-256 after final optimization and include an 8–64 character prefix in the public filename.

Do not publish editable source files, rejected generations, or secret prompts embedded with credentials.

### 5. Validate the manifest

Run:

```bash
node skills/adv-art/scripts/audit-assets.mjs <project>/adv/assets.json
```

Require exit code `0` and an empty `errors` list before replacing local placeholders or publishing.

### 6. Publish safely

Read [references/cos-publishing.md](references/cos-publishing.md) when the target is Tencent COS. Delegate bucket inspection, CORS changes, upload, and HEAD verification to the `tencent-cloud-cos` Skill rather than copying its SDK or credential workflow.

Publish immutable objects first, verify their metadata and public reads, then update the manifest/config. Never overwrite an object at a URL already shipped with an immutable cache policy.

### 7. Integrate and playtest

Update character `avatar`/`tachies`, scene backgrounds, and CG references from logical manifest entries. Verify missing-media fallbacks, cross-origin Canvas/WebGL use, common viewport crops, transitions, and expression changes in a real browser. Run `adv-debug` and game E2E tests after asset replacement.

## Completion rules

- Every shipped asset has a logical ID, dimensions, byte size, SHA-256, provenance, license, and immutable URL.
- Every declared required expression has exactly one matching character asset.
- Public URLs are versioned and content-hashed; never use `latest/` in game configuration.
- Credentials never enter source control, prompts, manifests, logs, or Skill files.
- Generated art is not accepted solely because generation succeeded; visual inspection is mandatory.
