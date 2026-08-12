# Adaptation manifest

## Purpose

`adv/adaptation.json` is the source-to-script ledger for an adaptation. It records objective source coverage separately from editorial judgments about fidelity.

## Schema

```json
{
  "schemaVersion": 1,
  "adaptationMode": "seamless-main",
  "sources": [
    {
      "id": "work-id",
      "title": "Source title",
      "author": "Author name",
      "url": "https://example.com/canonical-source",
      "revision": "2026-07-17 or a commit hash",
      "license": "CC BY-NC-SA 4.0",
      "order": 1,
      "sections": [
        {
          "id": "opening",
          "title": "Opening",
          "required": true,
          "chapters": ["01-opening"]
        }
      ]
    }
  ],
  "characters": [
    {
      "id": "protagonist",
      "name": "Protagonist",
      "aliases": [],
      "firstSourceSection": "work-id/opening",
      "scriptCard": "adv/characters/protagonist.character.md",
      "needsTachie": true
    }
  ],
  "scenes": [
    {
      "id": "room",
      "name": "Room",
      "firstSourceSection": "work-id/opening",
      "sceneCard": "adv/scenes/room.md",
      "needsBackground": true
    }
  ],
  "addedMaterial": [
    {
      "id": "postgame-simulation",
      "kind": "postgame-route",
      "chapters": ["01-opening#postgame-simulation"],
      "sourceMapped": false
    }
  ]
}
```

## Required fields for coverage auditing

The audit script reads `schemaVersion`, `sources[].id`, and `sources[].sections[]` with `id` and `required`. IDs must match `^[a-z0-9][a-z0-9-]*$`.

Place one marker in a `.adv.md` file for each mapped section:

```markdown
<!-- source:work-id/opening -->
```

Required sections must occur exactly once. Optional sections may occur zero or one time. Any marker absent from the manifest is an error because it cannot be reviewed against a declared source.

## Modeling rules

- Use source headings as the initial section boundary; split only when a single heading contains independently mapped scenes.
- Preserve the sources' declared order with integer `order` values.
- Record a stable source revision so future upstream edits do not silently change the fidelity target.
- Include non-speaking people in `characters` when staging, relationships, or continuity depend on them.
- Keep `addedMaterial` explicit. Never map newly written postgame or bridging content to a source section merely to raise coverage.
- Treat the manifest as authored content: review changes and keep it in version control.
- For author metadata intentionally excluded from play, keep the section with `required: false`, omit `chapters`, and add an explicit `excludedReason` such as `author-metadata`.
- Several sources may be edited into one seamless game route. Preserve their `order` internally, but do not require source boundaries, work titles, or adaptation terminology to appear in chapter titles or player-facing UI.
