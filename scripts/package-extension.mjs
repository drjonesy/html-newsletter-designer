/**
 * Zips `extension/` into `dist/` for a Chrome Web Store upload.
 *
 * Reached through `pnpm package:extension`, which runs `build:extension` first
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
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const extensionDir = resolve(root, 'extension');
const distDir = resolve(root, 'dist');

/**
 * Chrome's version format, which is *not* semver: one to four dot-separated
 * integers, each 0–65535, no leading zero on a non-zero part, and no
 * pre-release suffix — `1.0.0-rc1` is rejected outright. A human-facing label
 * belongs in the manifest's separate `version_name` field instead.
 *
 * Returns an explanation, or `null` if the version is fine.
 */
function versionProblem(version) {
  if (typeof version !== 'string' || version === '') {
    return 'it is missing';
  }
  // Called out on its own: reaching for semver is the likely mistake here, and
  // "0-rc1 is not a plain integer" describes the symptom rather than the cause.
  if (/[-+]/.test(version)) {
    return 'a pre-release or build suffix like "-rc1" is not allowed — put a ' +
      'label in the manifest\'s "version_name" instead';
  }
  const parts = version.split('.');
  if (parts.length > 4) {
    return `it has ${parts.length} parts — at most four are allowed`;
  }
  for (const part of parts) {
    if (!/^(0|[1-9][0-9]*)$/.test(part)) {
      return `"${part}" is not a plain integer without a leading zero`;
    }
    if (Number(part) > 65535) {
      return `"${part}" is above the maximum of 65535`;
    }
  }
  return null;
}

if (!existsSync(resolve(extensionDir, 'app', 'index.html'))) {
  console.error(
    'extension/app is missing or empty — run `pnpm build:extension` first.'
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
      'Chrome wants one to four dot-separated integers, each 0–65535 ' +
      '(e.g. 1, 1.0, 0.1.0, 3.1.2.4567).'
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
