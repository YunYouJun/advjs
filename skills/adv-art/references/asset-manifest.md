# Visual asset manifest

## Purpose

`adv/assets.json` maps logical game assets to immutable release derivatives and records enough information to verify completeness, provenance, and licensing.

## Schema

```json
{
  "schemaVersion": 1,
  "publicBaseUrl": "https://assets.example.com/",
  "objectPrefix": "games/example/v1/",
  "characters": [
    {
      "id": "hero",
      "requiredExpressions": ["default", "smile", "sad"]
    }
  ],
  "assets": [
    {
      "id": "character/hero/default",
      "kind": "character",
      "characterId": "hero",
      "pose": "standing",
      "expression": "default",
      "objectKey": "games/example/v1/characters/hero/standing/default.0123456789ab.webp",
      "url": "https://assets.example.com/games/example/v1/characters/hero/standing/default.0123456789ab.webp",
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "width": 1024,
      "height": 2048,
      "bytes": 240000,
      "source": {
        "type": "generated",
        "model": "model-name",
        "promptVersion": "character-bible-v1",
        "createdAt": "2026-07-17"
      },
      "license": "CC BY-NC-SA 4.0"
    }
  ]
}
```

## Asset kinds

- `character`: require `characterId` and `expression`; use `pose` when a character has multiple body poses.
- `background`: reusable scenery without plot-critical foreground characters.
- `cg`: a one-off story illustration; add a chapter/shot ID to the logical ID.
- `ui`: game-specific frames, icons, maps, or overlays.
- `thumbnail`: derived previews; point provenance to the source logical asset when applicable.

## Validation rules

- `publicBaseUrl` is an absolute URL ending in `/`.
- `objectPrefix` is a relative key prefix ending in `/`.
- Each logical `id` is unique.
- Each URL starts with `publicBaseUrl + objectPrefix`.
- Each filename contains an 8–64 character lowercase hexadecimal prefix of the declared SHA-256.
- `width`, `height`, and `bytes` are positive integers.
- Every asset has a license and source provenance.
- Generated assets include model, prompt-version, and creation-date fields.
- Every `requiredExpressions` value has a matching `character` asset.

The manifest validator checks these objective rules. It does not judge composition, character identity, transparent-edge quality, or whether the chosen license is legally correct.
