# Codex local asset authoring

Use this workflow for a background whose scene card already contains `imagePrompt`. It keeps generation providers replaceable and prevents rejected output from changing the game.

## Prerequisite

The recommended installation is:

```bash
adv agent install --client codex --skills default --mcp
adv doctor . --client codex
```

Prefer the four `adv_asset_*` MCP tools when they are available. The equivalent CLI commands are shown below for recovery and transparent debugging.

## 1. Plan a task

Call `adv_asset_plan_background` with the scene ID, or run:

```bash
adv assets plan --scene <scene-id> --width 1536 --height 864 --json
```

Use the returned prompt, target, task ID, and candidate directory. Do not invent a second prompt source when the scene already declares `imagePrompt`.

## 2. Generate with Codex

Use Codex built-in image generation as the first executor when available. Generate one asset or intentional variant per call. Keep the scene ID, visual-novel background purpose, target aspect ratio, no-text rule, and any no-character rule explicit.

Built-in generation writes under `$CODEX_HOME/generated_images`. Inspect the output there, then copy the selected file into the returned project-relative candidate directory using a new non-conflicting filename. Do not edit, delete, or move the original generated file. Do not copy credentials or absolute source paths into task metadata.

For another provider, follow the same copy boundary and record a different executor ID. The task protocol must not branch by provider.

## 3. Ingest and preview

Call `adv_asset_ingest_candidate` with the task ID, project-relative candidate path, executor ID `codex-imagegen`, and model `imagegen-built-in`; or run:

```bash
adv assets ingest \
  --task <task-id> \
  --candidate <project-relative-candidate-path> \
  --executor codex-imagegen \
  --model imagegen-built-in \
  --json
```

Ingestion validates task ownership, path containment, regular-file status, PNG/JPEG/WebP signatures, readable dimensions, byte length, and SHA-256. It still does not change `adv/assets.json`, a scene card, or any formal asset directory.

Show the exact ingested candidate to the user. Compare it with the task target and art bible. Ask for explicit acceptance or a rejection reason. Do not infer acceptance from silence, generation success, or a general request to continue.

## 4. Reject or accept

For rejection, call `adv_asset_reject_candidate` or run:

```bash
adv assets reject --task <task-id> --candidate-id <candidate-id> --reason '<reason>' --json
```

The task remains reusable for another generated candidate and no formal files are created.

Only after the user visually accepts the exact candidate, call `adv_asset_accept_candidate` with `confirm: true`, or run:

```bash
adv assets accept --task <task-id> --candidate-id <candidate-id> --confirm --json
```

If the stable asset ID already points to different content, stop and ask for separate replacement approval. Pass `replaceExisting: true` or `--replace-existing` only after that approval.

Acceptance writes a content-hashed immutable file below `adv/assets/`, updates the canonical inline or split catalog, binds the scene through `assetId`, and writes an accepted-generation receipt below `adv/generations/`. The operation uses optimistic conflict checks and rollback; if Editor or another process changed a planned file, reload and review the conflict instead of overwriting it.

## 5. Verify

Run:

```bash
adv check
adv doctor . --client codex
```

Refresh Editor preview. Its existing external-file watcher should surface the accepted catalog, scene, and binary changes; resolve any Editor conflict before further writes.
