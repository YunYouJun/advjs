# ADV.JS asset catalog v2

## Purpose

`adv/assets.json` is the only authoring root that maps stable logical IDs to local authoring files and immutable release objects. Scripts and settings reference IDs; they never own paths or URLs.

Small or generated projects may declare an inline `assets` array. Large projects declare `includes` in the same root and point to `assets/characters.json`, `assets/backgrounds.json`, `assets/cg.json`, and `assets/audio.json`. `assets` and `includes` are mutually exclusive. Merge and validate fragments into build output; never create a second authoring root.

## Schema

```json
{
  "schemaVersion": 2,
  "id": "example",
  "defaultProfile": "production",
  "profiles": {
    "local": {
      "provider": "project",
      "root": "adv/assets",
      "fallback": "production"
    },
    "production": {
      "provider": "http",
      "baseUrl": "https://assets.example.com/"
    }
  },
  "release": {
    "provider": "tencent-cos",
    "objectPrefix": "games/example/v1/"
  },
  "bundles": [
    { "id": "characters" },
    { "id": "opening", "preload": true }
  ],
  "manifestObjectKey": "games/example/v1/manifests/assets.json",
  "assets": [
    {
      "id": "character/hero/default",
      "kind": "character",
      "type": "image",
      "bundle": "characters",
      "characterId": "hero",
      "expression": "default",
      "path": "characters/hero/standing/default.webp",
      "objectKey": "games/example/v1/characters/hero/standing/default.0123456789ab.webp",
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "width": 1024,
      "height": 2048,
      "bytes": 240000,
      "mimeType": "image/webp",
      "source": {
        "type": "generated",
        "model": "model-name",
        "promptVersion": "character-bible-v1",
        "createdAt": "2026-07-20"
      },
      "license": "CC-BY-4.0"
    }
  ]
}
```

Do not add a per-asset absolute `url` when `baseUrl + objectKey` can derive it. Schema v1 absolute URLs remain read-compatible only.

## Asset kinds

- `character`: require `characterId` and `expression`.
- `background`: reusable scenery without plot-critical foreground characters.
- `cg`: one-off story art; put the thumbnail in `variants.thumbnail`.
- `animation`: require character/state, frame dimensions, frame count, FPS, and loop policy.
- `bgm` / `sfx` / `voice`: use `type: audio`; include duration and loop data where applicable.
- `ui`: project-specific interface imagery.

## Validation rules

- `schemaVersion` is `2`; `id`, `defaultProfile`, and the selected profile exist.
- The root declares exactly one of `assets` or `includes`; every include stays under `adv/assets/` and is unique.
- `http.baseUrl` is absolute and ends with `/`; `project.root` is project-relative.
- Each logical ID is unique and each referenced bundle exists.
- Local `path` remains under the configured project root. Include files remain under `adv/assets/`.
- Release `objectKey` begins with `release.objectPrefix` and its filename contains the declared SHA-256 prefix.
- Image dimensions and byte counts are positive integers. Audio has positive bytes and duration when known.
- Every released asset records a license and source provenance.
- Generated assets record model, prompt version, and creation date.
- Every required character expression and gallery thumbnail resolves through the catalog.
- `settings/game.json` and content cards use `assetId`; they do not duplicate URLs, hashes, titles, or alt text owned by the catalog.

The validator checks objective rules. It does not judge composition, identity consistency, transparent-edge quality, or whether the declared license is legally sufficient.
