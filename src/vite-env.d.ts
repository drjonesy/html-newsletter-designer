/// <reference types="vite/client" />

/*
  Types for `import.meta.env`, which `tsconfig.json` doesn't otherwise see —
  `vite/client` isn't an `@types` package, so nothing picks it up implicitly.
  Read by TopBar for `BASE_URL`, which is how a file in `public/` is addressed
  from JS in both the hosted build (`/`) and the extension build (`./`).
*/
