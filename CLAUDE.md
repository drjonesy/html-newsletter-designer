# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

A fully client-side visual designer for responsive **email** HTML. The user composes a
newsletter from typed blocks, previews it, and exports table-based HTML that survives
Gmail/Outlook. There is no backend, no API, and no network calls — everything runs in the
browser and persists to `localStorage`.

## Commands

This project is **pnpm-only**. A `preinstall` guard (`npx only-allow pnpm`) blocks npm and yarn.

```bash
pnpm install    # install deps
pnpm dev        # Vite dev server on :3000
pnpm build      # production build to dist/
pnpm preview    # serve the production build
pnpm lint       # tsc --noEmit (this is the only check — there is no test suite or ESLint)
pnpm clean      # rm -rf dist
```

Run `pnpm lint` after any change to `src/types.ts` — the discriminated union there is
load-bearing and type errors surface nowhere else.

`pnpm-workspace.yaml` exists only to allow `esbuild`'s postinstall script (`allowBuilds`).
Without it `pnpm build` fails on a missing platform binary. Do not delete it.

## Stack

React 19 · Vite 6 · Tailwind CSS 4 (via `@tailwindcss/vite`, no config file) · TypeScript
(`noEmit`) · lucide-react for icons. `motion` is installed but not currently imported.

## Architecture

### State lives in one place

[src/App.tsx](src/App.tsx) holds the entire application state — there is no store, no
context, no reducer. A single `NewsletterTemplate` object is the source of truth:

```
NewsletterTemplate { id, name, settings: EmailSettings, elements: EmailElement[] }
```

All mutations go through handlers in `App.tsx` (`handleAddElement`, `handleUpdateElement`,
`handleDeleteElement`, `handleDuplicateElement`, `handleMoveUp`/`Down`,
`handleUpdateSettings`) which are passed down as props. Child components never mutate
state directly.

Auto-save: a `useEffect` writes `template` to `localStorage` under
`gmail_newsletter_designer_template_v1` on every change. Changing the shape of
`EmailElement` will break saved templates for existing users — either migrate on read or
bump that key.

### Project files

[src/utils/templateFile.ts](src/utils/templateFile.ts) defines the save/open format:
`.newsletter.json`, a versioned envelope (`format`, `version`, `savedAt`) wrapping the
whole `NewsletterTemplate`. This is the *editable source*; exported HTML is the output.
Uploaded images are already data URIs, so a project file is self-contained.

`parseTemplateFile` treats file contents as untrusted — it returns a
`{ status: 'error', error }` message for the user rather than throwing, and rebuilds each
block as `{ ...createNewElement(type), ...fileData }` so a file missing fields (older
build, hand-edited) still loads. Unknown block types are dropped with a warning instead of
failing the whole load. Keep that shape: never `setTemplate` straight from parsed JSON.

If you change `EmailElement` in a way older builds can't read, bump `TEMPLATE_FILE_VERSION`
and migrate on read. Additive optional fields don't need a bump.

Note the discriminant is the string `status`, not a boolean `ok` — `tsconfig.json` has no
`strict`, and boolean-literal discriminants don't narrow reliably without `strictNullChecks`.

### Elements are a discriminated union

[src/types.ts](src/types.ts) defines `EmailElement` as a union discriminated on `type`
(`'heading' | 'paragraph' | 'button' | 'section' | ...`). **Adding a new element
type requires touching four places:**

1. `src/types.ts` — add the `ElementType` literal, the interface, and the union member
2. [src/utils/elementHelpers.ts](src/utils/elementHelpers.ts) — a `createNewElement` case supplying defaults
3. [src/utils/htmlGenerator.ts](src/utils/htmlGenerator.ts) — a `renderElementToHtml` case emitting the email HTML
4. [src/components/InspectorPanel.tsx](src/components/InspectorPanel.tsx) — the editing controls for its fields

Miss one and `pnpm lint` will usually catch it, because the switches are exhaustive over
the union.

If the new type has text the user should be able to type over on the canvas, wrap that
text in `editableField(value, 'fieldName', opts)` in its generator case and add the type to
`INLINE_EDITABLE_TYPES` in `VisualCanvas.tsx` — see *Inline editing* below.

### Nesting

One block type holds `childElements: EmailElement[]`: `section`, the general-purpose box
with per-side borders and padding. Sections nest arbitrarily deep — a section can contain a
section. (`ContainerElement` is still a union of one, so a second container type stays cheap
to add.)

Never test `el.type === 'section'` to decide whether to recurse. Use
`isContainerElement(el)` from [src/utils/elementHelpers.ts](src/utils/elementHelpers.ts),
which narrows to `ContainerElement` — that way another container type only has to be added
to the `ContainerElement` union in [src/types.ts](src/types.ts), not chased through every
traversal. `App.tsx` already has recursive helpers built on it (`findElementById`,
`findContainerFor`, and the local `updateList` / `deleteFromList` / `moveInList` closures
inside each handler); follow that pattern rather than assuming a flat array.

Two consequences worth remembering when writing traversals:

- Anything that copies a subtree must re-id every descendant, not just the root —
  `handleDuplicateElement`'s `reidDeep` does this. Duplicate ids in the tree make
  selection and updates hit both copies.
- The canvas is the only place a container's own frame is drawn in React rather than by
  the generator (its children have to stay individually clickable). `containerPreviewStyle`
  in `VisualCanvas.tsx` mirrors what `renderElementToHtml` emits for the frame — change one
  and change the other.

### Rendering: one generator, two consumers

[src/utils/htmlGenerator.ts](src/utils/htmlGenerator.ts) is the single source of email markup.

- `renderElementToHtml(element, fontFamily)` — one block's HTML. [VisualCanvas](src/components/VisualCanvas.tsx)
  injects this per element via `dangerouslySetInnerHTML` so blocks stay individually
  clickable/selectable on the canvas.
- `generateEmailHtml(template)` — the full document (doctype, `<head>` styles, container
  table) used for the code view, copy, download, and open-in-new-tab.

Because the canvas renders the *real* generated HTML rather than a React lookalike, the
preview and the export can't drift. Keep it that way: never add a parallel
React-based renderer for a block.

### Inline editing (WYSIWYG)

`renderElementToHtml` takes an optional third argument, `{ editable: true }`, passed only
by `VisualCanvas`. It wraps each user-typeable field in
`<span data-edit-field="<propName>">` (plus `data-edit-rich="1"` where the field holds
HTML, and `data-edit-empty="1"` on a blank field so there's something to click). Export
paths never pass it, so the emitted email HTML is unchanged — keep it that way, and never
add editor chrome to the default (export) branch.

`BlockBody` in `VisualCanvas.tsx` drives the editing:

- The **first** click selects the block; a **second** click on a marked field starts
  editing it. Editing can't start on the selecting click, because opening the Inspector
  resizes the canvas and the cursor would end up over different content.
- The `data-edit-field` value must be the element's property name — the committed text is
  written straight back to `element[field]`.
- Edits commit **on blur**, not per keystroke: committing regenerates the block's HTML and
  replaces these DOM nodes, which would drop the caret. Enter saves (or inserts `<br>` in a
  rich field); Escape abandons.
- Read plain fields with `textContent`, never `innerText` — `innerText` returns the
  *rendered* text, so a heading with `text-transform:uppercase` would save back SHOUTING.

### Selecting a container that's full

A section is mostly covered by its children, and every block stops its click bubbling, so
clicking "the section" only works on whatever sliver of its own padding is exposed. Two
affordances stand in for that, both in `VisualCanvas`:

- Every block's hover badge carries a **step-out button** (`CornerLeftUp`) when it has a
  parent, which selects the section it lives in. Nested sections get it too — it comes from
  the shared `renderBadgeActions(el, parentId)`, which is why
  `renderSingleInteractiveElement` takes the parent's id rather than the old
  `insideContainer` boolean (`insideContainer` is now derived from it).
- A container whose subtree holds the hovered or selected block (`holdsActive`) keeps a
  faint ring and shows a **compact badge with its name** at its top-*right*, which selects
  it. Right, because the full badge and every child's badge sit at the top-left.

Hover is tracked with a bubbling `onMouseOver` on each block wrapper (innermost stops
propagation), plus one `onMouseLeave` on the canvas root. It was per-block
enter/leave, but leaving a child cleared the hover outright and tore down the section badge
the cursor was travelling towards. Hover must only ever move from one block to another.
For the same reason the compact badge swallows `mouseover` instead of forwarding it:
letting hover reach the section would satisfy `isHovered`, unmount the badge, and leave the
click with nothing under it.

### Drag to reorder

Blocks reorder by dragging the grip on the hover badge. The wrapper is only
`draggable` while that grip is held (`armedId` in `VisualCanvas`) — a permanently
draggable wrapper would block text selection during inline editing, and a stray `<img>`
drag inside the generated HTML would start a phantom reorder.

Drops resolve through `handleReorderElement` in `App.tsx`, which removes the block from
wherever it lives and re-inserts it `'before'` / `'after'` the target, or — for a container
target — `'inside'` it as the last child. Source and target can be in different lists, so
this also moves blocks into and out of sections; the one guard is that a container can't be
dropped into its own subtree.

`VisualCanvas` picks the position in `dragProps`'s `onDragOver`: plain blocks split
top-half/bottom-half, containers reserve a ~14px strip at each edge for before/after and
treat the rest as `'inside'`. Children stop `dragover` bubbling, so a container only sees
events over its own padding. An empty container renders a dashed placeholder — without it
there'd be nothing to aim at.

### Sections are the only home for blocks

`canSitAtTopLevel(type)` in [src/utils/elementHelpers.ts](src/utils/elementHelpers.ts) is
the rule: **only containers may sit at the top level of the email.** Everything else has to
live inside one. Both placement paths enforce it:

- **Adding.** `handleAddElement` routes a click into `addTarget` — the selected section, or
  the section holding the selected block. With no section selected, a non-container click
  is refused with a notice rather than dropped loose at the end.
- **Dragging.** `dragProps` in `VisualCanvas` computes it per target from `insideContainer`
  (does *this* block live in a section?) — landing beside a block means landing where that
  block lives, so a paragraph may go next to a paragraph inside a section but not next to a
  top-level one. When only one outcome is legal the whole box takes it, so there's no dead
  edge strip to fall into. `handleReorderElement` re-checks the rule as a backstop.

Nothing in the editor has to cope with a loose top-level block, because templates predating
the rule are migrated on load — see below. Both entries in `PRESET_TEMPLATES` (including
`BLANK_CANVAS_TEMPLATE`) already wrap their content in sections.

### Migrating pre-section templates

`migrateToSections(elements)` wraps each *run* of consecutive loose top-level blocks in one
`createBareSection` — a section with no borders, padding, margins or fill. Consecutive
blocks share a wrapper so the author's grouping survives instead of exploding into a section
per paragraph; existing containers stay exactly where they are. It's idempotent, so it's
safe to run on every load.

Both load paths call it, and each reports the count so the user is told their work was
restructured:

- `loadInitialTemplate()` in `App.tsx` — the auto-saved `localStorage` template
- `parseTemplateFile` — project files, via `wrappedInSections` on the `ok` result (kept
  separate from `warnings`: nothing failed to read)

**The wrap is byte-neutral in the export, and must stay that way.** A section with no
border, padding, margin or fill emits *only its children* — `renderElementToHtml` returns
early before building the wrapper table, joining them with `\n\n` to match how
`generateEmailHtml` joins top-level blocks. That early return is what lets migration
restructure someone's saved newsletter without changing a byte of the email they send. It
also keeps genuinely empty wrapper tables out of the output, which matters because Gmail
clips messages at ~102KB. If you change the `section` generator, keep the early return and
re-check that migrating a legacy template is a no-op on `generateEmailHtml`.

Raw-HTML import (`handleImportRawHtml`) produces a `custom-html` block, which isn't a
container — it goes into the selected section, or into a bare section of its own.

### Removed and renamed block types load as their replacement

Two types have been retired so far, and both are converted on load rather than dropped:

- `accent-section` → `section` (`convertLegacyAccentSection`)
- `header-image` → `image` (`convertLegacyHeaderImage`) — the "Header Logo / Banner" was
  never actually restricted to the top of the email, so it was renamed to the generic
  **Image**. Only `type` changes; every field carries over, and the old default label
  `'Header Banner / Logo'` is replaced with `'Image'` so nothing still names a dead type.
  This is what `TEMPLATE_FILE_VERSION` 2 marks.

`accent-section` — the "Red Accent Block", a container with a fixed left rule — was removed
once `section` could draw a single-sided border. Templates saved while it existed are still
in users' `localStorage` and in `.newsletter.json` files on disk, so it is *converted*, not
dropped: `convertLegacyAccentSection` in `elementHelpers.ts` maps its `borderWidth` /
`borderColor` / `paddingLeft` / `marginBottom` onto a `section` with only a left border. The
conversion is silent — the block keeps looking the way its author left it.

Both load paths have to do this, and they hook it at different points, because a project
file is validated against `ELEMENT_TYPES` *before* `migrateToSections` runs:

- `parseTemplateFile` converts in `normalizeElement`, ahead of the type check — otherwise
  the block would be dropped as unknown with a warning
- `migrateToSections` converts the whole tree first (`convertLegacyBlocks`), which covers
  the `localStorage` path

Follow that shape if another type is ever retired: convert at both points, keep it
idempotent, and don't leave the dead type in `ElementType`. A *rename* is the same job —
old files carry the old string, so it needs the same two hooks.

### Palette drag-and-drop

Palette items in `SidebarElements` are drag sources; `VisualCanvas` resolves the drop.
`paletteDragType` lives in `App.tsx` because `dataTransfer` can't be read during `dragover`
— the canvas has to know what's coming to decide whether a block is a legal target, so the
type is passed through React state instead.

Two consequences:

- `VisualCanvas` unifies the two drag kinds into `activeDragType` (`paletteDragType` for a
  new block, `draggingType` for a reorder). Placement rules are written against the type,
  so they apply identically to both.
- A palette drag starts on a sidebar button, so no canvas block ever sees its `dragend`. A
  `useEffect` on `paletteDragType` clears `dropTarget`; without it an abandoned drag leaves
  a block stuck showing a drop highlight.

Don't put "add block" buttons in `InspectorPanel` — a grid of them used to live there and
gave sections two competing ways to be filled. The palette is the one way in.

### The Inspector's HTML tab

`InspectorPanel` has Design and HTML tabs; `App.tsx` owns which is active so the `</>`
button on a canvas block can jump straight to HTML. Saving hand-edited markup on a typed
block **converts it to a `custom-html` element**, stashing the original on
`convertedFrom` so the Revert button can restore it. Arbitrary HTML can't be parsed back
into typed fields like `fontSize`, so don't try to make the code view round-trip.

## Email HTML constraints

The output targets Gmail, Outlook, and Apple Mail. When editing `htmlGenerator.ts`:

- Layout with **nested `<table>` elements**, not flexbox or grid
- **Inline every style** on the element. `<head>` CSS is for media queries only —
  Gmail strips most of it
- Use **system/email-safe font stacks** (`"Helvetica Neue", Helvetica, Arial, sans-serif`).
  Webfont `@import`s largely don't work in email clients
- Container width is `settings.width` (default 600px), with `max-width` for mobile
- Images need explicit `width`, `border:0`, and `display` set

## Component map

| File | Role |
| --- | --- |
| [App.tsx](src/App.tsx) | All state + every mutation handler |
| [Navbar.tsx](src/components/Navbar.tsx) | Right-aligned new/save/open project file + export/import actions. Nothing else — the brand is the only thing on the left |
| [ViewModeToggle.tsx](src/components/ViewModeToggle.tsx) | Desktop/mobile/code switch + open-in-new-tab, in the strip above the preview |
| [SidebarElements.tsx](src/components/SidebarElements.tsx) | Preset picker above the tabs; element palette; "Canvas Style" tab holds the newsletter name + global `EmailSettings` |
| [VisualCanvas.tsx](src/components/VisualCanvas.tsx) | Live preview; renders generated HTML per block, handles selection |
| [InspectorPanel.tsx](src/components/InspectorPanel.tsx) | Per-element property editors + global `EmailSettings` |
| [CodeEditor.tsx](src/components/CodeEditor.tsx) | Read-only generated-HTML view |
| [ImportHtmlModal.tsx](src/components/ImportHtmlModal.tsx) | Paste raw HTML → wraps it as a `custom-html` element |
| [ExportModal.tsx](src/components/ExportModal.tsx) | Copy / download / open-in-new-tab |

[src/utils/defaultTemplate.ts](src/utils/defaultTemplate.ts) holds `BLANK_CANVAS_TEMPLATE`
(the seed template loaded on first run and the target of Reset) and `PRESET_TEMPLATES`
(currently Blank Canvas and General Announcement).

The preset `<select>` at the top of
[SidebarElements.tsx](src/components/SidebarElements.tsx) hardcodes its `<option>` list
rather than mapping `PRESET_TEMPLATES`; adding or reordering a preset means editing both.
It lives in the sidebar, which `App.tsx` hides in code view — so the picker is only
reachable from Desktop/Mobile.

## Project history

This repo was exported from Google AI Studio and has been de-Googled: `@google/genai`,
the Gemini server proxy scaffold (`express`, `dotenv`, `server.js`), the
`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` flag, and the AI Studio README/HMR wiring were
all removed. **Do not reintroduce them.** The app has no AI features and should stay
offline. `metadata.json` and `assets/.aistudio/` are inert leftovers.

The `/degoogle-ai-studio` skill (user-level) performs this conversion on other AI Studio exports.
