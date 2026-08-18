# ADV.JS Studio App Icon Design QA

- Source visual truth: the gradient speech-frame and camera mark on `https://advjs.org/`
- Implementation: `apps/studio/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
- Family reference: `docs/public/brand/advjs-app-icon.svg`
- Viewport: square app-icon canvas
- Source pixels: 1254 × 1254, normalized to 1024 × 1024
- Implementation pixels: 1024 × 1024
- CSS size: not applicable; raster and SVG asset comparison
- Density normalization: both compared at 1024 × 1024, 1:1 pixels
- State: default iOS appearance, unmasked square source

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: not applicable; the icon contains no text.
- Spacing and layout rhythm: the homepage speech-frame uses a generous square-canvas safe area and a slight counter-clockwise tilt. The silhouette remains recognizable at 16–64 px.
- Colors and visual tokens: the homepage cyan-to-blue gradient remains the family anchor. Studio adds a warm amber-to-ember camera core and a violet-black backdrop without changing the outer silhouette.
- Image quality and asset fidelity: the canonical homepage path is preserved rather than approximated. Separate gradients, a soft backdrop glow, and a low blurred shadow add depth without introducing hard decorative strokes.
- Copy and content: not applicable; no app-specific text appears in the icon.

## Full-view comparison evidence

The live homepage mark and both 512 px family renders were inspected side by side. ADV.JS retains the original cyan camera mark; ADV.JS Studio shares the speech-frame while using an orange-red creative core and violet backdrop.

## Focused-region comparison evidence

A separate 64 × 64 render was inspected. The speech tail, frame aperture, and warm Studio core remain distinct without relying on fine lines or typography.

## Comparison history

- Initial vector pass: the unfolding-page metaphor diverged from the established ADV.JS homepage mark and introduced an abrupt fold highlight.
- Fix: restored the exact homepage speech-frame geometry, separated frame and camera fills for the Studio variant, and added only soft gradient depth.
- Post-fix evidence: the 1024 px, 512 px, and 64 px renders retain safe-area clearance, smooth edges, and no clipping.

## Follow-up polish

- P3: Icon Composer can add platform-managed Liquid Glass highlights using separate background and foreground layers without changing the canonical artwork.

final result: passed
