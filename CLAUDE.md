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

### Elements are a discriminated union

[src/types.ts](src/types.ts) defines `EmailElement` as a union discriminated on `type`
(`'heading' | 'paragraph' | 'button' | 'accent-section' | ...`). **Adding a new element
type requires touching four places:**

1. `src/types.ts` — add the `ElementType` literal, the interface, and the union member
2. [src/utils/elementHelpers.ts](src/utils/elementHelpers.ts) — a `createNewElement` case supplying defaults
3. [src/utils/htmlGenerator.ts](src/utils/htmlGenerator.ts) — a `renderElementToHtml` case emitting the email HTML
4. [src/components/InspectorPanel.tsx](src/components/InspectorPanel.tsx) — the editing controls for its fields

Miss one and `pnpm lint` will usually catch it, because the switches are exhaustive over
the union.

### Nesting

`accent-section` is the only container type — it holds `childElements: EmailElement[]`,
one level deep. Anything that walks the tree must recurse into it. `App.tsx` already has
recursive helpers (`findElementById`, and the local `updateList` / `deleteFromList` /
`moveInList` closures inside each handler); follow that pattern rather than assuming a
flat array.

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
| [Navbar.tsx](src/components/Navbar.tsx) | Preset picker, view mode (desktop/mobile/code), export/import/reset actions |
| [SidebarElements.tsx](src/components/SidebarElements.tsx) | Element list, reorder, select, delete, duplicate |
| [VisualCanvas.tsx](src/components/VisualCanvas.tsx) | Live preview; renders generated HTML per block, handles selection |
| [InspectorPanel.tsx](src/components/InspectorPanel.tsx) | Per-element property editors + global `EmailSettings` |
| [CodeEditor.tsx](src/components/CodeEditor.tsx) | Read-only generated-HTML view |
| [AddElementModal.tsx](src/components/AddElementModal.tsx) | Element type picker |
| [ImportHtmlModal.tsx](src/components/ImportHtmlModal.tsx) | Paste raw HTML → wraps it as a `custom-html` element |
| [ExportModal.tsx](src/components/ExportModal.tsx) | Copy / download / open-in-new-tab |

[src/utils/defaultTemplate.ts](src/utils/defaultTemplate.ts) holds `WEDNESDAY_STUDY_TEMPLATE`
(the seed template loaded on first run) and `PRESET_TEMPLATES`. It contains real
church-newsletter copy — treat it as sample content, and don't "clean up" the wording.

## Project history

This repo was exported from Google AI Studio and has been de-Googled: `@google/genai`,
the Gemini server proxy scaffold (`express`, `dotenv`, `server.js`), the
`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` flag, and the AI Studio README/HMR wiring were
all removed. **Do not reintroduce them.** The app has no AI features and should stay
offline. `metadata.json` and `assets/.aistudio/` are inert leftovers.

The `/degoogle-ai-studio` skill (user-level) performs this conversion on other AI Studio exports.
