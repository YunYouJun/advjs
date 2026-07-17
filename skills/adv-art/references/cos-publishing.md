# Tencent COS publishing

## Boundary

Use this reference for ADV.JS asset decisions. Use the separate `tencent-cloud-cos` Skill for setup, bucket APIs, CORS inspection, uploads, metadata checks, and signed URLs.

## Object layout

Choose one stable game slug and explicit release version:

```text
games/{game-id}/{version}/
├── characters/{character-id}/{pose}/{expression}.{hash}.webp
├── backgrounds/{scene-id}.{hash}.webp
├── cg/{chapter-id}/{shot-id}.{hash}.webp
├── audio/bgm/{track-id}.{hash}.ogg
├── audio/sfx/{sound-id}.{hash}.ogg
└── manifests/assets.json
```

Use lowercase ASCII IDs. Do not publish to `latest/`, and do not overwrite a hashed object.

## HTTP metadata

- Hashed images/audio: correct `Content-Type` plus `Cache-Control: public, max-age=31536000, immutable`.
- Manifest: `Content-Type: application/json` with short caching and revalidation.
- Public browser assets: allow unauthenticated `GET` and `HEAD`. When requests do not carry credentials, `Access-Control-Allow-Origin: *` is compatible with the demo, docs, Studio, Canvas, and WebGL hosts.
- Do not enable public browser `PUT`, `POST`, or `DELETE` for the asset origin.

CORS is not hotlink protection. If traffic abuse becomes relevant, evaluate CDN/EdgeOne referer policy or another delivery control separately without breaking legitimate cross-origin rendering.

## Credential and release procedure

1. Inspect the target bucket and existing CORS without changing state.
2. Use a dedicated subaccount restricted to the required bucket/prefix, preferably through STS temporary credentials.
3. Upload immutable objects before the manifest.
4. HEAD every object and verify status, `Content-Type`, `Cache-Control`, bytes, and checksum metadata where available.
5. Fetch representative images with an `Origin` header from each supported host and verify CORS.
6. Upload the manifest last, then update the repository config to its versioned URLs.
7. Re-run browser E2E with cache disabled once and enabled once.

Never print, persist, or commit SecretId, SecretKey, or SessionToken. Keep editable art sources and rejected generations outside the public bucket.
