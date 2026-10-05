# Desktop Editor UI

Read [the AGUI design specification](../docs/agui/design.md) before creating or changing editor UI. It applies to `core/` and `vrm/` editor chrome, including inspector, context, AI, resource, and settings panels.

- Use the existing AGUI component for buttons, fields, tabs, menus, and collapsible groups. Inspect its actual API before use; extend shared components when a reusable variant is missing.
- Use semantic `--agui-*` variables for interface colors. UnoCSS remains appropriate for layout; avoid raw palette classes such as `bg-blue-600`, `bg-green-600`, or `dark:bg-gray-800` for editor surfaces and actions.
- Keep routine actions compact and neutral. At most one primary action per local task group; green means a successful state, not an AI/copy action.
- Present counts as inline metadata or compact rows, and properties as aligned fields or collapsible sections. Large metric cards and full-width paired calls to action do not belong in utility panels.
- Follow the specification's type, spacing, control, and radius scales. Narrative reading areas may use a larger body size than property controls.
- Check resizing, long Chinese/English labels, keyboard focus, and relevant loading/empty/error states. Include normal and narrow-panel screenshots for visual changes; document any checks that could not be run.
- Add extensible views and actions through the [editor UI plugin interface](../docs/guide/editor/ui-plugins.md) and the explicit `core/app/extensions/catalog.ts`. Public plugins use `@advjs/editor-sdk`, explicit imports, and AGUI controls; they must not import internal stores or receive bridge credentials and filesystem handles. Keep lifecycle cleanup and error handling in the host contract.

Implementation entry points:

- `../packages/gui/client/styles/css-vars.scss`: shared theme tokens.
- `../packages/gui/client/components/`: shared controls and their visual variants.
- `core/app/styles/css-vars.scss`: editor-specific semantic tokens when necessary.
- `core/uno.config.ts`: layout utilities and icon configuration.

Do not copy Studio mobile styles or generated mockup styles into the editor. When migrating an existing panel, keep its behavior intact and record remaining shared-component gaps rather than hiding them with local overrides.
