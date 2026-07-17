# Adaptation manifest

## Purpose

`adv/adaptation.json` is the source-to-script ledger for an adaptation. It records objective source coverage separately from editorial judgments about fidelity.

## Schema

```json
{
  "schemaVersion": 1,
  "adaptationMode": "canonical-plus",
  "sources": [
    {
      "id": "work-id",
      "title": "Canonical title",
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
      "id": "interpretive-ending",
      "kind": "interpretive-route",
      "chapters": ["20-interpretive-ending"],
      "canon": false
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
- Preserve the works' canonical order with integer `order` values.
- Record a stable source revision so future upstream edits do not silently change the fidelity target.
- Include non-speaking people in `characters` when staging, relationships, or continuity depend on them.
- Keep `addedMaterial` explicit. Never map newly written interpretive content to a source section merely to raise coverage.
- Treat the manifest as authored content: review changes and keep it in version control.
