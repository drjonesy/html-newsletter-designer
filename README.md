# HTML Newsletter Designer

An offline email newsletter designer. Visually add, edit, and export responsive email HTML blocks — no backend, no API keys, nothing leaves the browser.

## Requirements

- Node.js >= 20
- pnpm >= 10 (`corepack enable pnpm`)

This project is pnpm-only; `npm install` and `yarn install` are blocked by a `preinstall` guard.

## Run locally

```bash
pnpm install
pnpm dev
```

The dev server runs at http://localhost:3000.

## Scripts

| Command        | Description                    |
| -------------- | ------------------------------ |
| `pnpm dev`     | Start the Vite dev server      |
| `pnpm build`   | Production build to `dist/`    |
| `pnpm preview` | Serve the production build     |
| `pnpm lint`    | Type-check with `tsc --noEmit` |
| `pnpm clean`   | Remove `dist/`                 |

## Stack

React 19 · Vite 6 · Tailwind CSS 4 · TypeScript · lucide-react
