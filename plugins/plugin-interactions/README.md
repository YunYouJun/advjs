# @advjs/plugin-interactions

Two small, JSON-only Runtime activity plugins used by the ADV.JS demo and as
reference implementations for custom plugins:

- `starMap()` registers `star-map/compare`.
- `civilization()` registers `civilization/initialize`.

Both pause the Runtime with an `activity.request` effect. Browser or CLI hosts
render the interaction and submit a JSON result with `runtime.completeActivity()`.
