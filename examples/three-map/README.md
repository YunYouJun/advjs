# Three.js rendering example

A private workspace demo for the generic `@advjs/plugin-three` APIs. It renders three selectable boxes and demonstrates entity binding, OrbitControls, automatic framing, and a keyboard-accessible alternative when WebGL is unavailable.

```bash
pnpm install
pnpm -C plugins/plugin-three build
pnpm -C examples/three-map dev
```

Open the URL printed by Vite (default `http://127.0.0.1:3347`). Select a box with the canvas or object list, orbit or zoom, and use the reset view button.

- `src/usePrimitiveScene.ts`: scene composition using the generic entity registry and camera framing helper.
- `src/App.vue`: canvas, selection controls, and WebGL fallback.

Game data, activity rules, and save semantics belong in the consuming game's own plugin. This demo does not depend on a particular game or register a Runtime plugin.

```bash
pnpm -C examples/three-map build
pnpm exec vitest run plugins/plugin-three/test
pnpm exec vue-tsc --noEmit -p examples/three-map/tsconfig.json
```

See [the integration guide](../../docs/guide/runtime/three.md) for project plugin registration, lifecycle, ownership, and persistent map hosting boundaries.
