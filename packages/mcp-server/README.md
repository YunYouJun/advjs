# ADV.JS MCP workspace

The existing `advjs_show_project_workspace` tool serves a compact, read-only authoring browser at `ui://advjs/workspace.html`. It uses the server's configured project loader and working directory. It does not change the server registration or select another workspace.

## Tools and interaction

- `advjs_show_project_workspace({ locale? })` returns project identity, content indexes, loading diagnostics, and the most recent explicit validation result. It never runs the validator implicitly.
- `advjs_run_project_check({ locale? })` runs the existing read-only validator. Concurrent calls share one validation operation; failures remain retryable.
- `advjs_read_workspace_item({ kind, id })` reads one compiled character, chapter, or scene. The identifier must exist in the loaded project. It is not a filesystem path parameter.

The app supports Chinese and English, host or browser language, a remembered manual language choice, host light/dark appearance, search, keyboard tabs, source/context details, and local image previews. Expansion appears only when the host advertises fullscreen support. “Copy for AI” copies to the clipboard only after a click; when clipboard access is unavailable, it opens a selectable context field. It does not send a message, update model context, or share data with another service.

The new `validation` field separates loading diagnostics from the last check. Existing `project.workspace`, `command.status`, and `task` fields remain available with their original status enums and step/log shape. `command.status: awaiting_approval` is retained for compatibility; it does not mean the host has granted or denied authorization. The command display points to the installed CLI rather than assuming a project package script.

## Data and filesystem boundaries

App visibility is presentation metadata, not authorization. The read tool enforces the same project membership and limits even if invoked directly. It does not accept arbitrary roots or paths, follow remote URLs, fetch assets, run asset-pull commands, or expand persistent access.

- Tool callbacks return only fixed application-owned errors. Unexpected loader/validator exceptions are redacted to a bounded generic failure, rather than forwarding exception messages or values.
- Summaries/indexes and explicit item structured payloads each have a 256 KiB UTF-8 JSON limit. Oversized results fail with an actionable error rather than silently dropping diagnostics or source text. The summary's human-readable rendering is also bounded by its structured input.
- Explicit reads can return raw source, character/scene metadata, and generated authoring context in `structuredContent`. Ordinary workspace summaries contain only the content index, not those documents.
- At most 64 preview descriptors are accepted per item. PNG, JPEG, and WebP magic bytes are required; SVG, HTML, arbitrary URLs, and unsupported formats are never embedded.
- Preview bytes are limited to 512 KiB total per item, before base64 encoding, and are returned only in `_meta['advjs/images']`. Model-visible image descriptors contain paths/status, not image bytes. The base64 representation adds roughly one third to the image wire size.
- Image paths must be relative to the authorized workspace. Absolute paths, traversal, Windows drive paths, backslashes, and symlink escapes are rejected. Reads use one descriptor with no-follow/nonblocking flags where supported, descriptor stat checks, and a bounded read buffer. Linux additionally checks the opened descriptor's canonical `/proc/self/fd` path; unavailable checks fail closed.

This is confinement for reads in an already authorized workspace, not a hostile-filesystem sandbox. On platforms without descriptor-path resolution, inode/path rechecks reduce replacement races but cannot make ancestor directory renames atomic. A process able to mutate the workspace concurrently, or create hard links inside it, must not be treated as less trusted than the server's filesystem permissions. The upstream project loader retains its existing trust boundary; these output bounds do not limit that loader's parsing memory. The app never interprets author text as HTML and accepts bridge messages only from its parent, pinning the origin during initialization when no referrer origin is available. A refreshed project invalidates pending detail responses and supersedes outstanding summary/check responses. The server retains completed validation results for the next explicit refresh.

## Verification

Focused tests live in `tests/unit/mcp/mcp-workspace-app.test.ts` and `tests/unit/mcp/mcp-workspace-content.test.ts`. They cover locale and host state, retry and deduplication, public schema compatibility, explicit reading, safe rendering, stale responses, origin checks, local image confinement, total preview budgets, and UTF-8 text/index bounds. The resource requests no network or nested-frame CSP domains.
