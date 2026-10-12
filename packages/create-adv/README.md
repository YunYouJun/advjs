# create-adv

Scaffolding Your First ADV Project/Plugin.

> The older npm releases `0.1.0-beta.1` and `0.1.1` omit `dist/` and templates,
> causing `ERR_MODULE_NOT_FOUND`. The commands below require the corrected
> scaffolder and matching engine release to be published and promoted to
> `latest`; switching between the old `latest` and `beta` tags does not help.

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

`--template` (`-t`) accepts `adv`, `plugin`, or `theme`. For the bundled `adv`
and `plugin` templates, `--yes` (`-y`) uses safe defaults and does not install dependencies, start a server, or overwrite a
nonempty directory. Explicit relative/absolute paths and `.` are supported;
package names are normalized separately from directory names. Without a path,
plugin/theme names receive the `advjs-plugin-` / `advjs-theme-` prefix.

```sh
pnpm create adv my-plugin -t plugin -y
cd my-plugin
pnpm install
pnpm run build
```

The theme option requires interactive approval before downloading the remote
starter using `npx --yes degit@3.10.0`. This approval allows npm to download and
execute the pinned helper without a second npm confirmation, so network
access is required. `--template theme --yes` is rejected before changing any
files or running a helper. Run without `--yes` to review and approve this step.
The game and plugin templates are included in the package.
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

`create-adv` is included in `scripts/release/package-manifest.mjs` at the fixed
launch version, after the engine packages its templates require. Candidate
publication and production dist-tag promotion therefore include the scaffolder.
The release pack check rejects archives missing the CLI entry or bundled
templates. CI also runs `pnpm create adv` against an isolated registry and tests
both generated templates outside the repository on macOS and Windows.
