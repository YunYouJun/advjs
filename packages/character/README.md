# @advjs/character

`@advjs/character` is the public character-domain entry point for ADV.JS applications. It reuses the canonical `.character.md` types, runtime schemas and parser, then adds an immutable catalog with duplicate-id and relationship validation.

```ts
import { parseCharacterCatalog } from '@advjs/character'

const catalog = parseCharacterCatalog(characterSources)
const songJiang = catalog.require('song-jiang')
```

Visual identity is optional on existing cards. `AdvCharacterVisual` / `CharacterVisualSchema` define a design version, project-relative reference images, fixed traits and allowed changes. Use `exportCharacterVisualForAI(character)` to export the shared visual brief; the caller must still inspect and attach the actual images. `avatar` and `tachies` remain runtime presentation fields.
