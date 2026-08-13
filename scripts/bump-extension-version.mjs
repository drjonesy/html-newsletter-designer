/**
 * Bumps `version` in `extension/manifest.json`.
 *
 *   pnpm ext:version          asks which bump, showing the number each produces
 *   pnpm ext:version patch    0.1.0 → 0.1.1
 *   pnpm ext:version minor    0.1.0 → 0.2.0
 *   pnpm ext:version major    0.1.0 → 1.0.0
 *   pnpm ext:version 2.0.0    an exact version, validated the same way
 *
 * Deliberately separate from `ext:package` rather than folded into it.
 * Packaging is run repeatedly while testing a build, and a version that climbed
 * on every run would burn numbers the store can never reuse — the Web Store
 * refuses a version it has already seen, so they are one-way.
 *
 * That one-way-ness is also why the prompt names the resulting number next to
 * every choice, and why it needs an explicit answer: there is no default, and
 * an empty line cancels rather than picking the smallest bump. With no TTY —
 * CI, a hook, a piped shell — there is nobody to ask, so a missing argument is
 * still the usage error it always was rather than a wait forever.
 *
 * It doesn't commit or tag, because the manifest version is one of several
 * things a release touches here and the repo has no release process to hook.
 */
import { relative } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import {
  MANIFEST_PATH,
  nextVersion,
  readManifest,
  ROOT,
  VERSION_RULE,
  versionProblem,
  writeVersion,
} from './manifest-version.mjs';

const RELEASES = ['major', 'minor', 'patch'];
/** The menu, commonest bump first — the argument accepts any of them anyway. */
const MENU = ['patch', 'minor', 'major'];
const USAGE =
  'Usage: pnpm ext:version <major|minor|patch|exact version>\n' +
  'Bumps "version" in extension/manifest.json. Run it with no argument in a ' +
  'terminal to be asked which. No argument is never taken as a patch bump — ' +
  'the number can never be reused, so it is not something to do by accident.';

const argument = process.argv[2];

if (argument === '--help' || argument === '-h') {
  console.log(USAGE);
  process.exit(0);
}

if (!argument && !stdin.isTTY) {
  console.error(USAGE);
  process.exit(1);
}

const { text, version: current } = readManifest();

const currentProblem = versionProblem(current);
if (currentProblem) {
  console.error(
    `extension/manifest.json already has an invalid "version": ${currentProblem}.\n` +
      `${VERSION_RULE}\nFix it by hand, or set an exact version to overwrite it.\n`
  );
}

// Warned above before the menu is drawn, but fatal only here: an exact version
// is the way out of a broken manifest, and there is nothing to bump *from*.
const choice = argument ?? (await promptForChoice());
if (currentProblem && RELEASES.includes(choice)) {
  console.error(`There is no valid version to ${choice}-bump from — set an exact one.`);
  process.exit(1);
}

let updated;
if (RELEASES.includes(choice)) {
  try {
    updated = nextVersion(current, choice);
  } catch (error) {
    console.error(String(error.message));
    process.exit(1);
  }
} else {
  const problem = versionProblem(choice);
  if (problem) {
    console.error(`"${choice}" is not a valid version: ${problem}.\n${VERSION_RULE}`);
    process.exit(1);
  }
  updated = choice;
}

if (updated === current) {
  console.error(`extension/manifest.json is already at ${current} — nothing to do.`);
  process.exit(1);
}

try {
  writeVersion(text, updated);
} catch (error) {
  console.error(String(error.message));
  process.exit(1);
}

console.log(
  `${relative(ROOT, MANIFEST_PATH)}: ${current} → ${updated}\n` +
    'Run `pnpm ext:package` to build the upload.'
);

/**
 * Asks which bump to make, and returns a release name or an exact version —
 * the same two things the argument can be, so the caller validates one path.
 *
 * A release whose preview can't be computed (the part is at Chrome's maximum,
 * or the current version is unreadable) is still offered, annotated with why:
 * hiding it would leave someone staring at a menu missing the entry they came
 * for. The argument path reports the same failure, so it's one message.
 */
async function promptForChoice() {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    console.log(`extension/manifest.json is at ${current}\n`);
    for (const [index, release] of MENU.entries()) {
      console.log(`  ${index + 1}) ${release.padEnd(5)}  ${preview(release)}`);
    }
    const exactChoice = String(MENU.length + 1);
    console.log(`  ${exactChoice}) exact  type the version yourself\n`);

    while (true) {
      const answer = (
        await ask(rl, `Which bump? [1-${exactChoice}, or q to cancel] `)
      ).toLowerCase();

      if (answer === '' || answer === 'q' || answer === 'quit') cancel();

      const chosen = MENU[Number(answer) - 1] ?? MENU.find((release) => release === answer);
      if (chosen) return chosen;

      if (answer === exactChoice || answer === 'exact' || answer === 'e') {
        const exact = await ask(rl, 'Version: ');
        if (exact === '') cancel();
        return exact;
      }

      console.log(`"${answer}" isn't one of the choices.`);
    }
  } finally {
    rl.close();
  }
}

/**
 * One question, trimmed. Ctrl+D is a cancel like any other: readline rejects
 * with an `AbortError` there, which unhandled would end a "which bump?" prompt
 * in a Node stack trace.
 */
async function ask(rl, question) {
  try {
    return (await rl.question(question)).trim();
  } catch (error) {
    if (error?.code === 'ABORT_ERR') {
      console.log('');
      cancel();
    }
    throw error;
  }
}

/** `0.1.1 → 0.1.2` for the menu, or why that can't be worked out. */
function preview(release) {
  if (currentProblem) return `${current} is invalid — use "exact"`;
  try {
    return `${current} → ${nextVersion(current, release)}`;
  } catch (error) {
    return String(error.message);
  }
}

/**
 * Cancelling exits non-zero. It isn't a failure, but `pnpm ext:version &&
 * something` should not go on to the something.
 */
function cancel() {
  console.error('Cancelled — extension/manifest.json is unchanged.');
  process.exit(1);
}
