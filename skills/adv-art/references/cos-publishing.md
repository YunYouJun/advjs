# Tencent COS publishing

## Boundary

Use this reference for ADV.JS asset decisions. Use the separate `tencent-cloud-cos` Skill for setup, bucket APIs, CORS inspection, uploads, metadata checks, and signed URLs.

Keep two independent delivery lanes:

- Studio authoring originals: private `staging/accounts/` and `private/accounts/`, written only through the `advjsAssets` CloudBase function using one-object short-lived PUT URLs.
- Public game derivatives: immutable `games/{game-id}/v{major}/`, written by a trusted release process and served through the public asset domain.

Never expose a long-lived SecretId/SecretKey in Studio, localStorage, project config, or a `VITE_*` variable.

## Object layout

Choose one stable game slug and explicit release version:

```text
games/{game-id}/{version}/
├── characters/{character-id}/{pose}/{expression}.{hash}.webp
├── characters/{character-id}/animations/{state}.{hash}.webp
├── backgrounds/{scene-id}.{hash}.webp
├── cg/{shot-id}.{hash}.webp
├── cg/{shot-id}.thumbnail.{hash}.webp
├── ui/{asset-id}.{hash}.webp
├── audio/bgm/{track-id}.{hash}.ogg
├── audio/sfx/{sound-id}.{hash}.ogg
└── manifests/assets.json
```

Use lowercase ASCII IDs. Do not publish to `latest/`, and do not overwrite a hashed object.

Generate `cos-release.json` next to the project manifest. Upload only its listed objects rather than recursively uploading the release directory; repeated local generations may leave obsolete hashed files behind. The stable `manifests/assets.json` entry must be last.

## Repository boundary

Commit the story/configuration, `assets.json`, `cos-release.json`, licenses, prompts, and reproducible generation or processing scripts. Do not commit generated game images, animations, or audio, and do not keep duplicate runtime copies under the demo's `public/` directory after COS publication.

Write editable sources, alpha QA, contact sheets, audio intermediates, and the release directory under the repository's ignored `temp/` workspace. Application-shell assets such as favicons and PWA icons may remain local; they are not game media.

## HTTP metadata

- Hashed images/audio: correct `Content-Type` plus `Cache-Control: public, max-age=31536000, immutable`.
- Manifest: `Content-Type: application/json` with short caching and revalidation.
- Record full SHA-256 in `x-cos-meta-sha256`; multipart ETag is not a replacement for the content hash.
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
7. When a CDN or EdgeOne still serves the previous stable manifest, purge that one manifest URL. Do not routinely purge or overwrite content-hashed immutable objects. A bucket-wide CORS or response-header policy correction is the narrow exception: expire the affected game prefix first, and use a one-time directory cache deletion only when conditional revalidation keeps the old response headers.
8. Run `audit-cos-remote.mjs` against the exact release plan. Use identity encoding for HEAD byte checks because an acceleration layer may otherwise report compressed transfer length for JSON.
9. Remove duplicate game media from the demo's `public/` directory and verify the production build references only manifest-derived COS URLs.
10. Re-run browser E2E with cache disabled once and enabled once.

Never print, persist, or commit SecretId, SecretKey, or SessionToken. Keep editable art sources and rejected generations outside the public bucket.

For Studio uploads, do not run the public release procedure in the browser. The browser calculates SHA-256, calls `reserveUpload`, performs the exact signed PUT, and calls `completeUpload`; the service HEAD-verifies and promotes the object into the private content-addressed prefix. Configure a one-day lifecycle rule for abandoned staging objects.
