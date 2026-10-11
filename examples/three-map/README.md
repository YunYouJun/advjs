# Three.js rendering example

A private workspace demo for the generic `@advjs/plugin-three` APIs. It renders a controllable character and three selectable boxes, and demonstrates entity binding, OrbitControls, automatic framing, and a keyboard-accessible selection alternative when WebGL is unavailable.

```bash
pnpm install
pnpm -C plugins/plugin-three build
pnpm -C examples/three-map dev
```

Open the URL printed by Vite (default `http://127.0.0.1:3347`). Click or Tab into the canvas to control the character:

- WASD / arrow keys: move relative to the current camera view.
- Shift: run; Space: jump, including while moving. Release and press Space again for another jump after landing.
- R / Reset character: return to the starting position. Escape: release keyboard control.
- Drag: orbit; right drag: pan; wheel: zoom. Select boxes with the canvas or object list, and use the reset view button to show the whole map.

Movement stops on focus loss or page hiding. The flat-ground example keeps the character inside the board; obstacle collision and imported character animations belong to the consuming game.

- `src/usePrimitiveScene.ts`: scene composition using the generic entity registry and camera framing helper.
- `src/character-controller.ts`: frame-rate-independent movement and jump state, plus scoped keyboard binding and cleanup.
- `src/character-model.ts`: a procedural character with walking animation and a ground shadow.
- `src/App.vue`: canvas, selection controls, and WebGL fallback.

Game data, activity rules, and save semantics belong in the consuming game's own plugin. This demo does not depend on a particular game or register a Runtime plugin.

```bash
pnpm -C examples/three-map build
pnpm exec vitest run plugins/plugin-three/test examples/three-map/test
pnpm exec vue-tsc --noEmit -p examples/three-map/tsconfig.json
```

See [the integration guide](../../docs/guide/runtime/three.md) for project plugin registration, lifecycle, ownership, and persistent map hosting boundaries.
