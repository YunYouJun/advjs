# Screenshot critique

Review each image at its real size. Write one line per finding: state, viewport, what is wrong, which token or file fixes it.

## Every state

- Does it look like this story, or could it be any game? Name the one detail that ties it to the brief.
- Is there one dominant surface, one ink, one accent? Count the colours you can see; more than five usually means noise.
- Are corners, borders and shadows consistent with the chosen material?
- Is anything clipped, overlapping or hugging the canvas edge?

## Title (`1-title`)

- Title, logo and menu read in order; the start action is the most prominent item.
- Menu labels have contrast against both the menu background and the art behind it.
- On the narrow canvas, the menu fits without covering the title and every button is at least 44px tall.

## Dialogue (`2-dialogue`)

- Body text is comfortable at its final size (20–22px desktop); line length is not wider than ~40 CJK characters.
- The speaker name is distinct from body text by colour or weight, not only by position.
- The dialog surface separates text from the scene without hiding the scene entirely.
- The control bar is readable and does not compete with the text.

## Choice (`3-choice`)

- Options look pressable and equal; none looks pre-selected.
- Text contrast holds on the option surface; the hover colour is not tested here, so check `adv check` for it.
- On the narrow canvas, options stack full-width without horizontal scrolling.

## Backlog (`4-backlog`) and save (`5-save`)

- The modal surface uses the theme, not a default white or grey panel that breaks the look.
- Metadata (time, chapter) is legible; muted text still reaches readable contrast.
- Pagination and the close button are visible and look interactive.

## Long text (`6-long-dialogue`, `7-long-choice`)

- The long line wraps inside the dialog box and the option; the first line and the speaker name stay visible, and nothing overlaps the control bar.
- Mixed CJK and Latin keep a steady baseline and line height.

## Accessibility pass

- Tab through the title menu and a choice once in a real preview (editor, desktop app or `--url` target): the focus ring is visible on every surface.
- With reduced motion, nothing slides or flashes; modals fade quickly.
