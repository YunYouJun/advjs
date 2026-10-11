# create-adv

Scaffolding Your First ADV Project/Plugin.

With NPM:

```bash
npm init adv
```

With Yarn:

```sh
yarn create adv
```

With PNPM:

```bash
pnpm create adv
```

Then follow the prompts!

> Ref [create-vite](https://github.com/vitejs/vite/blob/main/packages/create-vite/README.md).

## Non-interactive use

Requires Node.js 24.15 or newer. To create a game without prompts:

```sh
pnpm create adv my-game --template adv --yes
cd my-game
pnpm install
pnpm run check
pnpm run dev
pnpm run build
```

Edit `adv/chapters/01-introduction.adv.md` to write your story. `build` creates
`dist/`; `pnpm run preview` serves that build locally.

`--template` (`-t`) accepts `adv`, `plugin`, or `theme`. `--yes` (`-y`) uses
safe defaults and does not install dependencies, start a server, or overwrite a
nonempty directory. Explicit relative/absolute paths and `.` are supported;
package names are normalized separately from directory names. Without a path,
plugin/theme names receive the `advjs-plugin-` / `advjs-theme-` prefix.

```sh
pnpm create adv my-plugin -t plugin -y
cd my-plugin
pnpm install
pnpm run build
```

The theme option downloads the remote starter using `npx degit`, so it needs
network access. The game and plugin templates are included in the package.
Use `--help` for options and `--version` to inspect the installed CLI.

## Package verification and release

From the repository root:

```sh
pnpm -C packages/create-adv build
pnpm -C packages/create-adv pack --pack-destination ../../release/create-adv
pnpm exec vitest run tests/launch/create-adv.test.ts
```

`prepack` builds the CLI before packing. The tarball includes `bin/`, `dist/`,
and `templates/`. The smoke test installs that tarball outside the monorepo,
checks directory safety and template selection, then installs and builds a
generated game and plugin against locally packed engine packages. Set
`ADVJS_PACKED_INSTALL_SKIP_BUILD=1` only when the engine launch artifacts have
already been built from the current checkout.

Template engine/type dependency versions are embedded from the repository's
`advjs` version when the CLI is built. Release the matching engine package graph
before publishing this scaffolder; a local tarball test does not prove those
versions are available on npm. Verify both packages' versions and dist-tags
before directing users to `pnpm create adv`, and choose a new unpublished
scaffolder version (npm versions cannot be replaced). Packing does not publish
anything.
