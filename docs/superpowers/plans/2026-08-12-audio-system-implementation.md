# Multi-track Audio and AI Voice Implementation Plan

> Status: in progress. The compatibility BGM lifecycle baseline is complete; the unified AudioEngine tasks below have not started.

**Goal:** Replace the BGM-only orchestration with a deterministic multi-track AudioEngine, add asset-addressed BGM/ambience/voice/SFX/UI semantics, and deliver Git-friendly AI voice authoring in Editor and Studio.

**Architecture:** `@advjs/types` owns JSON-only contracts. A new platform-neutral `@advjs/audio` package owns ledger, ID, fingerprint, Provider capability, object-key, queue and mixer domain logic. Core compiles audio authoring data into deterministic Runtime state/effects. Client owns Audio Director, Mixer and browser/test backends. Editor and Studio consume shared authoring services and write the same project files.

**Tech Stack:** TypeScript, Vue 3, Nuxt, Ionic Vue, Web Audio API, HTMLMediaElement, Vitest, Vue Test Utils, Playwright, Tencent COS/STS, capability-checked FFmpeg for local preview and a build-fingerprint/image-digest-locked FFmpeg toolchain for release.

**Design:** [`2026-08-12-audio-system-design.md`](../specs/2026-08-12-audio-system-design)

## Implemented migration baseline

Before the breaking migration starts, the existing `useAdvBgm` path now provides a deterministic compatibility baseline:

- only the logical active track is selected for a new retirement; earlier crossfade retirements keep their original envelope;
- stop semantics affect the current authored track rather than every physical track still fading out;
- mute and unmute cover every physical track participating in a crossfade without resetting its volume envelope;
- generation checks prevent stale fade callbacks from unloading a track selected again;
- back, forward and restore reselect saved BGM with the fixed 120ms history fade;
- dispose unloads active and retiring tracks;
- Studio builds against an embed-safe client surface and injects its runtime plugins explicitly.

The regression seam is `tests/unit/client-bgm.test.ts` plus `tests/unit/client-runtime-presentation.test.ts`. This baseline does not complete Task 4 or Task 5: there is still no shared Audio Director, Mixer, Fake Backend, Browser Backend, multi-bus runtime or `useAdvAudio()` API.

## Global constraints

- This is a breaking migration. Do not add a second runtime interpreter for old audio fields.
- Generate a migration report before modifying source content. Unresolved references stop the migration.
- Runtime Program, Snapshot, effects and trace remain JSON-only.
- No production build, check or test may call paid TTS APIs or upload COS objects.
- Tests use Fake Provider, Fake Backend and Fake Object Storage by default.
- API keys, SecretId, SecretKey, STS Token and signed URLs never enter project files, snapshots, fixtures, logs or reports.
- Existing unrelated worktree changes must remain untouched.
- Every task must leave the selected package buildable and its focused tests green.
- Before implementation starts, verify every listed package name and script against its `package.json`; when a task creates a package, creating and testing its build script is part of that task.
- Do not deploy, push, or mutate external task systems as part of this plan.

---

## Task 1: Freeze audio schemas, IDs and project files

**Files:**

- Create: `packages/types/src/audio/runtime.ts`
- Create: `packages/types/src/audio/assets.ts`
- Create: `packages/types/src/audio/voice.ts`
- Create: `packages/types/src/audio/mixer.ts`
- Create: `packages/types/src/audio/toolchain.ts`
- Create: `packages/types/src/audio/index.ts`
- Modify: `packages/types/src/index.ts`
- Modify: `packages/types/src/config/assets.ts`
- Modify: `packages/types/src/game/character.ts`
- Create: `packages/audio/package.json`
- Create: `packages/audio/build.config.ts`
- Create: `packages/audio/src/index.ts`
- Create: `packages/audio/src/schema.ts`
- Modify: `tsconfig.json`
- Modify: root `package.json` build order
- Modify: consuming package manifests
- Test: `tests/unit/audio-contracts.test.ts`

**Contract:**

- Define `AudioAssetKind = 'bgm' | 'ambience' | 'voice' | 'sfx' | 'ui'`.
- Define branded or validated `AudioAssetId`, `AudioLineId`, `AudioTakeId` and `AudioLocale` strings.
- Define `CharacterVoiceProfile`, `VoiceLedger`, `VoiceTake`, `AudioMixerConfig` and runtime audio state/effect types.
- Reserve `source: 'cloned'` while requiring rights metadata; do not expose clone generation.
- Set target project files to `adv/assets/audio.json`, `adv/audio/mixer.json`, `adv/audio/toolchain.json` and `adv/audio/voice-ledger.json`.
- Define `adv/audio/toolchain.json` with its own schema version, platform toolchain profile ID, release FFmpeg build fingerprint and worker image digest.
- Use schema versions in every independently loaded JSON document.
- Freeze Markdown line identity as a final `{#line_<uuidv7>}` token on the last physical line of one dialogue or narration node; Parser removes it from display/spoken text and Flow uses `AdvDialogNode.lineId`.
- Require ledger lines to store `speakerId`. Character dialogue uses `characterId`; narration uses the reserved `narrator` project Voice Profile.
- Require every take to freeze `providerId`, actual `voiceId`, model, Provider voice source and `voiceProfileRevision`.
- Define semantic UI cue mapping (`confirm`, `cancel`, `hover`, `notification`) in mixer config; UI components emit cue names, not physical URLs.
- Declare `@advjs/types` as the audio package's workspace dependency and add `@advjs/audio` only to packages that consume its domain logic.
- Insert `@advjs/audio` after `@advjs/types` and before Core/Client consumers in ordered builds.

- [ ] Write contract tests for valid examples, unknown keys where strictness is required, duplicate IDs, invalid UUIDv7 prefixes and locale normalization.
- [ ] Test that serialization never includes `undefined`, Map, Set, class instances or functions.
- [ ] Test that no schema property can store credentials or signed URLs.
- [ ] Add Markdown dialogue/narration and Flow line-ID parse/serialize fixtures before later compiler work.
- [ ] Test narrator and character take records plus Voice Profile revision staleness.
- [ ] Test valid, missing, malformed, unknown-profile and digest-mismatch toolchain locks; invalid locks allow preview but block release.
- [ ] Implement runtime validators in `@advjs/audio` without Vue, DOM or Node-only dependencies.
- [ ] Export shared types and validators.
- [ ] Run:

```bash
pnpm vitest run tests/unit/audio-contracts.test.ts
pnpm --filter @advjs/types build
pnpm --filter @advjs/audio build
pnpm build:advjs
```

Suggested commit:

```text
feat(audio): define shared audio contracts
```

## Task 2: Add deterministic IDs, fingerprints and object keys

**Files:**

- Create: `packages/audio/src/ids.ts`
- Create: `packages/audio/src/fingerprint.ts`
- Create: `packages/audio/src/object-key.ts`
- Create: `packages/audio/src/locale.ts`
- Test: `tests/unit/audio-identity.test.ts`

**Contract:**

- Generate prefixed UUIDv7 IDs for line, take, asset and job records.
- Normalize project-file locale to canonical BCP 47 and object-key locale to lowercase.
- Fingerprint canonical spoken text, locale, speaker voice binding, model and generation parameters.
- Build the canonical shape:

```text
{projectPrefix}/audio/voice/{locale}/{speakerId}/{lineId}/{takeId}.{hash}.{ext}
```

- Validate ASCII slugs for project and speaker path segments; ordinary speaker IDs equal character IDs and narration uses the reserved `narrator` value.
- Never derive IDs from display names, line numbers or prose.

- [ ] Add fixed-clock UUID ordering tests and collision-boundary tests.
- [ ] Add locale cases for `zh-CN`, `ja-JP`, script tags and invalid input.
- [ ] Add canonical JSON ordering tests for fingerprints.
- [ ] Verify fingerprint changes when the frozen Voice Profile revision, actual voice ID or speaker changes.
- [ ] Add path traversal, Unicode display-name and reserved-character rejection tests.
- [ ] Verify voice keys place locale before speaker, including `narrator`, while shared BGM/ambience/SFX/UI keys have no locale segment.
- [ ] Run:

```bash
pnpm vitest run tests/unit/audio-identity.test.ts
```

Suggested commit:

```text
feat(audio): add stable audio identity helpers
```

## Task 3: Compile canonical audio operations and stable dialogue IDs

**Files:**

- Modify: `packages/types/src/runtime/state.ts`
- Modify: `packages/types/src/runtime/program.ts`
- Modify: `packages/types/src/flow/node.ts`
- Modify: `packages/parser/src/` dialogue parsing and serialization modules
- Modify: `packages/core/src/compiler/markdown.ts`
- Modify: `packages/core/src/compiler/flow.ts`
- Modify: `packages/core/src/runtime/transition.ts`
- Modify: `packages/core/src/runtime/snapshot.ts`
- Modify: `packages/core/src/runtime/presentation.ts`
- Test: `packages/core/test/runtime/markdown-compiler.test.ts`
- Test: `packages/core/test/runtime/flow-compiler.test.ts`
- Test: `packages/core/test/runtime/transition.test.ts`
- Test: `tests/unit/runtime-audio-state.test.ts`

**Contract:**

- Compile `bgm set/clear` and `ambience set/clear` into persistent target stage state.
- Compile `sfx play` into transient effects only.
- Resolve voice from the current dialogue `lineId` and selected runtime asset.
- Reject `src`, `bgmSrc`, implicit BGM library names and Provider URLs.
- Preserve stable line IDs through Markdown parse/serialize and Flow round trips.
- Restore BGM and ambience from snapshots; never persist SFX/UI playback handles or voice progress.

- [ ] Write failing compiler tests for every canonical operation and invalid action/asset/slot/fade.
- [ ] Write duplicate and malformed line-ID diagnostics with source locations.
- [ ] Write snapshot tests proving persistent and transient separation.
- [ ] Write back/restore tests proving SFX is not replayed.
- [ ] Add explicit audio diagnostic codes and map them through `adv check`.
- [ ] Run:

```bash
pnpm vitest run packages/core/test/runtime/markdown-compiler.test.ts
pnpm vitest run packages/core/test/runtime/flow-compiler.test.ts
pnpm vitest run packages/core/test/runtime/transition.test.ts
pnpm vitest run tests/unit/runtime-audio-state.test.ts tests/unit/check-runtime.test.ts
```

Suggested commit:

```text
feat(runtime): compile canonical audio effects
```

## Task 4: Implement Audio Director, Mixer and Fake Backend

**Files:**

- Create: `packages/client/audio/contracts.ts`
- Create: `packages/client/audio/director.ts`
- Create: `packages/client/audio/mixer.ts`
- Create: `packages/client/audio/concurrency.ts`
- Create: `packages/client/audio/cache.ts`
- Create: `packages/client/audio/testing/fake-backend.ts`
- Create: `packages/client/audio/index.ts`
- Modify: `packages/client/package.json` exports as needed
- Test: `tests/unit/audio-director.test.ts`
- Test: `tests/unit/audio-mixer.test.ts`
- Test: `tests/unit/audio-concurrency.test.ts`

**Contract:**

- Audio Director is the only owner of logical track generations and lifecycle.
- Music has one logical active target and may retain retiring physical sources during crossfade.
- Ambience uses named slots with a default maximum of four.
- Voice has one foreground target; a new line cancels the previous generation.
- SFX uses a global limit of 16 plus configurable group limits and deterministic victim selection.
- UI has its own bus and is not stopped by story pause/back.
- Voice ducks music and ambience only.
- Every async method accepts or creates a generation token/`AbortSignal`.

- [ ] Reproduce the current fade completion race using Fake Backend deferred callbacks.
- [ ] Cover A→B→A, stop during fade, same asset replay, zero-volume fade, load failure, ended-after-stop and dispose-after-load.
- [ ] Cover ambience same-slot replacement and cross-slot layering.
- [ ] Cover SFX priority/age victim selection.
- [ ] Cover duck attack/release and nested voice start/stop idempotency.
- [ ] Ensure stale callbacks cannot mutate director state or revive a stopped track.
- [ ] Run:

```bash
pnpm vitest run tests/unit/audio-director.test.ts tests/unit/audio-mixer.test.ts tests/unit/audio-concurrency.test.ts
```

Suggested commit:

```text
feat(client): add deterministic audio director
```

## Task 5: Add browser backend, migrate repository audio and replace BGM orchestration

**Files:**

- Create: `packages/client/audio/browser/context.ts`
- Create: `packages/client/audio/browser/media-source.ts`
- Create: `packages/client/audio/browser/buffer-source.ts`
- Create: `packages/client/audio/browser/backend.ts`
- Create: `packages/client/composables/useAdvAudio.ts`
- Modify: `packages/client/runtime/effects.ts`
- Modify: `packages/client/setup/context.ts`
- Modify: `packages/client/types/context.ts`
- Modify: `packages/client/stores/audio.ts`
- Modify: `packages/client/components/menu/settings/AudioVolume.vue`
- Create: `packages/advjs/node/commands/migrate-audio.ts`
- Create: `packages/advjs/node/commands/migrate-audio.schema.ts`
- Extend: `packages/advjs/node/cli/` migration command registration
- Create: migration fixtures with resolvable, ambiguous, missing, dirty and already-canonical inputs
- Modify: repository project/demo/theme audio references reported by migration inventory
- Delete after migration: `packages/client/composables/useAdvBgm.ts`
- Delete or replace after migration: Howler-specific sound composables in `packages/client/composables/sound/` and `packages/core/src/composables/sound/`
- Test: `tests/unit/client-audio-host.test.ts`
- Test: `tests/unit/audio-migration.test.ts`
- Test: `tests/e2e/audio-runtime.spec.ts`

**Contract:**

- Use MediaElement sources for long/streamed BGM, ambience and long voice.
- Use decoded AudioBuffer sources for short SFX/UI.
- Route every source through the shared Web Audio bus graph.
- Unlock AudioContext on the first accepted user gesture.
- Queue still-current requests while locked; discard expired voice requests.
- Prefetch current plus two following voice lines and cancel on locale/chapter/restore changes.
- Use bounded LRU for decoded buffers.
- Expose a thin `useAdvAudio()` API; no Vue component owns track maps.
- Resolve semantic UI cues from project/theme mixer configuration and route them to the ui bus without Runtime story operations.
- Dry-run emits versioned report, resolution and journal schemas before any repository apply.
- Apply generates all outputs in memory, validates the target project, writes same-directory temporary files, atomically replaces, and restores this run's writes from the journal after failure.
- Untracked overwritten inputs are copied to an ignored backup directory; canonical re-runs produce an empty change set.
- Before deleting legacy code, run the fully tested migration dry-run and apply it to all repository-owned projects, demos and themes.

- [ ] Add browser adapter unit tests with fake AudioContext and media elements.
- [ ] Migrate runtime effect handling to Audio Director.
- [ ] Migrate player settings to six buses and device-scoped persistence.
- [ ] Freeze report, resolution and journal schemas with golden tests.
- [ ] Implement `adv migrate audio --report` and `--resolutions ... --apply` with unresolved blocking, atomic commit, rollback, untracked backup and idempotent re-run.
- [ ] Pass crash-during-commit and backup-recovery tests before the first repository apply.
- [ ] Migrate repository content, then replace every production `$bgm`/`useAdvBgm` consumer in the same task.
- [ ] Validate canonical content before deleting the old Runtime/BGM paths.
- [ ] Verify `rg 'useAdvBgm|\\$bgm|bgmSrc' packages apps editor themes` has no production result.
- [ ] Remove Howler if no remaining consumer requires it; otherwise document its isolated adapter scope.
- [ ] Run:

```bash
pnpm vitest run tests/unit/client-audio-host.test.ts tests/unit/client-runtime-presentation.test.ts tests/unit/audio-migration.test.ts
pnpm exec playwright test tests/e2e/audio-runtime.spec.ts
pnpm typecheck
```

Suggested commit:

```text
refactor(client): replace bgm orchestration with audio engine
```

## Task 6: Implement voice ledger, Voice Profile and Provider capabilities

**Files:**

- Create: `packages/audio/src/voice-ledger.ts`
- Create: `packages/audio/src/spoken-text.ts`
- Create: `packages/audio/src/provider.ts`
- Create: `packages/audio/src/rights.ts`
- Modify: `packages/parser/src/character.ts`
- Modify: `packages/parser/src/schemas/character.ts`
- Modify: `packages/types/src/game/character.ts`
- Refactor: `apps/studio/src/utils/ttsClient.ts`
- Refactor: `apps/studio/src/composables/usePluginRegistry.ts`
- Test: `tests/unit/voice-ledger.test.ts`
- Test: `tests/unit/character-voice-profile.test.ts`
- Test: `apps/studio/src/__tests__/ttsClient.test.ts`

**Contract:**

- Support Provider capability discovery for synthesis, catalog, design, clone, timestamps, emotion, streaming and formats.
- Store Provider-neutral voice intent on the character and locale-specific Provider bindings.
- Treat Web Speech as preview-only and reject it as a publishable take source.
- Store every take immutably; text/voice/model changes mark prior takes stale.
- Keep selected-take conflicts explicit.
- Normalize display text into spoken text and allow per-line override plus pronunciation dictionary.
- Require rights metadata for cloned sources before generation or publication.

- [ ] Add ledger parse/serialize/merge tests.
- [ ] Add stale fingerprint and cached-result reuse tests.
- [ ] Add character Markdown round-trip tests.
- [ ] Add Provider capability-driven UI projection tests without Provider-name switches.
- [ ] Add a hard failure test for clone without consent records.
- [ ] Run:

```bash
pnpm vitest run tests/unit/voice-ledger.test.ts tests/unit/character-voice-profile.test.ts
pnpm --filter @advjs/studio test:unit -- src/__tests__/ttsClient.test.ts
```

Suggested commit:

```text
feat(audio): add voice ledger and provider capabilities
```

## Task 7: Add generation queue and MiniMax adapter

**Files:**

- Create: `packages/audio/src/jobs/contracts.ts`
- Create: `packages/audio/src/jobs/planner.ts`
- Create: `packages/audio/src/jobs/reducer.ts`
- Create: `packages/audio/src/jobs/store.ts`
- Create: `packages/audio/src/providers/minimax.ts`
- Create: `editor/core/server/api/audio/` endpoints
- Create: Editor local application-data JobStore adapter
- Create: `apps/studio/cloudbase/functions/advjsAudio/`
- Create: CloudBase collections, indexes and security rules for audio jobs, items and idempotency
- Create: `apps/studio/src/utils/audioJobs.ts`
- Test: `tests/unit/audio-job-planner.test.ts`
- Test: `tests/unit/minimax-provider.test.ts`
- Test: `apps/studio/cloudbase/functions/advjsAudio/test/`

**Contract:**

- Plan jobs from missing/stale lines and fingerprint cache hits.
- Show line count, character count, cache hits and price estimate or explicit unknown.
- Enforce per-job character/cost limits and Provider concurrency.
- Support cancel, resume, retry and idempotency keys.
- MiniMax Adapter supports system voices and Voice Design; clone remains disabled.
- Hosted Editor/Studio call a trusted server endpoint; browser code never receives Provider secrets.
- Local Editor reads credentials through environment/system-secret adapters.
- Hosted jobs persist server-side; local Editor persists outside the project in OS application data; Studio offline jobs use non-exported IndexedDB state and reconcile with the server.
- Idempotency is unique on account/project/fingerprint and retained for at least 30 days.
- Resume reads durable item state; an unknown remote result is queried before retry.

- [ ] Write the pure queue reducer and planner before any network adapter.
- [ ] Use fixture responses for MiniMax tests; never call the live API.
- [ ] Verify retry does not bill or upload an already completed fingerprint twice.
- [ ] Add crash/restart, offline reconciliation, retention and duplicate-submit tests against the JobStore contract.
- [ ] Verify task logs redact authorization headers, prompts marked private and signed URLs.
- [ ] Verify hosted endpoints enforce account/project scope and quotas.
- [ ] Run:

```bash
pnpm vitest run tests/unit/audio-job-planner.test.ts tests/unit/minimax-provider.test.ts
pnpm --filter @advjs/studio test:unit
pnpm --filter @advjs/editor typecheck
```

Suggested commit:

```text
feat(audio): add controlled minimax generation jobs
```

## Task 8: Add non-destructive processing and COS publication

**Files:**

- Create: `packages/audio/src/processing.ts`
- Create: `packages/audio/src/release.ts`
- Create: `apps/audio-worker/package.json`
- Create: `apps/audio-worker/Dockerfile`
- Create: `apps/audio-worker/src/worker.ts`
- Create: `apps/audio-worker/src/ffmpeg-profile.ts`
- Modify: `packages/advjs/node/commands/doctor.ts`
- Extend: `plugins/plugin-cos/src/index.ts`
- Extend: `plugins/plugin-cos/test/asset-standard.test.ts`
- Extend: `apps/studio/cloudbase/functions/advjsAssets/`
- Create: `tests/unit/audio-release-plan.test.ts`
- Create: `tests/unit/audio-processing.test.ts`
- Create: `tests/fixtures/audio/` deterministic master and expected metadata fixtures
- Create: `apps/audio-worker/test/worker.test.ts`
- Extend: `tests/e2e/audio-runtime.spec.ts` with encoded-variant playback

**Contract:**

- Preserve immutable masters and generate publish variants with recorded tool version and parameters.
- Probe duration, sample rate, channels, loudness, peak, bytes, MIME and SHA-256.
- Use separate processing presets for voice, BGM, ambience and SFX/UI.
- Separate private master, public immutable and temporary job prefixes.
- Upload immutable objects first, verify with HEAD plus SHA-256, and update manifest last.
- Use STS or single-object signed upload with project/prefix/MIME/size constraints.
- Apply lifecycle cleanup only to temporary prefixes; unreferenced take GC requires an explicit reviewed plan.
- Use the same FFmpeg command templates locally and in the hosted worker, but only a build matching `adv/audio/toolchain.json` may create a release receipt.
- Name the private worker package `@advjs/audio-worker` and give it explicit `build` and fixture-test scripts.
- Publish Opus/WebM as the primary variant and AAC/M4A as the compatibility fallback; Asset Catalog capability selection chooses at runtime.
- Do not run long FFmpeg work inside a request/Cloud Function process.
- `adv doctor` must probe `ffmpeg`, `ffprobe`, `libopus`, AAC encoder and `loudnorm` support, then compare the full build fingerprint with the project toolchain lock. Missing capabilities block processing; a version/build mismatch permits preview only and offers the locked container/worker. It never silently changes codec or preset.
- The hosted Docker image pins FFmpeg by image digest and records `ffmpeg -version` in every processing receipt.
- Hosted services resolve the profile through a signed server allowlist and reject any project-supplied profile/digest pair that is not approved; they never pull an arbitrary image named by project data.
- Preview-only output from an unmatched local build cannot update release object keys, hashes or manifests.

- [ ] Implement a fake process runner and fixture audio metadata tests.
- [ ] Add real FFmpeg fixture tests that verify codec, duration, channels, sample rate, loudness and peak with ffprobe.
- [ ] Add mismatched-build tests proving local preview works but release receipt and manifest mutation are blocked.
- [ ] Add hostile/unknown image-digest tests proving the hosted service blocks the job before scheduling a container.
- [ ] Add Chromium and WebKit E2E playback for both primary and fallback variants.
- [ ] Add worker crash/retry tests proving content-hash outputs are idempotent and partial output is never published.
- [ ] Add object-key and HTTP metadata assertions for every audio kind.
- [ ] Add partial upload and manifest-last failure tests.
- [ ] Add a no-delete test for referenced masters/takes.
- [ ] Add secret scanning assertions over release plan and logs.
- [ ] Run:

```bash
pnpm vitest run tests/unit/audio-release-plan.test.ts tests/unit/audio-processing.test.ts
pnpm vitest run plugins/plugin-cos/test/asset-standard.test.ts
pnpm vitest run apps/audio-worker/test/worker.test.ts
pnpm --filter @advjs/audio-worker build
CI=1 pnpm exec playwright test tests/e2e/audio-runtime.spec.ts --project=chromium --project=webkit
```

Suggested commit:

```text
feat(audio): add immutable audio release pipeline
```

## Task 9: Build the professional Editor workflow

**Files:**

- Extend: `editor/core/app/components/panel/audio/AEAudioPanel.vue`
- Extend: `editor/core/app/stores/useAudioStore.ts`
- Extend: `editor/core/app/components/character/CharacterForm.vue`
- Extend: `editor/core/app/components/character/CharacterDetail.vue`
- Extend: `editor/core/app/components/system/flow/AdvFlowEditor.vue`
- Create: Editor components for Asset Library, Voice Jobs, Mixer, dialogue voice and audio inspector
- Create: Editor unit tests under `editor/core/test/` or root `tests/unit/` following existing convention
- Extend: `tests/e2e/editor-local.spec.ts`

**Contract:**

- Audio Studio has Asset Library, Voice Jobs and Mixer views.
- Character editor owns Voice Profile and candidate audition.
- Script editor shows line ID, locale, missing/stale/ready/failed, spoken text and takes inline.
- Scene/Flow editor configures BGM, ambience slots and SFX events using canonical operations.
- Inspector shows buses, ducking, tracks, concurrency and redacted trace.
- All edits write canonical project files and participate in normal save/diff flows.

- [ ] Add component tests for capability-driven fields and keyboard operation.
- [ ] Add source/visual round-trip tests for every audio operation.
- [ ] Add merge-conflict presentation for competing `selectedTake` values.
- [ ] Add preview simulations for locale, Auto, Skip, back and restore.
- [ ] Add an end-to-end local project journey without live TTS/COS.
- [ ] Run:

```bash
pnpm --filter @advjs/editor typecheck
pnpm --filter @advjs/editor build
pnpm exec playwright test tests/e2e/editor-local.spec.ts
```

Suggested commit:

```text
feat(editor): add visual audio authoring
```

## Task 10: Build the mobile Studio workflow

**Files:**

- Refactor: `apps/studio/src/views/workspace/AudioPage.vue`
- Extend: `apps/studio/src/components/AudioEditorForm.vue`
- Extend: `apps/studio/src/components/CharacterEditorForm.vue`
- Extend: Studio chapter/editor dialogue components
- Create: Studio Voice Job, take chooser and simplified mixer components
- Extend: `apps/studio/src/i18n/locales/en.json`
- Extend: `apps/studio/src/i18n/locales/zh-CN.json`
- Extend: `apps/studio/src/__tests__/audioMd.test.ts`
- Create: `apps/studio/src/__tests__/audioStudio.test.ts`
- Create: `apps/studio/tests/e2e/audio-authoring.spec.ts`

**Contract:**

- Keep `/tabs/workspace/audio` as the entry.
- Expose mobile-friendly asset, voice job, preview, selected take and publish status.
- Reuse shared ledger/provider/job/object-key logic.
- Offer simplified project mixer defaults; do not duplicate the full professional inspector.
- Preserve offline project behavior and queue work when connectivity is unavailable where safe.
- Never persist TTS or COS secrets in localStorage, IndexedDB project records or exported archives.

- [ ] Add responsive and accessibility component tests.
- [ ] Add offline/online transition and failed-upload recovery tests.
- [ ] Add project round-trip tests proving Editor-readable output.
- [ ] Add an E2E journey using Fake Provider and Fake Object Storage.
- [ ] Run:

```bash
pnpm --filter @advjs/studio test:unit
pnpm --filter @advjs/studio test:e2e -- audio-authoring.spec.ts
pnpm --filter @advjs/studio build
```

Suggested commit:

```text
feat(studio): add mobile audio authoring
```

## Task 11: Audit migration receipts and legacy removal

**Files:**

- Extend: `packages/advjs/node/commands/migrate-audio.ts`
- Extend: `packages/advjs/node/cli/` migration command registration
- Extend: migration fixtures with larger real-world project shapes
- Modify: `packages/advjs/node/commands/check.ts`
- Test: `tests/unit/audio-migration.test.ts`
- Test: launch golden project and demo conformance fixtures

**Contract:**

- Revalidate the versioned report, resolution, journal, atomic rollback and idempotency contracts implemented before Task 5's repository apply.
- Import media locally and generate catalog entries; never upload COS or delete original binaries.
- Keep the new Runtime free of old audio parsing after every later feature task.
- Surface migration receipts and unresolved diagnostics through `adv check` without creating a second compatibility path.

- [ ] Extend coverage with larger projects, multiple chapters, Flow plus Markdown and mixed tracked/untracked assets.
- [ ] Re-run unresolved, manual resolution, crash recovery, dirty-file and idempotency regression tests.
- [ ] Run dry-run again over every repository demo and save reports as test artifacts, not tracked project state.
- [ ] Verify the Task 5 repository migration left no production legacy reference.
- [ ] Run:

```bash
pnpm vitest run tests/unit/audio-migration.test.ts tests/unit/hamster-demo-runtime.test.ts
pnpm build:advjs
pnpm typecheck
pnpm lint
```

Suggested commit:

```text
test(cli): audit audio migration workflow
```

## Task 12: Complete diagnostics, docs and cross-host acceptance

**Files:**

- Extend: `packages/advjs/node/commands/check.ts`
- Extend: `packages/client/runtime/inspector.ts`
- Modify: `docs/guide/audio.md` to remove the implementation warning
- Modify: `docs/guide/advscript/code.md`
- Modify: `docs/guide/editor/character.md`
- Modify: `docs/guide/editor/flow.md`
- Modify: `docs/guide/assets/catalog.md`
- Modify: `docs/guide/assets/cos.md`
- Modify: `docs/superpowers/specs/2026-08-12-audio-system-design.md` status
- Extend: `tests/e2e/audio-runtime.spec.ts`
- Extend: host conformance and diagnostics tests

**Contract:**

- Errors block invalid identity, selected take, hash, rights, operation or published-integrity state.
- Warnings cover locale gaps, stale takes, recommended media quality and unpublished local-only assets.
- CLI, browser, Editor preview and Studio preview agree on persistent audio target state and effect sequence.
- Detailed production trace is opt-in and always redacted.
- Every public documentation example is backed by a parser/compiler fixture.

- [ ] Add error/warning diagnostic golden tests.
- [ ] Add cross-host effect and snapshot comparison.
- [ ] Add real-browser autoplay unlock, back/restore, locale switch and network-failure tests.
- [ ] Remove all “待实施” warnings only after features and tests pass.
- [ ] Run full verification:

```bash
pnpm vitest run
pnpm e2e
pnpm typecheck
pnpm lint
pnpm build
pnpm -C docs build
```

Suggested commit:

```text
docs(audio): publish audio authoring workflow
```

## Final audit

Before declaring the plan complete:

- [ ] `rg 'useAdvBgm|\\$bgm|bgmSrc|Compatibility escape hatch'` has no production audio compatibility path.
- [ ] Repository fixtures contain no secrets, signed URLs or live Provider calls.
- [ ] Fast switching and deferred fade race tests pass under repeated execution.
- [ ] All demos build with only catalog-addressed audio.
- [ ] Editor and Studio round-trip the same sample project without semantic diff.
- [ ] Runtime works with the local profile while offline.
- [ ] Remote release tests validate object key order, immutable cache and manifest-last behavior using fakes.
- [ ] A human confirms MiniMax voice quality, browser/mobile playback, real STS scope and COS/CDN headers in a controlled non-production environment.
