# AGUI Design Contract

Read [the desktop editor design specification](../../docs/agui/design.md) before changing the component library. AGUI owns the shared visual implementation of that specification.

- Reuse semantic tokens from `client/styles/css-vars.scss`. Add missing shared tokens there with light and dark values; do not spread new literal colors through components or callers.
- Keep sizes, spacing, radii, interaction states, and variants consistent across controls. Fix a shared visual issue in the shared component instead of requiring caller overrides.
- Preserve existing props, events, slots, and keyboard behavior when changing appearance. Reuse Reka UI primitives where applicable and verify the resulting component's accessibility.
- Keep default controls compact and neutral; primary/danger variants must express action hierarchy. Existing hardcoded styles are migration work, not a precedent for new components.
- Retain a visible keyboard focus state. Do not remove outlines without an equivalent visible replacement; check light/dark themes and readable contrast.
- Validate visual changes in an editor panel with realistic Chinese/English labels and at narrow width, not only in an isolated component demo.

If a reusable visual rule changes, update the design specification and its token/component implementation together. Product copy, game artwork, and narrative typography remain the responsibility of the consuming surface.
