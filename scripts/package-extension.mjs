/**
 * Zips `extension/` into `dist/` for a Chrome Web Store upload.
 *
 * Reached through `pnpm ext:package`, which runs `ext:build` first
 * — this script only wraps what is already on disk, so it fails loudly rather
 * than silently shipping a stale or missing app bundle.
 *
 * Three things it does that a bare `zip -r` doesn't:
 *
 * - names the archive for the manifest's `version`, so successive uploads are
 *   told apart in the dashboard instead of overwriting one `…-extension.zip`
 * - leaves out `extension/README.md`, which is the developer's load-unpacked
 *   notes, not something users should receive
 * - deletes an existing archive first. `zip` *adds to* an archive that already
 *   exists, so a file dropped from the build would otherwise live on forever in
 *   every later upload.
 *
 * It also validates the manifest's `version`, so a malformed one fails here
 * rather than after a zip has been uploaded to the store.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { ROOT, VERSION_RULE, versionProblem } from './manifest-version.mjs';

const root = ROOT;
const extensionDir = resolve(root, 'extension');
const distDir = resolve(root, 'dist');

if (!existsSync(resolve(extensionDir, 'app', 'index.html'))) {
  console.error(
    'extension/app is missing or empty — run `pnpm ext:build` first.'
  );
  process.exit(1);
}

const manifest = JSON.parse(
  readFileSync(resolve(extensionDir, 'manifest.json'), 'utf8')
);
const problem = versionProblem(manifest.version);
if (problem) {
  console.error(
    `extension/manifest.json has an invalid "version": ${problem}.\n` +
      `${VERSION_RULE}\nSet one with \`pnpm ext:version <version>\`.`
  );
  process.exit(1);
}

const archive = resolve(
  distDir,
  `newsletter-designer-extension-${manifest.version}.zip`
);

mkdirSync(distDir, { recursive: true });
rmSync(archive, { force: true });

// Run from inside `extension/` so `manifest.json` sits at the root of the
// archive — the store rejects an upload that nests it one folder down.
execFileSync(
  'zip',
  ['-qr', archive, '.', '-x', 'README.md', '.DS_Store', '**/.DS_Store'],
  { cwd: extensionDir, stdio: 'inherit' }
);

console.log(
  `${manifest.name} ${manifest.version} → ${relative(root, archive)}`
);
