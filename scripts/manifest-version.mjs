/**
 * The extension manifest's `version`, shared by the two scripts that care:
 * `package-extension.mjs` validates it before naming an archive after it, and
 * `bump-extension-version.mjs` writes the next one.
 *
 * Chrome's format is *not* semver, which is the whole reason this lives in one
 * place — the rules are easy to half-remember and the store only enforces them
 * at the end of an upload.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const MANIFEST_PATH = resolve(ROOT, 'extension', 'manifest.json');

/** The rule, in one sentence, for error messages. */
export const VERSION_RULE =
  'Chrome wants one to four dot-separated integers, each 0–65535 ' +
  '(e.g. 1, 1.0, 0.1.0, 3.1.2.4567).';

const MAX_PART = 65535;

/**
 * One to four dot-separated integers, each 0–65535, no leading zero on a
 * non-zero part, and no pre-release suffix — `1.0.0-rc1` is rejected outright.
 * A human-facing label belongs in the manifest's separate `version_name` field.
 *
 * Returns an explanation, or `null` if the version is fine.
 */
export function versionProblem(version) {
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
    if (Number(part) > MAX_PART) {
      return `"${part}" is above the maximum of ${MAX_PART}`;
    }
  }
  return null;
}

/**
 * The next version after `current` for a `major` / `minor` / `patch` release.
 *
 * A version shorter than three parts is padded first, so `1` bumps to `1.0.1`
 * rather than to something that depends on how it was written. Everything below
 * the bumped part resets to zero, including a fourth part if the author keeps
 * one — Chrome's optional build number is meaningless once the release above it
 * has moved.
 *
 * Throws if the result would exceed Chrome's per-part maximum.
 */
export function nextVersion(current, release) {
  const index = { major: 0, minor: 1, patch: 2 }[release];
  if (index === undefined) {
    throw new Error(`unknown release type "${release}"`);
  }

  const parts = current.split('.').map(Number);
  while (parts.length < 3) parts.push(0);

  parts[index] += 1;
  for (let i = index + 1; i < parts.length; i += 1) parts[i] = 0;

  if (parts[index] > MAX_PART) {
    throw new Error(
      `bumping the ${release} part of ${current} would exceed ${MAX_PART}`
    );
  }
  return parts.join('.');
}

/** The manifest's text and its parsed `version`. */
export function readManifest() {
  const text = readFileSync(MANIFEST_PATH, 'utf8');
  return { text, version: JSON.parse(text).version };
}

/**
 * Writes `version` back by rewriting just that one line.
 *
 * Not `JSON.stringify` of the parsed object: that reformats the whole file —
 * expanding the inline `permissions` and `matches` arrays — and turns a
 * one-word change into a diff nobody can read. The pattern can't collide with
 * `manifest_version`, which has no quote before `version` and holds a number
 * rather than a string, but the match count is checked anyway.
 */
export function writeVersion(text, version) {
  const pattern = /"version"\s*:\s*"[^"]*"/g;
  const matches = text.match(pattern) ?? [];
  if (matches.length !== 1) {
    throw new Error(
      `expected exactly one "version" field in the manifest, found ${matches.length}`
    );
  }
  writeFileSync(MANIFEST_PATH, text.replace(pattern, `"version": "${version}"`));
}
