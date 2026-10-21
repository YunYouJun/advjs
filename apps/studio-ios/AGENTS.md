# ADV.JS Studio for iPhone and iPad — Agent Guidelines

Scope, acceptance (N1–N16) and phase status live in [the implementation plan](../../docs/plans/2026-10-21-studio-native-ios.md); feature inventory and architecture decisions in [the design spec](../../docs/specs/2026-10-21-studio-native-ios-design.md); evidence in [the acceptance report](../../docs/reports/studio-native-ios-acceptance.md). Update all three when a phase changes.

## Interface

- Follow [the native Studio specification](../../docs/about/design/studio-native.md): SwiftUI and system components only, brand through `AccentColor`/`StudioTheme`, system text styles, `FormatStyle` for dates and numbers.
- Every user-facing string goes into `StudioApp/Localizable.xcstrings` with a Simplified Chinese translation that matches the terms in `apps/studio/src/i18n/locales`. Language follows the system per-app setting; do not add an in-app language switch without asking.
- Add `accessibilityIdentifier`s for UI tests next to, not instead of, readable labels.

## Engine and shared logic

- Never reimplement project-format rules in Swift. Parsing, serialization, discovery, validation, templates, slugs and package rules come from the engine (`engine/`), which only calls shared packages (`@advjs/parser`, `@advjs/core/project`, `@advjs/assets`). Missing behavior goes into those packages first, with Web Studio switched to the same implementation.
- A breaking change to any engine operation bumps `ENGINE_API_VERSION` and `EngineBridge.supportedAPIVersion` together.
- After changing shared modules or the engine, run `pnpm -C apps/studio-ios build:engine`, `test:engine`, `golden`, `swift test --package-path apps/studio-ios/Packages/StudioKit`, and Web Studio's unit tests.

## Files and data

- Project folders live in Documents and are the only source of truth. Write through `CoordinatedFiles` (atomic, file-coordinated) and pass the session's `ProjectWatcher` so the App's own writes are not treated as external changes.
- App-local data (project list, Recently Deleted, drafts, staging) lives under Application Support or temporary directories and must be rebuildable or safe to clear.
- Deleting is undoable (Recently Deleted, 30 days); projects opened in place are only removed from the list.

## Project

- `StudioApp.xcodeproj` uses Xcode buildable folders and local Swift packages (`Packages/StudioKit`, `Packages/StudioUI`). Add files by creating them in the folders; do not introduce XcodeGen or Tuist. `spike/` is P0 feasibility code and is not part of the App.
- Generated inputs are not committed: run `build:engine` (engine bundle in StudioKit) and `build:samples` (sample packages in `StudioApp/Samples`) before building the App.
- Swift 6 language mode with complete concurrency checking; the App target defaults to main-actor isolation.
