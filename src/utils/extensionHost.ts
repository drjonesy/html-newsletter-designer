/**
 * The app running as a page inside the Chrome extension, rather than as an
 * ordinary web page.
 *
 * The extension bundles this same build and opens it in a tab from a button in
 * Gmail's compose window. When it's running there — and *only* there — the app
 * offers one extra action: put the finished email into the draft that opened it.
 *
 * Everything here is feature-detected and returns a plain "not available" when
 * the API isn't there, so the hosted app is untouched. Nothing in this module
 * reaches the network; `chrome.runtime` messaging is local to the browser.
 */

import { emailBodyHtml } from './clipboard';

/** The slice of the `chrome` APIs this app uses. There is no `@types/chrome`. */
interface ChromeRuntime {
  id?: string;
  sendMessage(message: unknown): Promise<unknown>;
  getManifest?(): { version?: string };
}

interface ChromeApi {
  runtime?: ChromeRuntime;
  management?: { getSelf?(): Promise<{ installType?: string }> };
}

function chromeApi(): ChromeApi | undefined {
  return (window as unknown as { chrome?: ChromeApi }).chrome;
}

function runtime(): ChromeRuntime | null {
  const api = chromeApi();
  // `runtime.id` is the reliable tell: `chrome` itself exists on every Chrome
  // page, and `runtime` exists on pages a content script has touched.
  return api?.runtime?.id ? api.runtime : null;
}

/**
 * Is this build running as an extension page?
 *
 * Both halves matter. The protocol check rules out a content script's view of
 * an ordinary page, and the runtime check rules out a `chrome-extension:` page
 * whose APIs have been torn down — which is what happens to an orphaned tab
 * after the extension is reloaded during development.
 */
export function isExtensionHost(): boolean {
  return window.location.protocol === 'chrome-extension:' && runtime() !== null;
}

/*
  How the extension announces itself to an ordinary page.

  A web page cannot ask the browser what extensions are installed — any site
  could fingerprint you with it. What an extension *can* do is speak first, on
  origins it holds permission for. So `detect.js` stamps these attributes onto
  `<html>`, and this reads them back.

  The presence stamp is written at `document_start`, before this app's script
  runs, so it's there by first paint. The install type arrives a moment later:
  a content script can't reach `chrome.management`, so it has to ask the
  service worker. That's why this is async — by the time anyone opens the
  Add-ons panel both are long since set, but the API shouldn't pretend the
  second one is synchronous.
*/
const PRESENCE_ATTR = 'data-newsletter-designer-extension';
const INSTALL_TYPE_ATTR = 'data-newsletter-designer-install-type';

export interface ExtensionPresence {
  /** This build is a page *inside* the extension. */
  hosted: boolean;
  /** The extension exists in this browser, whether or not we're hosted by it. */
  installed: boolean;
  version?: string;
  /**
   * `'development'` — loaded unpacked, i.e. developer mode.
   * `'normal'` — installed from the Chrome Web Store.
   * `'admin'` / `'sideload'` / `'other'` — the remaining Chrome values.
   *
   * Undefined when it couldn't be determined, which is not the same as
   * "not developer mode" — the UI must not infer one from the other.
   */
  installType?: string;
}

const NOT_INSTALLED: ExtensionPresence = { hosted: false, installed: false };

/**
 * What do we know about the extension from here?
 *
 * Deliberately distinguishes *installed* from *hosted*. Reporting "not
 * installed" to someone running the dev server with the extension sitting in
 * their toolbar is worse than saying nothing — it's a confident wrong answer,
 * and it sends them to reinstall something they already have.
 */
export async function describeExtension(): Promise<ExtensionPresence> {
  const api = chromeApi();

  if (isExtensionHost()) {
    return {
      hosted: true,
      installed: true,
      version: api?.runtime?.getManifest?.().version,
      installType: await installType(api),
    };
  }

  const root = document.documentElement;
  const version = root.getAttribute(PRESENCE_ATTR);
  if (!version) return NOT_INSTALLED;

  return {
    hosted: false,
    installed: true,
    version,
    installType: root.getAttribute(INSTALL_TYPE_ATTR) || undefined,
  };
}

/**
 * Web Store or loaded unpacked?
 *
 * `chrome.management.getSelf` is documented as callable without the
 * `management` permission, unlike the rest of that API. Guarded anyway: if that
 * ever changes, or the call is refused, the answer is "unknown" — and the UI
 * says nothing rather than guessing.
 */
async function installType(api: ChromeApi | undefined): Promise<string | undefined> {
  try {
    return (await api?.management?.getSelf?.())?.installType;
  } catch {
    return undefined;
  }
}

export type InsertOutcome =
  | { status: 'ok'; method: string }
  | { status: 'error'; error: string };

/**
 * Hand the finished email to the Gmail compose window that opened this tab.
 *
 * The clipboard write happens *here*, not in the Gmail tab, and that ordering
 * is the whole trick. Writing to the clipboard needs a focused document and a
 * user gesture, and the Gmail tab has neither while the designer is in front.
 * So this tab — which has both, because the user just clicked the button —
 * loads the clipboard, and the Gmail tab only has to paste.
 *
 * Pasting through Gmail's own handler is what makes uploaded images survive:
 * it uploads them and rewrites `src` to a hosted URL, exactly as it does for a
 * hand-paste. Writing the markup in directly skips that, so a `data:` image
 * would go out as a `data:` image and most clients would drop it. The
 * background worker falls back to that only if the paste is refused, and says
 * which one it used.
 *
 * Must be called from a user gesture.
 */
export async function insertIntoGmail(
  documentHtml: string
): Promise<InsertOutcome> {
  const api = runtime();
  if (!api) return { status: 'error', error: 'Not running in the extension.' };

  const body = emailBodyHtml(documentHtml);

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([body], { type: 'text/html' }),
        'text/plain': new Blob([plainTextFrom(body)], { type: 'text/plain' }),
      }),
    ]);
  } catch {
    /*
      Not fatal. The background worker's fallback writes the markup straight
      into the draft using the copy carried in the message, so the newsletter
      still lands — it just loses the image upload, and the caller is told.
    */
  }

  try {
    const reply = (await api.sendMessage({
      type: 'insert-into-gmail',
      html: body,
    })) as InsertOutcome | undefined;
    return reply ?? { status: 'error', error: 'No reply from the extension.' };
  } catch (error) {
    return { status: 'error', error: describe(error) };
  }
}

function plainTextFrom(html: string): string {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  return (holder.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
