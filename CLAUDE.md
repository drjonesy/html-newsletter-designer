# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

A fully client-side visual designer for responsive **email** HTML. The user composes a
newsletter from typed blocks, previews it, and exports table-based HTML that survives
Gmail/Outlook. There is no backend, no API, and no network calls — everything runs in the
browser and persists to `localStorage`.

This is **v2**: an icon rail, one contextual left panel that becomes the block inspector,
a canvas with a docked formatting toolbar, and in-place editing as the primary way to
write copy. v1's three-column workbench (palette / canvas / right inspector) is gone.

## Commands

This project is **pnpm-only**. A `preinstall` guard (`npx only-allow pnpm`) blocks npm and yarn.

```bash
pnpm install    # install deps
pnpm dev        # Vite dev server on :3000
pnpm build      # production build to dist/
pnpm preview    # serve the production build
pnpm lint       # tsc --noEmit (this is the only check — there is no test suite or ESLint)
pnpm clean      # rm -rf dist extension/app

pnpm ext:build    # build the app into extension/app/ for the Chrome extension
pnpm ext:package  # build, then zip extension/ to dist/…-<manifest version>.zip
pnpm ext:version  # bump the manifest version — asks which, or takes major | minor | patch | an exact version
```

Run `pnpm lint` after any change to `src/types.ts` — the discriminated union there is
load-bearing and type errors surface nowhere else.

### The Chrome extension

`extension/` is the MV3 extension that opens the designer beside a Gmail compose window
(`manifest.json`, `background.js`, `content.js`, `detect.js`, and its own README for
loading it unpacked). The designer itself isn't rebuilt for it — `ext:build` is the
ordinary Vite build with `--base=./`, because an extension page is loaded from a
`chrome-extension://` origin where absolute `/assets/…` paths resolve to nothing.

`ext:package` produces the store upload via
[scripts/package-extension.mjs](scripts/package-extension.mjs). It zips from *inside*
`extension/` so `manifest.json` lands at the archive root — the store rejects an upload
that nests it in a folder — names the file after the manifest's `version`, drops the
developer README, and deletes any existing archive first, since `zip` adds to one that
already exists rather than replacing it. `pnpm lint` is not part of either command — the
build strips types without checking them, so run it yourself before shipping.

The manifest's `version` is Chrome's format, **not semver**: one to four dot-separated
integers, each 0–65535, no leading zeros, and no `-rc1` suffix (that belongs in the
separate `version_name` field). `versionProblem` in
[scripts/manifest-version.mjs](scripts/manifest-version.mjs) is the one statement of that
rule; both scripts import it, so a bad version fails locally rather than at the end of an
upload.

**Bumping is a separate command, deliberately.** `pnpm ext:version patch` (or
`minor`, `major`, or an exact version) rewrites the manifest; `ext:package` only
ever reads it. Packaging is run repeatedly while testing a build, and a version that
climbed on every run would burn numbers the store can never reuse — it refuses a version
it has already seen, so they are one-way. It rewrites the single `version`
line rather than re-serialising the JSON, which would expand the inline `permissions` and
`matches` arrays and turn a one-word change into an unreadable diff.

Run with **no argument in a terminal and it asks**, listing the number each bump would
produce — `patch  0.1.3 → 0.1.4` — since which release a version *is* matters more than
the word for it. The one-way-ness shapes the prompt too: there is no default, an empty
line or Ctrl+D cancels rather than picking the smallest bump, and cancelling exits
non-zero so a chained `&& pnpm ext:package` stops. **With no TTY it doesn't prompt** — a
missing argument is the usage error it always was, so a hook or a CI step fails instead
of hanging on a question nobody will answer.

`pnpm-workspace.yaml` exists only to allow `esbuild`'s postinstall script (`allowBuilds`).
Without it `pnpm build` fails on a missing platform binary. Do not delete it.

## Stack

React 19 · Vite 6 · Tailwind CSS 4 (via `@tailwindcss/vite`, no config file — custom tokens
live in an `@theme` block in [src/index.css](src/index.css)) · TypeScript (`noEmit`) ·
lucide-react for icons · [Lexical](https://lexical.dev/) for the Inspector's rich-text
editor. `motion` is installed but not currently imported.

Lexical is the only heavyweight dependency — 79KB gzipped, about 46% of the bundle. It
earns that by editing *one* thing: a paragraph's rich text in the Inspector's Content tab.
Nothing else should be rebuilt on it, and the canvas keeps its own lighter
`contenteditable`.

Because it's reached through one component behind one tab, **`RichTextField` is loaded
with `React.lazy`** from [ContentTab.tsx](src/components/panels/inspector/ContentTab.tsx),
which is what keeps the initial chunk at 105KB gzipped rather than 184KB. Importing it
statically from anywhere — or importing any `@lexical/*` package outside `RichTextField` —
silently pulls the whole editor back into the first load. `pnpm build` is the check: two
chunks means it's still split, one means it isn't.

The accent colour is a Tailwind scale, `accent-50` … `accent-900`. Use it rather than a
hex — it's the one colour that distinguishes app chrome, and it appears in the rail, the
selection outline, the primary button and every focus ring.

## Architecture

### State: one owner, published through one context

[src/state/DesignerContext.tsx](src/state/DesignerContext.tsx) owns the entire application
state. A single `NewsletterTemplate` is the source of truth:

```
NewsletterTemplate { id, name, settings: EmailSettings, elements: EmailElement[] }
```

[App.tsx](src/App.tsx) is composition only — it mounts the two providers and the shell.

v1 kept this in `App.tsx` and drilled it down as props, which worked while the tree was
three components wide. v2 nests four deep (shell → panel → inspector → tab → field), so
the same state is published through **one** context instead. There is still no store and
no reducer, and nothing below the provider mutates the template: it calls a handler.

**Every mutation goes through `commit`** ([useTemplateHistory.ts](src/state/useTemplateHistory.ts)),
which is what makes undo/redo see everything. Adding a handler that calls `setState`
directly would create an edit the user can't undo.

Auto-save: a `useEffect` writes `template` to `localStorage` under
`gmail_newsletter_designer_template_v1` on every change, flashing the "Saving…" indicator.
Changing the shape of `EmailElement` will break saved templates for existing users —
either migrate on read or bump that key.

### Undo / redo

A snapshot stack (`past` / `present` / `future`) over the whole template, capped at 50
entries because uploaded images live in it as data URIs.

`commit(update, { coalesceKey })` folds a run of rapid changes into one undo step. Colour
pickers fire per pixel dragged and text fields per keystroke; without a key, undo walks
back through forty shades of blue. Use something stable *and* specific —
`` `color:${element.id}` `` — so two different fields never merge into each other.

`Cmd/Ctrl+Z` is deliberately inert while focus is in an input or a contenteditable: the
browser's own undo owns the caret and the half-typed word there. Fields commit on blur, so
their content becomes undoable the moment it's actually part of the template.

### Project files

[src/utils/templateFile.ts](src/utils/templateFile.ts) defines the save/open format:
`.newsletter.json`, a versioned envelope (`format`, `version`, `savedAt`) wrapping the
whole `NewsletterTemplate`. This is the *editable source*; exported HTML is the output.
Uploaded images are already data URIs, so a project file is self-contained.

`parseTemplateFile` treats file contents as untrusted — it returns a
`{ status: 'error', error }` message for the user rather than throwing, and rebuilds each
block as `{ ...createNewElement(type), ...fileData }` so a file missing fields (older
build, hand-edited) still loads. Unknown block types are dropped with a warning instead of
failing the whole load. Keep that shape: never `commit` straight from parsed JSON.

Note the discriminant is the string `status`, not a boolean `ok` — `tsconfig.json` has no
`strict`, and boolean-literal discriminants don't narrow reliably without `strictNullChecks`.

**When to bump `TEMPLATE_FILE_VERSION`:** only when an *older* build could not correctly
read a *newer* file. Adding a type is additive (an old build drops the block with a visible
warning, which beats refusing a file it could mostly read). Removing a type can't break an
old build at all. Optional additive fields don't qualify either. That's why the version is
still 2 after `list` and `spacer` were added, `key-value` was retired, `visibility` and
per-block padding were introduced, and `row`/`column` arrived.

### Elements are a discriminated union

[src/types.ts](src/types.ts) defines `EmailElement` as a union discriminated on `type`.
**Adding a new element type requires touching five places:**

1. `src/types.ts` — add the `ElementType` literal, the interface, and the union member
2. [src/utils/elementHelpers.ts](src/utils/elementHelpers.ts) — a `createNewElement` case
   supplying defaults, plus an entry in `TYPE_LABELS`
3. [src/utils/htmlGenerator.ts](src/utils/htmlGenerator.ts) — a `renderElementBody` case
   emitting the email HTML. Text blocks resolve through `resolveTextStyle`
   rather than reading their own fields — see *The theme cascade*. The shared
   `bgStyle` / `bgAttr` / `paddingStyle` / `borderStyle` / `radiusStyle` belong in it
   too: the Inspector offers Background, Padding, Border and Rounded corners on every
   type, and a case that ignores them gives the new block four controls that do nothing.
   Margin is the fifth and needs nothing from the case — `applyOuterMargin` wraps whatever
   the case returns — unless the new type's own box can carry it, like a heading's tag
4. [StylesTab.tsx](src/components/panels/inspector/StylesTab.tsx) — an editor arm, and a
   `ContentTab` arm plus `hasContentTab` if it has non-text content
5. [templateFile.ts](src/utils/templateFile.ts) — add it to `ELEMENT_TYPES`, or project
   files will drop it with a warning

Miss one and `pnpm lint` will usually catch it, because the switches are exhaustive over
the union. `ELEMENT_TYPES` is a `Set<string>` and won't be caught — check it by hand.

A type that holds `childElements` needs two more: `CONTAINER_TYPES`, and an arm in
`canNest` if it can't simply hold anything — see *Nesting*. Both are lists rather than
switches, so neither is caught by the compiler either.

If the new type has text the user should be able to type over on the canvas, wrap that
text in `editableField(value, 'fieldName', opts, mode)` in its generator case and add the
type to `INLINE_EDITABLE_TYPES` in `Canvas.tsx` — see *Inline editing* below.

### Nesting

Three block types hold `childElements: EmailElement[]` — `section`, the top-level grouping
the Sections outline manages; `row`, a strip of columns; and `column`, one cell of a row,
carrying the per-side borders, padding and fill that make it a box. All three nest
arbitrarily deep.

Never test `el.type === 'section'` to decide whether to recurse. Use `isContainerElement(el)`
from [elementHelpers.ts](src/utils/elementHelpers.ts), which narrows to `ContainerElement`.
`DesignerContext` already has recursive helpers built on it (`findElementById`,
`findContainerFor`, `mapTree`, `removeFromTree`, `insertRelativeTo`, `moveWithinList`);
follow that pattern rather than assuming a flat array.

**"Is it a container" and "may this go in it" are different questions.** The second is
`canNest(child, parent)`, and columns are why it exists: a `row` holds only `column`s
(the generator builds one `<td>` per child), and a `column` may sit nowhere but a row.
Every placement path asks `canNest` — the palette click, the canvas drag rules, and
`reorderElement` as a backstop — so there's one statement of the rule rather than three
that can drift.

Two consequences worth remembering:

- Anything that copies a subtree must re-id every descendant, not just the root —
  `reidDeep` does this. Duplicate ids make selection and updates hit both copies.
- The canvas is the only place a container's own frame is drawn in React rather than by
  the generator (its children have to stay individually clickable). `containerPreviewStyle`
  in `Canvas.tsx` mirrors what `renderElementBody` emits for the frame — change one and
  change the other. It's a switch over the three container types, since a row's frame is
  a flex strip and a column's is a flex item.

### Rows and columns

A `row` is one `<table>`, one `<tr>`, and a `<td>` per column. It deliberately draws **no
border of its own**, so it stays a single table however many columns it has; framing
belongs to the individual columns, whose border, padding, radius and fill land on the
`<td>` (the one box Outlook's Word engine pads reliably). A row that is given a *fill*
paints its own `<table>`, and one given *padding* grows a wrapper cell to carry it — see
*Block padding*, which is where the second table comes from.

**A row is also the palette's general-purpose box.** "1 Column", "2 Columns" and "3
Columns" are one type in three shapes, and any of them changes count from its Styles tab.
There is no Section item in the palette: a column carries the same box controls a section
does, so a one-column row does that job, and two boxes under different names doing the
same thing is how the two drift. The `section` type is still what the Sections outline
manages at the top level, what `BLANK_CANVAS_TEMPLATE` seeds, and what `migrateToSections`
wraps loose blocks in — it just isn't something you add from the palette any more.

Four things are load-bearing:

- **A bare one-column row emits only its blocks.** `renderRow` returns early when there's
  one column, it draws nothing, and the row has no margins — the same bargain `section`
  strikes, and the reason wrapping content in one is free. Two cells side by side *are*
  the layout, so the early return is single-column only.

- **The gap is a spacer cell, not padding.** Padding on the columns would inset the row's
  outer edges too. The gap cell holds a `<div>` of the same height, which is what carries
  the gap to mobile: once the media query turns that cell into a full-width block, its px
  width stops meaning anything and the div's height becomes the vertical gap between the
  stacked columns.
- **Stacking is `<head>` CSS, gated the same way visibility is.** `usesStackedColumns`
  only writes the `nl-stack` rules when a row actually asks to stack, so a newsletter
  without columns exports exactly the bytes it did before rows existed. `nl-stack` goes on
  the row's own table so the rules can't reach a row whose author opted out.
- **A non-column child of a row still renders**, in a cell of its own at an even width
  (`columnWidths`). Only a hand-edited project file can produce one, and giving it a cell
  beats dropping the author's block on the floor.

Column widths are percentages that should total 100. They're re-evened whenever the
*structure* changes — a column added, removed, or dragged into a different row — because
the old split no longer adds up; reordering within one row leaves them alone, since a
custom split is still meaningful there. `evenWidths` puts the remainder on the last column
(33.33 / 33.33 / 33.34) rather than spreading it, because a row totalling 99.99 leaves a
hairline of background showing in some clients.

*Should* total 100, but the per-column Width field takes any number, so both generators
renormalise before they emit anything — `columnWidths` for the table build and
`fluidShares` for the fluid one. Neither browser nor client does it: two columns set to
100 each are one full-width cell and one squeezed to its minimum, which is a button with
its label wrapped in half.

### The theme cascade

`EmailSettings.typography` is the project's global type scale — one
`TypographyStyle` per heading level plus `paragraph`, defined in
[utils/typography.ts](src/utils/typography.ts). H1 is largest down to H6, sized
for a 600px column rather than a web page.

**Blocks inherit from it.** Every typographic field on `heading`, `paragraph`
and `list` is optional, and **absent means "use the theme"**. A block that sets
a field overrides just that field:

```
DEFAULT_TYPOGRAPHY[key]  ←  settings.typography[key]  ←  the block's own fields
```

`resolveTextStyle(element, settings)` does the merge and is the **only** thing
that should read those fields. Reading `element.fontSize` directly gets
`undefined` for an inheriting block, which renders as `font-size:undefinedpx` —
the fields are optional precisely because absent carries meaning.

Consequences worth knowing:

- `renderElementToHtml(element, settings, opts?)` takes the **whole settings
  object**, not just the font stack, because it has to resolve the scale.
- Templates saved before the theme have every field set explicitly, so they
  render byte-identically and simply never consult it. Only new blocks — and
  ones reset in the Inspector — inherit.
- Heading `line-height` defaults to **1.2 at every level**, because that was
  hard-coded in the generator before the theme existed. Changing the default
  would silently reflow every heading in every saved newsletter.
- A `list` reads the `paragraph` entry. It's body copy, not a scale step of its
  own.
- The Inspector shows *resolved* values, marks which fields the block owns
  (`overriddenFields`) and offers a reset per field and a "Reset all"
  (`clearTextOverrides`). Showing a raw `undefined` would be meaningless, and
  showing the resolved number with no marker would hide that two blocks reading
  `16px` behave differently when the theme changes.
- `settings.typography` is the one non-scalar setting, so `normalizeSettings`
  validates it field by field — a `typeof` check against an object accepts any
  object, including one whose `h1.fontSize` is a string.

### Alignment

`TextAlign` (`'left' | 'center' | 'right'`) appears twice, with different rules:

- `image.alignment` and `button.alignment` are **required**. Both blocks are placed in a
  cell that has to align them, so there is no "unset" state; the Inspector offers no reset.
  A `button.fullWidth` button is the exception: it fills its cell, so there is nowhere for
  alignment to move it and the Inspector hides the control rather than showing a dead one.
  Full width is `display:block` on the `<a>` — padding comes out of the width rather than
  adding to it — and `mso-width-percent:1000` on the VML, since VML has no percentage
  `width`. It's optional and absent means the ordinary shrink-to-fit button, so the export
  is byte-identical for anything that hasn't asked for it.
- `heading`, `paragraph`, `list`, `quote`, `section` and `column` carry an **optional**
  `textAlign`, and **absent means inherit** — not left. A block follows the container
  around it until its author says otherwise, and `left` is a real value distinct from
  absent: it's how you opt one block out of a centred section.

Absent emits no `text-align` at all, which is what keeps a newsletter that has never used
alignment exporting the bytes it always did — the same bargain visibility and column
stacking strike. `alignStyle` in the generator is the one statement of that; note its
leading space, since every caller appends it to a style attribute that already ends in `;`.

Three consequences:

- **A container's alignment lands on its `<td>` and cascades.** That's what makes it "align
  everything in here", and it's why `section` can no longer take its "emits nothing of its
  own" early return when `textAlign` is set (`hasAlign`), and why `isBareColumn` is false
  for a column that aligns. Both would otherwise drop the cell the alignment lives on.
  `sectionPreviewStyle` / `columnPreviewStyle` in `Canvas.tsx` mirror it so the canvas
  cascades the same way — keep `undefined` as `undefined` there, or every container starts
  forcing `left` on its children.
- **A centred or right-aligned `list` also gets `list-style-position:inside`.** The default
  `outside` pins markers to the padding edge, so aligning the copy away from that edge
  strands the bullets. Left keeps `outside` — the nicer hanging indent, and the byte the
  generator has always emitted.
- Alignment is **not** part of the theme cascade. It's layout, in the same category as the
  margins `TypographyStyle` also leaves to the block, so `resolveTextStyle` never sees it
  and "Reset all" in the Inspector doesn't clear it. Its own reset is on its own control.

### Block backgrounds

Every block can be given a fill. `BaseElement.backgroundColor` is optional and **absent
means none**, the same bargain visibility, alignment and column stacking strike — a
newsletter that has never coloured a block exports exactly the bytes it did before the
field existed, which the fixture diff under *Verifying a change to the generator* confirms.
`ColorField` clears to `'transparent'`, so that string means "none" too.

**Three types don't use that field.** `section`, `column` and `quote` each have a required
`bgColor` — the fill of a box they have always drawn — and adding a second field behind the
first is how the two drift. `blockBackground(el)` / `withBlockBackground(el, color)` in
[elementHelpers.ts](src/utils/elementHelpers.ts) are the one statement of which field a
block uses, so the Inspector offers a single **Background** group on every type without
knowing. `button` is why the general field couldn't just be called `bgColor`: a button's
`bgColor` is the chip's own fill, and its block background is the cell behind it.

In the generator the fill is built into each case's own markup — `bgStyle` and `bgAttr`
return `''` for a block that has none, exactly like `alignStyle`. It lands on the `<td>`
for image, button, divider and spacer (with the `bgcolor` attribute beside it, which is
what Outlook's Word engine reads), on the element's own tag for heading, paragraph and
list, and on the row's `<table>`. Two consequences:

- **A filled row can't take its bare one-column early return**, for the same reason a
  section that aligns can't take its own: the table it would skip is where the fill lives.
  A border or a radius costs it the same way, and for the same reason.
  `rowPreviewStyle` in `Canvas.tsx` mirrors it, a row being the one container whose frame
  React draws.
- **`custom-html` gets a wrapper** — a one-cell table, and only when a fill, padding,
  border or radius is set. There's no markup of ours to put the colour on, and styling the
  first tag of what the author pasted would be editing their HTML.

A fill on a heading, paragraph or list hugs the text unless the block is padded — those
three carry both on their own tag.

### Block padding

Every block can be given padding on any of its four sides, and the fields for it live on
`BaseElement` — `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, all optional,
**absent meaning none**. Same bargain as backgrounds: a newsletter that has never padded a
block exports exactly the bytes it did before, which the fixture diff under *Verifying a
change to the generator* confirms.

They are the *same four names* the types that already padded themselves use, rather than a
general `padding` object sitting behind them — `section`, `column` and `image` simply
**narrow** the sides they require to `number`. That's the difference from backgrounds,
where `bgColor` was already taken and a second name was unavoidable. Two arms still have
their own rule:

- **`image` keeps its long-standing top/bottom pair required**, with left and right the
  optional ones from the base. The generator only widens to the shorthand once one of those
  is set, so an image that predates them keeps emitting `padding-top` / `padding-bottom`.
- **`quote` reads all four absent as the `16px 20px` it used to hard-code**, exactly like
  `quoteBorderWidths` does for its 4px left rule. All four at 0 is a real value distinct
  from absent, which is why the Inspector writes every side rather than a patch.

`blockPadding(el)` / `withBlockPadding(el, patch)` in
[elementHelpers.ts](src/utils/elementHelpers.ts) are the one statement of all that, so the
Inspector offers a single **Padding** group on every type without knowing which arm it is
editing. `withBlockPadding` drops a side's field when it goes back to 0, except for the
sides in `REQUIRED_SIDES` — which is keyed *per side*, not per type, because `image` is
split down the middle: its top and bottom are seeded by `createNewElement` so a dropped
zero would come back as the default on the next load, while its left and right are the
general optional pair and can go. Padding a block and clearing it again therefore leaves
both the project file and the export byte-identical.

In the generator `paddingStyle(element)` returns `''` for a block with none, exactly like
`alignStyle` and `bgStyle`, and `paddingShorthand` collapses to the shortest form that says
the same thing — which is not cosmetic: only the two-value form emits the `padding:16px
20px;` a quote has always had. Five arms don't use `paddingStyle`, each because it has
bytes to preserve that a plain shorthand would change: `section` and `column` have always
written the four-value form on their `<td>`, `image` its two declarations, `quote` its
legacy default, and `list` already writes the property. Four consequences:

- **A list's padding-left and its `indent` add up.** The indent is the marker's own hanging
  distance and the padding is the box, so they're summed into one declaration; the Inspector
  says so rather than pretending one of them isn't there.
- **A padded divider moves its rule into a `<div>`.** A border sits *outside* padding, so
  leaving the rule on the `<td>` would put the line above the space instead of inside it,
  and left/right padding wouldn't shorten the rule — the one thing a padded divider is for.
- **A padded row grows a wrapper `<td>`**, which also takes the margins and the fill so the
  colour covers the padding. Padding can't go on the strip's own `<table>` (Word pads a
  `<td>`, not a table) nor on the column cells (that would inset the gaps between them
  too). Like a fill, it costs the row its bare one-column early return, and
  `rowPreviewStyle` in `Canvas.tsx` mirrors it.
- **A button's padding is the space around it, not the chip.** `paddingVertical` /
  `paddingHorizontal` inflate the `<a>`; these four land on the cell holding it. It's why
  the Inspector labels the first pair "Padding Y / X" under *Shape*.

### Block borders and rounded corners

Every block can be given a border on any of its four sides and a corner radius, and the
fields for both live on `BaseElement` — `borderTopWidth` … `borderLeftWidth`, `borderStyle`,
`borderColor` and `borderRadius`, all optional, **absent meaning none**. Same bargain as
backgrounds and padding, confirmed the same way: the fixture diff under *Verifying a change
to the generator* is empty for a newsletter that uses neither.

They are the *same names* the types that already drew a border or rounded themselves use,
rather than a second set behind them — `section` and `column` **narrow** all six to
`number`, and `button` narrows `borderRadius`. That's the padding pattern, not the
background one, because no name was already taken. Two arms keep a rule of their own:

- **`quote` reads all four widths absent as its 4px left rule**, and an absent radius as
  the `4px` it used to hard-code. All four widths at 0 is a real value distinct from
  absent, which is why the widths are stored rather than dropped for that type.
- **`button` means the chip, not the cell.** Its radius and its border draw on the `<a>`,
  the same split `bgColor` makes — the block's *background* is the cell behind it, but
  someone asking to round or outline a button means the button.

`blockBorder(el)` / `withBlockBorder(el, patch)` and `blockRadius(el)` / `withBlockRadius(el, r)`
in [elementHelpers.ts](src/utils/elementHelpers.ts) are the one statement of all that, so
the Inspector offers a single **Border** and **Rounded corners** group on every type
without knowing which arm it is editing. `withBlockBorder` drops all six fields when no
side is left, and `withBlockRadius` drops the radius at 0, except for the types in
`REQUIRED_BORDER_TYPES` / `REQUIRED_RADIUS_TYPES` — so turning either on and off again
leaves the project file and the export byte-identical.

In the generator `borderStyle(element)` and `radiusStyle(element)` return `''` for a block
that has neither, exactly like `alignStyle`, `bgStyle` and `paddingStyle`, and land on the
same box the fill does. Four consequences:

- **A bordered or rounded row keeps its table**, and a bordered or rounded column keeps its
  cell (`isBareColumn`) — the box the declaration lives on is the one the early return
  would skip. `rowPreviewStyle` in `Canvas.tsx` mirrors both.
- **A bordered divider moves its rule into a `<div>`**, exactly as a padded one does. The
  rule *is* a `border-top` on the `<td>`, and a block border would be a second one on the
  same cell where only one can win.
- **Outlook takes the border on a button but not the rounding.** The VML fallback strokes
  a shape with one width and one colour, so `strokecolor` / `strokeweight` are written only
  when all four sides match; an uneven border is left to the clients that can draw it
  rather than guessing which side Outlook should show. `stroke="f"` is still what a button
  with no border emits.
- **Nothing clips children to a radius.** Rounding a section rounds its own fill and
  border; the blocks inside keep their corners. The Inspector says so.

### Block margins

Every block can be given a margin on any of its four sides, and the fields live on
`BaseElement` — `marginTop` … `marginLeft`, all optional, **absent meaning none**. Same
bargain as backgrounds, padding and borders, confirmed the same way: the fixture diff under
*Verifying a change to the generator* is empty for a newsletter that has never set one.

They are the *same names* the eight types that always had a vertical margin use, rather
than a second set behind them — that's the padding pattern again. Those eight narrow
`marginTop` / `marginBottom` to `number` and keep writing both out even at 0;
`marginLeft` / `marginRight` are the general optional pair. `blockMargin(el)` /
`withBlockMargin(el, patch)` in [elementHelpers.ts](src/utils/elementHelpers.ts) are the one
statement of that, so the Inspector offers a single **Margin** group without knowing which
arm it is editing, and `REQUIRED_MARGIN_SIDES` — keyed per side, like `REQUIRED_SIDES` —
is why setting a margin and clearing it again leaves the project file and the export
byte-identical. There is no legacy default anywhere here: unlike padding and borders, no
block ever hard-coded a margin, so absent is 0 on every type.

**Where a margin lands depends on the block's own box**, because `margin-left` on a
`<table width="100%">` doesn't inset it — the table is already as wide as the thing holding
it, so the margin pushes it out the other side. Three arms, all in `applyOuterMargin`:

- **`heading`, `paragraph`, `list` and `quote` take all four on their own tag**
  (`TAG_MARGIN_TYPES`). Those tags are auto-width, so a horizontal margin narrows them.
  `tagMargin` widens to the four-value shorthand only once a horizontal side is set — the
  same trick the image's padding plays — and `list` widens on its own terms, since it has
  always written `margin:8px 0 16px 0` with *bare* zeros in those slots.
- **`button`, `section`, `row` and `divider` keep their vertical pair on their own table**
  (`TABLE_MARGIN_TYPES`, via `tableMargin`), and only the horizontal pair grows a wrapper.
- **`image`, `spacer` and `custom-html` never had a margin field**, so all four go through
  the wrapper and none of it costs an existing newsletter a byte.

The wrapper is a one-cell table whose `<td>` carries the margin **as padding**. That is the
one form of "space outside this block" a table layout renders the way it reads, and it sits
outside the block's fill, border and radius, which are all on the inner box. It's applied
in `renderElementToHtml` rather than per case, so it lands outside anything a case has
already wrapped — a padded row's own wrapper cell included.

Three consequences:

- **A `column`'s margin is applied by `columnCell`, not by the wrapper.** The cell a column
  lives in belongs to the row, and it is where the column's padding, fill, border and radius
  all land — so a margin has nowhere outside them to go. When one is set, the cell keeps its
  width and vertical alignment, takes the margin as padding, and hands the *box* to a table
  inside itself; with no margin it emits exactly the single cell it always did.
  `COLUMN_CLASS` stays on the outer cell, so stacking still works and the margin travels to
  mobile. A margined column is therefore no longer `isBareColumn`, which is what stops a
  one-column row taking the early return that would drop the cell.
- **The wrapper goes on the canvas too** — it isn't editor chrome, and leaving it off would
  make the preview disagree with the email. Containers don't see it (the canvas draws their
  frame in React), so `sectionPreviewStyle`, `rowPreviewStyle` and `columnPreviewStyle` in
  `Canvas.tsx` mirror all four sides themselves — as a margin on the flex item, which
  `flexShrink` absorbs the way it already absorbs the row's gap.
- **The Inspector shows Margin immediately above Padding**, on every type — the pair people
  reach for together, read outside-in so it's obvious they aren't the same knob.

A horizontal margin is *not* a reason for a bare section or a one-column row to keep its
table: the wrapper is outside it either way, which is why `hasSpacing` and the row's early
return still ask only about the vertical pair.

### Rendering: one generator, two consumers

[src/utils/htmlGenerator.ts](src/utils/htmlGenerator.ts) is the single source of email markup.

- `renderElementToHtml(element, settings, opts?)` — one block's HTML.
  [Canvas](src/components/canvas/Canvas.tsx) injects this per element via
  `dangerouslySetInnerHTML` so blocks stay individually clickable.
- `generateEmailHtml(template, exportOpts?)` — the full document, used by Export and
  Preview. `exportOpts.fluid` picks the paste-safe build — see *The two export builds*.

Because the canvas renders the *real* generated HTML rather than a React lookalike, the
preview and the export can't drift. Keep it that way: **never add a parallel React-based
renderer for a block.** For the same reason [index.css](src/index.css) carries no reset
targeting generated markup — email HTML inlines every style precisely because it can't
rely on a stylesheet, so overriding Tailwind's preflight there would make the canvas
disagree with the email.

### The two export builds

`generateEmailHtml(template, { fluid: true })` emits a second build of the same email, and
the Export modal offers both: **For sending** (the default) and **For pasting into Gmail**.

They differ in one thing — *where the responsive layout is stated*.

The ordinary build states it in the `<head>` stylesheet: `.email-container` goes full
width under `max-width: 600px`, `.responsive-td` drops its padding, and `.nl-stack .nl-col`
turns a row's cells into full-width blocks. That is the better markup, and it is what every
client renders when the file is *sent* as the message body.

**A Gmail compose window strips all of it.** Paste into one — or let the Chrome extension
insert into one — and only body markup with inline styles survives; `<head>` and every
`<style>` block are dropped. The message then arrives fixed at `settings.width`, and the
phone scales the whole 600px card down rather than reflowing it. That is the bug the fluid
build exists for, and it is *not* visible in Preview, which renders the whole document in
an iframe where the stylesheet is intact.

The fluid build changes exactly two things, both inline:

- **The card states `width:100%`** instead of `width:${settings.width}px`, so the
  declaration the media query exists to override is already fluid. Outlook is unaffected —
  the MSO ghost table above it still pins the width. For a newsletter with no columns this
  is the *only* difference, a single byte, and it is enough.
- **A row's columns become inline-block `<div>`s** rather than `<td>`s (`renderFluidRow`),
  and each one — column or gap — is sized by `fluidTrack`, which is the media query
  restated as four declarations the client can evaluate itself:

  ```
  width:100%; width:calc((552px - 100%) * 999); min-width:48.57%; max-width:100%;
  ```

  `100%` inside `calc` is the *container's* width, and a used width is `width` clamped
  between `min-width` and `max-width`, so the expression is a switch that reads the space
  actually available. On a container at least as wide as the row, the difference is
  negative, `width` clamps to 0 and `min-width` — the column's share — wins, so the
  columns sit side by side at the proportions the table build gives them. On a phone the
  difference is positive, ×999 makes it wider than any screen, and `max-width:100%` clamps
  it back to the whole line: **every column fills the line, so two or three columns become
  one stacked column**, with no stylesheet involved. The bare `width:100%` in front is the
  fallback for a client that drops the declaration it can't parse, and it states the
  *stacked* layout deliberately — see the Gmail limit below.

Five things are load-bearing:

- **`opts.width` is threaded down the tree.** `generateEmailHtml` seeds it with
  `settings.width - settings.padding * 2`, and `narrow(opts, inset)` takes off whatever
  each container spends: a section's padding and borders, a column's padding, borders and
  margin, a row's own box, and the wrapper `applyOuterMargin` builds. Outside fluid mode
  `narrow` returns `opts` untouched, so nothing else in the generator pays for it.
  **A column narrows from its own share, not from the row's line** — the share is the
  div's whole width, and a nested row handed the line thinks it is wider than the thing
  holding it, which lays it out as though it had already stacked.
- **`fluidShares` returns whole pixels that total the width exactly.** They size Outlook's
  ghost cells, and `fluidTrack` turns them into the percentages every other client lays
  out from, so a share rounded *up* anywhere is a row whose tracks total more than 100%.
  Floor everywhere and give the remainder to the last column, the way `evenWidths` splits
  percentages. It also normalises widths that don't total 100 — as does
  `columnWidths` for the table build, which is **not** something the browser does for
  you: two cells that each ask for 100% are laid out as one full-width cell and one
  squeezed to its minimum, not as halves.
- **The tracks are percentages, and `min-width` is why.** `min-width` is a floor: a px
  floor is one a narrow enough screen can't honour, and the column would then be wider
  than the phone. A percentage cannot overflow, and it makes the row shrink gracefully
  between its breakpoint and its design width instead of standing at a fixed size.
- **The breakpoint is the row's line less `FLUID_STACK_TOLERANCE`.** The switch is a hard
  threshold — a hair either side is a different layout — and some clients inset the message
  body by a pixel or two of their own. A desktop layout that collapsed because the card
  came out 599px wide would be worse than the bug the whole build exists to fix.
- **Outlook gets ghost cells.** The Word engine has no inline-block, so `<!--[if mso]>`
  conditionals rebuild the row as the table it does understand. Gmail strips comments on
  paste too, so an Outlook recipient of a *pasted* message sees the columns stacked —
  which is the trade the mode is, and why the modal says to prefer **For sending**.

Two limits worth knowing, both stated in the modal:

- **Gmail never evaluates the switch, so a pasted message stacks at every width.** It
  strips `calc()` from inline styles, and its compose sanitizer takes `display:inline-block`
  off these divs as well — which is why the fallback is `width:100%` rather than the share.
  Gmail's columns are going to stack whatever width they're given, so the choice was
  full-width stacked or stacked at half the screen. Confirmed from a phone: with the share
  as the fallback, a two-column row arrived stacked at 48% of the screen. Anything that
  honours `calc` — Apple Mail, iOS Mail — reads the switch and lays out properly at both
  ends. A row that needs to stay side by side in Gmail is one that should turn *off*
  stacking, which keeps it a table in both builds.
- **A row nested inside a column doesn't stack when the outer row does.** The switch can
  only see its own container, and a column that has stacked is *wider* than the share its
  nested row was laid out for — the two overlap, so no threshold tells them apart. The
  nested row stacks on its own once the screen is narrow enough to squeeze the column
  below its breakpoint. Where the stylesheet survives, `.nl-stack .nl-col` stacks every
  row at every depth on top of this, which is why the fluid build still writes the
  `<style>` block.

The gap is a track like the columns are (`fluidGapDiv`, the twin of `columnGapCell`), so
it goes full width when the row stacks and the `<div>` it holds becomes the vertical
gutter — the same thing `.nl-gap` does where the stylesheet survives.

A row that opted *out* of stacking keeps the table in both builds — a table is the thing
that reliably never wraps.

`TopBar`'s Gmail insert always uses the fluid build, because it only ever lands in a
compose window. Preview and the canvas never do.

**Verify a change here with a browser, not by eye.** Render both builds, strip the
`<style>` block from the fluid one to simulate the paste, and measure the columns in
iframes at 320 / 375 / 430 / 600 and at a real desktop width. The properties to hold are:
`document.body.scrollWidth` never exceeds the viewport, desktop column widths match the
table build's, and every row is one column per line by a phone width. The ordinary build's
diff must stay empty — see *Verifying a change to the generator*.

Headless Chrome is enough for this and a fixture is worth building for it — the useful
harness is a page that writes each build into an `<iframe>` per width and reports
`getBoundingClientRect()` for every `.nl-col`, dumped with `--dump-dom`. Measure rather
than screenshot: the failure mode this build had before `fluidTrack` was a page 559,480px
wide, which a screenshot at 375px shows as an ordinary-looking column of text. Note that
`--window-size` won't go below ~500px on macOS, which is why the widths have to be iframes
inside one wide window.

### The mobile view shows the layout, not the media query

The device switch used to simulate `@media (max-width: 600px)`: the canvas stacked a row's
columns, and the preview narrowed its iframe until the real stylesheet fired. Both are gone.
**The mobile view is now the same layout, smaller** — the canvas draws a 375px card with
the columns still side by side at their percentages, and the preview renders at the design
width and CSS-scales the iframe down, which is what a phone does with an email that can't
reflow.

The reason is that the media query only reaches the reader when the file is *sent*. Paste
into a Gmail compose window — the flow this app is built around, and what its own Copy for
Gmail button does — and the `<head>` is stripped on the way in, so the columns don't stack
and the phone zooms out instead. A preview that stacked them was telling the author
something that wasn't true of the email they were about to send, and the narrow canvas was
the easiest place in the app to believe.

It now understates the sent case rather than overstating the pasted one, so the preview
says so in a line under its header. Keep that note if you touch this: the mobile view is
deliberately showing the worse of the two outcomes.

`stacksOnMobile` in `Canvas.tsx` and the `stacked` arm of `columnPreviewStyle` were the
simulation, and both are deleted — don't reintroduce a canvas that lays out differently
from the markup the blocks state.

### Per-device visibility

`BaseElement.visibility` (`{ desktop?, mobile? }`) hides a block on one device. Absent —
or either side absent — means shown.

`applyVisibility` wraps the block in a `<div>` carrying `nl-hide-sm` / `nl-only-sm`, and
`generateEmailHtml` only writes those rules into `<head>` when `usesVisibility` finds a
block that actually uses them. **A newsletter that doesn't use the feature exports exactly
what it exported before the feature existed** — that property is what makes "did my change
alter the email?" answerable with `diff`, and it's worth preserving.

Two things to keep:

- Visibility is **never applied on the canvas** (`opts.editable` skips it). Hiding a block
  must not make it unselectable; `BlockFrame` dims it and shows an eye-off badge instead.
- Hiding depends on `<head>` CSS, which some clients strip. The Visibility tab says so.

### Inline editing (WYSIWYG)

`renderElementToHtml` takes an optional `{ editable: true }`, passed only by `Canvas`. It
wraps each user-typeable field in a marker node carrying `data-edit-field="<propName>"`,
plus `data-edit-empty="1"` on a blank field so there's something to click. Export paths
never pass it, so the emitted email HTML is unchanged — keep it that way, and never add
editor chrome to the default (export) branch.

Each field declares an `EditMode`, the fourth argument to `editableField`:

| Mode | Emitted as | Committed as | Enter |
| --- | --- | --- | --- |
| `plain` | `<span>` | `textContent` | saves |
| `rich` | `<div data-edit-rich data-edit-enter="rich">` | sanitized HTML | new paragraph |
| `item` | `<span data-edit-rich data-edit-enter="item">` | sanitized HTML | new list item |

`rich` is a `<div>` because a paragraph break is block-level and a browser asked to put a
`<p>` inside a `<span>` will do something else instead. Shift+Enter is a `<br>` in both
rich modes.

[BlockBody.tsx](src/components/canvas/BlockBody.tsx) drives the editing:

- **The `dangerouslySetInnerHTML` object is memoised, and that is load-bearing.** React
  compares that prop **by reference**. A fresh `{ __html }` literal each render re-assigns
  `innerHTML` every render even when the string is identical — throwing away the field's
  DOM node along with `contentEditable`, the focus and the caret. This block re-renders on
  hover, selection, drag state and the editing session itself, so without the memo editing
  never starts at all.
- The **first** click selects the block; a **second** click on a marked field starts
  editing it. Editing can't start on the selecting click, because opening the Inspector
  can shift the canvas and the cursor would end up over different content.
- The `data-edit-field` value must be the element's property name, or `name.index` for one
  entry of an array of strings (`items.2`) — `commitField` writes it straight back to
  `element[field]`. That one level of nesting is all it understands.
- Edits commit **on blur**, not per keystroke: committing regenerates the block's HTML and
  replaces these DOM nodes, which would drop the caret. Escape abandons.
- Read plain fields with `textContent`, never `innerText` — `innerText` returns the
  *rendered* text, so a heading with `text-transform:uppercase` would save back SHOUTING.

### The editing session and the docked toolbar

The formatting bar is **docked** in the strip above the canvas
([CanvasToolbar](src/components/shell/CanvasToolbar.tsx) swaps it in whenever a `rich` or
`item` field is open), not floating over the text as in v1. That deletes all of v1's
positioning code — no `getBoundingClientRect`, no capture-phase `scroll` listener, no
flipping below the text — and the bar can never cover what's being edited.

What docking costs is proximity, which
[EditingSession.tsx](src/state/EditingSession.tsx) pays for. It holds the active field's
node, its mode, the remembered selection and `runCommand`, so a toolbar in a completely
different subtree can act on the text. Three invariants:

- **Every toolbar control cancels its own `mousedown`** (`keepSelection` in
  [TextToolbar.tsx](src/components/canvas/TextToolbar.tsx)). Clicking anything focusable
  collapses the selection in a contenteditable, and the command would then apply to
  nothing. `<select>` and `<input type="color">` are the exceptions — they won't open if
  their `mousedown` is cancelled — so `runCommand` restores `savedRange` before every
  command, and `selectionchange` keeps that range current.
- **Blur is judged by `isEditorChrome(relatedTarget)`**, not by a wrapper ref. The bar is
  no longer a DOM sibling of the text, so "did focus leave the editor?" is answered by the
  `data-editor-chrome` attribute. Put that attribute on anything that must not end the
  edit when clicked.
- **The bar's own dropdowns are portalled to the body** (`Popover` in `TextToolbar`).
  The strip is `overflow-x-auto` so it can scroll sideways on a narrow window, and an
  overflow container clips in *both* axes — a menu hanging below the bar is cut off at
  its bottom edge whatever its `z-index`, because stacking order can't escape a clipping
  ancestor. `Popover` positions from the trigger's rect, re-places on capture-phase
  scroll and resize, and carries `editorChromeProps` on the portalled node itself, since
  it is no longer inside the toolbar's subtree for the blur check to find.
- The **block-format dropdown is not a text command.** It changes the block's *type*
  (`convertTextBlock`) and goes through `updateElement`. Converting a paragraph to a
  heading flattens its markup — a heading holds one line of plain text — which is the
  honest outcome, not a bug.

### The Inspector's rich-text editor

[RichTextField](src/components/RichTextField.tsx) is a Lexical editor hosted in the
paragraph's **Content** tab. It is a *view* onto the element's `content`, which is still
the same string of email-safe HTML the canvas and the export read:

```
content ──$generateNodesFromDOM──▶ EditorState ──$generateHtmlFromNodes──▶ sanitizeRichHtml ──▶ content
```

Lexical's export is **not** shippable markup — theme classes, `white-space: pre-wrap`
spans, a doubled tag per format — so it never reaches `content` without `sanitizeRichHtml`.

Four things are load-bearing:

- **Only a user edit writes back** (`userEditedRef`), set from **capture-phase** handlers.
  A round trip through Lexical normalises markup slightly, so emitting on mount would
  rewrite someone's hand-authored HTML just because they selected the block. A bubble-phase
  flag arrives one keystroke late and the first character never reaches `content`.
- **Re-seeding never writes back.** When `value` changes from elsewhere — canvas editing,
  or the HTML source box — the editor is re-seeded under an `external` tag the emit path
  ignores. Without it, typing `<stro` into the source box would be parsed, sanitized and
  written back over the half-finished tag.
- **`HTML_IMPORT` carries inline styles onto text nodes.** Lexical's own importers ignore
  `color` / `font-size` on a `<span>`. Because Lexical resolves exactly one importer per
  element, the override also has to re-apply the tag's own meaning. The decision to take an
  element over belongs in the **selector**, which returns `null` to hand it back; a
  conversion that returns null leaves the element with no importer at all.
- **Every toolbar control cancels its own `mousedown`**, same as the canvas bar.

The field is keyed on `element.id` so switching blocks gets a fresh editor rather than one
carrying the previous block's undo history. Below it sits a collapsed **Edit HTML source**
disclosure — the deliberate unsanitized path.

### Nothing goes into an element's `content` unsanitized

[src/utils/richText.ts](src/utils/richText.ts) normalises whatever `contenteditable` and
`execCommand` produced before it is stored. Browsers disagree wildly here — `<b>` in one,
`<span style="font-weight: 700">` in another, `<div>`s for line breaks, leftover `<font>`
tags — and none of it can be assumed to survive Gmail or Outlook.

`sanitizeRichHtml` keeps only `p`, `br`, `strong`, `em`, `u`, `s`, `span` and `a`;
rewrites `b`/`i`/`strike`/`div`/`font` to those; re-expresses styled bold/italic/underline
as **tags**, because Outlook's Word engine drops inherited font styling on some containers;
and filters `style` down to colour, size, family, weight, style, decoration, background
and margin. Tags that hold code rather than text (`script`, `style`, `iframe`, …) are
removed whole instead of unwrapped, or their source would land in the newsletter as
visible copy.

Two passes exist for what the editors hand it rather than for what a user typed:

- `collapseNestedEmphasis` flattens `<strong><strong>x</strong></strong>` to one tag —
  Lexical's HTML export states every text format twice.
- `normalizeColor` rewrites `rgb(37, 99, 235)` to `#2563eb`. The CSSOM returns colours in
  functional notation whatever was written, and Outlook is unreliable with it.

It is idempotent, which matters because a field is re-sanitized on every edit.
`allowParagraphs` is false for a list item — one line — where a paragraph break becomes a
`<br>`.

The selection commands that need more than a bare `execCommand` also live here:
`applyFontSize`, `applyFontFamily`, `applyColor`, `applyHighlight`, `applyLink`. The first
two use the same trick — let `execCommand` do the hard part (splitting the range across
existing tags) with a sentinel value, then rewrite what it produced into email-safe markup.

**Removing a colour uses that trick too.** `applyColor(root, INHERIT_COLOR)` and
`applyHighlight(root, NO_HIGHLIGHT)` are how the toolbars offer "Default colour" and "No
highlight", and neither can be "delete the style attribute": the colour usually sits on a
span reaching further than the selection does, and only `execCommand` splits that span and
pushes the ancestor's colour down onto the parts either side. So they apply
`COLOR_SENTINEL` — a colour nothing real uses — and then delete the declarations carrying
it. They take the field's node for that, which is why both are called with `node` from
`EditingSession`. Asking the browser for `transparent` directly is the thing to avoid: it
writes `background-color:transparent` rather than removing anything, which looks cleared on
the canvas but ships a declaration Outlook can render as an opaque box. `filterStyle` drops
any colour that paints nothing as a backstop. The Inspector's Lexical toolbar reaches the
same outcome through `$patchStyleText` with a `null` value, which removes the property.

`RICH_TEXT_FONT_SIZES`, `RICH_TEXT_COLORS`, `RICH_TEXT_HIGHLIGHTS` and `RICH_TEXT_FONTS`
live here too, so the canvas bar, the Inspector's editor and the Theme panel all offer the
same set. Add a size, swatch or font there — not in a toolbar.

**Don't sanitize at render time.** The HTML source box is a deliberate hand-authoring path,
and rewriting what someone typed there while they type it is unusable.

### Selecting a container that's full

A section is mostly covered by its children, and every block stops its click bubbling, so
clicking "the section" only works on whatever sliver of its own padding is exposed. Three
affordances stand in for that:

- The **Sections outline** ([SectionsPanel](src/components/panels/SectionsPanel.tsx)) is a
  tree of the whole email — every section, and every block inside it, however deep. The
  most reliable route, and the only one that always works; it's also how you reach a
  column, whose own padding is often a few pixels wide. **Clicking anywhere on a row
  selects that block**, which rings it on the canvas, scrolls it into view (`scrollerRef`
  in `Canvas.tsx`, `block: 'nearest'` so a block already on screen never moves) and opens
  its Inspector. That's why renaming is the row's **pencil** button rather than a click on
  the label, and why every other control in the row stops its own click: selecting swaps
  this panel for the Inspector, so a click that meant "expand" or "rename" would take the
  outline away in the same gesture.
- Every top-level section wears a **name chip in the gutter** to the left of the email.
  It's in the gutter rather than above the section because bare sections are flush against
  each other, and a chip above would land on the previous section's last line.
- A **step-out button** (`CornerLeftUp`) on any block's tab selects the section it lives
  in, and a nested section whose subtree holds the active block shows a **compact badge**
  at its top-*right* (right, because tabs sit at the top-left). Top-level sections skip the
  compact badge — the gutter chip already does that job.

Hover is tracked with a bubbling `onMouseOver` on each block wrapper (innermost stops
propagation), plus one `onMouseLeave` on the canvas root. It was per-block enter/leave, but
leaving a child cleared the hover outright and tore down the section badge the cursor was
travelling towards. **Hover must only ever move from one block to another.** For the same
reason the badges swallow `mouseover` instead of forwarding it.

### Drag to reorder

Blocks reorder by dragging the grip on the selection tab or the move handle on the action
rail. The wrapper is only `draggable` while one of those is held (`armedId` in `Canvas`) —
a permanently draggable wrapper would block text selection during inline editing, and a
stray `<img>` drag inside the generated HTML would start a phantom reorder.

Drops resolve through `reorderElement`, which removes the block from wherever it lives and
re-inserts it `'before'` / `'after'` the target, or — for a container target — `'inside'`
it as the last child. Source and target can be in different lists, so this also moves
blocks into and out of sections; the one guard is that a container can't be dropped into
its own subtree.

`Canvas` picks the position in `dragProps`'s `onDragOver`: plain blocks split
top-half/bottom-half, containers reserve a ~14px strip at each edge for before/after and
treat the rest as `'inside'`. Children stop `dragover` bubbling, so a container only sees
events over its own padding. An empty container renders a dashed placeholder — without it
there'd be nothing to aim at.

The Sections outline has its own drag, over the same tree and calling the same
`reorderElement`. It differs in two ways. It draws its own rows, so a row is a drop target
at any depth and a container takes `'inside'` in its middle band with before/after at the
edges — no pixel strip, since the rows are a uniform height. And it decides legality
*itself*, from a parent map built over the tree: `reorderElement` refuses an illegal move
but refuses it silently, so the outline has to know while dragging whether to draw the
line. When the position under the cursor is illegal it falls back to the other legal one
rather than going dead — dropping a paragraph on a row's own heading means "into the
section that row lives in".

### Sections are the only home for blocks

`canSitAtTopLevel(type)` is the rule: **only containers may sit at the top level** — and a
`column` doesn't count, since it means nothing outside a row. Everything else has to live
inside a container. Both placement paths enforce it, together with `canNest`:

- **Adding.** `addElement` routes a click into `addTarget` — the selected section, or the
  section holding the selected block. `resolveAddParent` then checks `canNest`: a selected
  *row* only holds columns, so clicking "Text" while one is selected means its first
  column. With nothing selected, a non-container click is refused with a notice rather
  than dropped loose at the end.
- **Dragging.** `dragProps` computes it per target from the *parent's type* — landing
  beside a block means landing where that block lives. When only one outcome is legal the
  whole box takes it, so there's no dead edge strip to fall into. `reorderElement`
  re-checks with the same `canNest` as a backstop.

`BLANK_CANVAS_TEMPLATE` seeds three bare sections — Header, Body, Footer — so a new
newsletter always has somewhere to put the first block.

### Migrating pre-section templates

`migrateToSections(elements)` wraps each *run* of consecutive loose top-level blocks in one
`createBareSection`. Consecutive blocks share a wrapper so the author's grouping survives
instead of exploding into a section per paragraph; existing containers stay put. It's
idempotent, so it's safe to run on every load. Both load paths call it and report the
count, so the user is told their work was restructured.

**The wrap is byte-neutral in the export, and must stay that way.** A section with no
border, padding, margin or fill emits *only its children* — `renderElementBody` returns
early before building the wrapper table, joining them with `\n\n` to match how
`generateEmailHtml` joins top-level blocks. That early return is what lets migration
restructure someone's saved newsletter without changing a byte of the email they send. It
also keeps empty wrapper tables out of the output, which matters because Gmail clips
messages at ~102KB. If you change the `section` generator, keep the early return and
re-check that migrating a legacy template is a no-op on `generateEmailHtml`.

### Removed and renamed block types load as their replacement

Three types have been retired, and all are converted on load rather than dropped:

- `accent-section` → `section` (`convertLegacyAccentSection`) — the "Red Accent Block",
  removed once `section` could draw a single-sided border
- `header-image` → `image` (`convertLegacyHeaderImage`) — never actually restricted to the
  top of the email, so it was renamed to the generic **Image**
- `key-value` → `paragraph` (`convertLegacyKeyValue`) — one line of "**Label** value" with
  independent colour and emphasis per half, all of which a paragraph's rich `content`
  already expresses

All three conversions are **silent**: the block keeps looking the way its author left it.

Both load paths have to do this, and they hook it at different points, because a project
file is validated against `ELEMENT_TYPES` *before* `migrateToSections` runs:

- `parseTemplateFile` converts in `normalizeElement`, ahead of the type check — otherwise
  the block would be dropped as unknown with a warning
- `migrateToSections` converts the whole tree first (`convertLegacyBlocks`), which covers
  the `localStorage` path

Follow that shape if another type is ever retired: convert at both points, keep it
idempotent, and don't leave the dead type in `ElementType`. A *rename* is the same job.

### Palette drag-and-drop

Palette items in `BlocksPanel` are drag sources; `Canvas` resolves the drop. `paletteDrag`
lives in `DesignerContext` because `dataTransfer` can't be read during `dragover` — the
canvas has to know what's coming to decide whether a block is a legal target, so it's
passed through state instead.

What it carries is a **`BlockRecipe`, not an `ElementType`**. "1 Column", "2 Columns" and
"3 Columns" are all a `row`, differing only in how many `column`s it starts with — a shape
rather than a type — so an `ElementType` wouldn't say enough to build the block.
`recipeType` resolves a recipe back to its type wherever a placement rule needs one, which
is what keeps a dragged "3 Columns" obeying exactly the same rules as any other row. Add a
new palette preset by adding a recipe, not an `ElementType`; `columns-N` is parsed for its
count, so a fourth card needs only a list entry.

Two consequences:

- `Canvas` unifies the two drag kinds into `activeDragType` (`recipeType(paletteDrag)` for
  a new block, `draggingType` for a reorder). Placement rules are written against the
  type, so they apply identically to both.
- A palette drag starts on a panel button, so no canvas block ever sees its `dragend`. A
  `useEffect` on `paletteDrag` clears `dropTarget`; without it an abandoned drag leaves a
  block stuck showing a drop highlight.

Don't put "add block" buttons in the Inspector — a grid of them used to live there in v1
and gave sections two competing ways to be filled. The palette is the one way in.

### The Inspector's tabs

Tabs are **per element type** (`tabsFor` in
[BlockInspector.tsx](src/components/panels/inspector/BlockInspector.tsx)):

| Type | Tabs |
| --- | --- |
| `image`, `button`, `spacer`, `list`, `paragraph` | Content · Styles · Visibility · Code |
| `heading`, `quote`, `divider`, `section`, `row` | Styles · Visibility · Code |
| `custom-html` | Styles · Code · Visibility |
| `column` | Styles |

`custom-html`'s Styles tab holds only the five shared groups — **Background**,
**Padding**, **Border**, **Rounded corners** and **Margin** — the things the app can give a
raw HTML block without editing the markup its author pasted, since all of them land on a
wrapper cell. `defaultTabFor` still opens it on Code.

Text blocks other than `paragraph` have no Content tab: their content is typed straight
onto the canvas, and a second field saying the same thing is a second place for the two to
disagree. `defaultTabFor` in `DesignerContext` picks the opening tab when the selection
changes, and `BlockInspector` falls back if the open tab doesn't exist on the new type.

The **Code** tab shows what the block emits and lets it be hand-edited. Saving hand-edited
markup on a typed block **converts it to a `custom-html` element**, stashing the original
on `convertedFrom` so Revert can restore it. Arbitrary HTML can't be parsed back into typed
fields like `fontSize`, so don't try to make the code view round-trip.

A **column** is the one type with a single tab, and both omissions are deliberate. It has
no Code tab because saving there would convert it to `custom-html`, leaving a row holding
something that isn't a column — and a column has no markup of its own anyway, since the
`<td>` belongs to the row. It has no Visibility tab because hiding it would leave that
`<td>` in the table still holding its share of the width: an empty gap rather than the
other columns widening, which is not what the control promises.

## Email HTML constraints

The output targets Gmail, Outlook, and Apple Mail. When editing `htmlGenerator.ts`:

- Layout with **nested `<table>` elements**, not flexbox or grid
- **Inline every style** on the element. `<head>` CSS is for media queries only —
  Gmail strips most of it
- Use **system/email-safe font stacks** (`RICH_TEXT_FONTS`). Webfont `@import`s largely
  don't work in email clients
- **Run every font stack through `cssFontFamily` before it goes in a `style` attribute.**
  `font-family:"Helvetica Neue", …` inside `style="…"` ends the attribute at the inner
  quote: the browser keeps what came before it and throws away the font *and every
  declaration after it*. A v1 export rendered in Times with no bold once Gmail stripped
  the `<head>` CSS that was masking it. `sanitizeRichHtml` does the same swap, because the
  CSSOM serialises `font-family` with double quotes
- More generally: anything interpolated into a `style="…"` must not contain a double quote
- Container width is `settings.width` (default 600px), with `max-width` for mobile
- Images need explicit `width`, `border:0`, and `display` set

## Component map

| File | Role |
| --- | --- |
| [App.tsx](src/App.tsx) | Mounts the two providers and the shell. Nothing else |
| [state/DesignerContext.tsx](src/state/DesignerContext.tsx) | All state + every mutation handler + UI state |
| [state/useTemplateHistory.ts](src/state/useTemplateHistory.ts) | Undo/redo snapshot stack and the keyboard shortcuts |
| [state/EditingSession.tsx](src/state/EditingSession.tsx) | The open inline-edit: node, mode, selection, commands |
| [shell/AppShell.tsx](src/components/shell/AppShell.tsx) | The v2 layout frame |
| [shell/TopBar.tsx](src/components/shell/TopBar.tsx) | Brand, rename, save status, Import / Save / Export |
| [shell/IconRail.tsx](src/components/shell/IconRail.tsx) | Blocks · Sections · Theme · Add-ons |
| [shell/LeftPanel.tsx](src/components/shell/LeftPanel.tsx) | Routes the one panel slot: rail panel, or block inspector |
| [shell/CanvasToolbar.tsx](src/components/shell/CanvasToolbar.tsx) | Device switch / undo / redo / Preview — swaps to `TextToolbar` while editing |
| [canvas/Canvas.tsx](src/components/canvas/Canvas.tsx) | The tree, drag and drop, hover, selection |
| [canvas/BlockFrame.tsx](src/components/canvas/BlockFrame.tsx) | Outline, name tab, action rail |
| [canvas/BlockBody.tsx](src/components/canvas/BlockBody.tsx) | Generated HTML + inline editing |
| [canvas/TextToolbar.tsx](src/components/canvas/TextToolbar.tsx) | The docked formatting bar |
| [panels/BlocksPanel.tsx](src/components/panels/BlocksPanel.tsx) | The palette, and Paste HTML |
| [panels/SectionsPanel.tsx](src/components/panels/SectionsPanel.tsx) | The structure tree: select, rename, reorder, add, at any depth |
| [panels/blockIcons.ts](src/components/panels/blockIcons.ts) | One icon per block type, shared by the palette and the outline |
| [panels/ThemePanel.tsx](src/components/panels/ThemePanel.tsx) | Global `EmailSettings`, presets, New |
| [panels/AddonsPanel.tsx](src/components/panels/AddonsPanel.tsx) | Stub — add-ons and integrations, not built |
| [panels/inspector/](src/components/panels/inspector/) | `BlockInspector` + Content / Styles / Visibility / Code |
| [controls/](src/components/controls/) | The field vocabulary every panel is built from |
| [RichTextField.tsx](src/components/RichTextField.tsx) | The Inspector's Lexical editor |
| [PreviewOverlay.tsx](src/components/PreviewOverlay.tsx) | Full-bleed preview in a sandboxed iframe |
| [ExportModal.tsx](src/components/ExportModal.tsx) | The whole email: copy / download / open, in either export build |
| [ImportHtmlModal.tsx](src/components/ImportHtmlModal.tsx) | Paste raw HTML → a `custom-html` block |

Build new panel fields out of [controls/](src/components/controls/) rather than
hand-rolling markup, or the panels drift and the app stops looking like one app.

[src/utils/defaultTemplate.ts](src/utils/defaultTemplate.ts) holds `BLANK_CANVAS_TEMPLATE`
and `PRESET_TEMPLATES` (Blank Canvas and General Announcement), offered in the Theme panel.

## Verifying a change to the generator

Export is the product. Any change to `htmlGenerator.ts` should be checked with a diff, not
by eye:

1. Build a fixture template as JSON covering the block types you touched.
2. Render it through `generateEmailHtml` before and after your change.
3. Diff. For anything that isn't *meant* to change the output — a migration, a refactor,
   a new optional field nobody has set — the diff must be empty.

`git archive <ref> src | tar -x -C <tmp>` gives you the "before" tree to render against;
esbuild (a Vite dependency) will bundle either copy of `htmlGenerator.ts` for Node. Note
it isn't on `node_modules/.bin` under pnpm — it's at
`node_modules/.pnpm/node_modules/.bin/esbuild`. When `HEAD` isn't the baseline you want
(the working tree has other uncommitted work), copy `src` twice and strip just your change
from one copy; that still gives a real diff.

## Project history

This repo was exported from Google AI Studio and has been de-Googled: `@google/genai`,
the Gemini server proxy scaffold (`express`, `dotenv`, `server.js`), the
`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` flag, and the AI Studio README/HMR wiring were
all removed. **Do not reintroduce them.** The app has no AI features and should stay
offline. `metadata.json` and `assets/.aistudio/` are inert leftovers.

The `/degoogle-ai-studio` skill (user-level) performs this conversion on other AI Studio exports.

## Planned next

Multi-column rows are done — `row` and `column` joined `ContainerElement`, and the
traversals in `DesignerContext`, `migrateToSections` and the visibility walk all kept
working unchanged. What the addition *did* need was the placement rule split out of
"is it a container" into `canNest`, and the palette's payload widened from `ElementType`
to `BlockRecipe`. Both are the seams to reuse for the next structural type.
