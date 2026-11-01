# Studio iOS simulator testing

This checkout contains the P0 spike, not the complete native App. Keep that boundary; do not copy the whole App into this branch to run lifecycle tooling.

- Use `scripts/simulator-session.mjs` for simulator xcodebuild invocations and reuse the exact runtime/device-type/name profile in `scripts/simulator-profile.json`. Do not create a new simulator per task/phase or fall back to Cook/personal devices. Missing or ambiguous matches must stop.
- Default to serial iPhone/iPad tests, disable parallel simulator workers, and respect the shared per-UDID lock across worktrees. Never bypass another task's lock or auto-reclaim stale locks.
- Only close a device this session found Shutdown and successfully booted, after its own child exits. Preserve devices already Booted/Booting. Report uncertain boot/cleanup outcomes; never automatically erase/delete simulators or local data.
- Verify lifecycle changes with the mock Node suite; do not start real devices merely to test the guard. For the complete native App, use the worktree that contains `StudioApp.xcodeproj` and its own managed entry, not the historical raw spike command.
