# @advjs/character

`@advjs/character` is the public character-domain entry point for ADV.JS applications. It reuses the canonical `.character.md` types, runtime schemas and parser, then adds an immutable catalog with duplicate-id and relationship validation.

```ts
import { parseCharacterCatalog } from '@advjs/character'

const catalog = parseCharacterCatalog(characterSources)
const songJiang = catalog.require('song-jiang')
```
