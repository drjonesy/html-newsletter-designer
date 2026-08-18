/**
 * The service worker: it pairs a designer tab with the mail tab that opened it,
 * and relays the finished email back.
 *
 * Neither end can reach the other directly. The designer is an extension page
 * with no idea which tab launched it; the content script lives in a page that
 * can't address another tab at all. This sits between them and remembers the
 * pairing.
 *
 * MV3 service workers are killed when idle and restarted on the next event, so
 * the pairing lives in `chrome.storage.session` rather than a module variable —
 * an in-memory map would be empty by the time the user finished designing,
 * which is the one moment it's needed.
 */

const PAIRS = 'designer-tab-pairs'; // { [designerTabId]: { tabId, host } }

/** Client keys as `content.js` reports them, and what to call them to a user. */
const HOST_LABELS = { gmail: 'Gmail', outlook: 'Outlook' };

const labelFor = (host) => HOST_LABELS[host] || 'your email';

/*
  The pairing used to be a bare tab id, and a session that spans an extension
  update can still hold one. Normalising on read is a line; a `TypeError` in a
  worker the user can't see is not.
*/
function normalizePair(value) {
  if (typeof value === 'number') return { tabId: value, host: 'gmail' };
  return value && typeof value.tabId === 'number' ? value : null;
}

async function pairs() {
  const stored = await chrome.storage.session.get(PAIRS);
  return stored[PAIRS] || {};
}

async function setPairs(next) {
  await chrome.storage.session.set({ [PAIRS]: next });
}

const designerUrl = () => chrome.runtime.getURL('app/index.html');

/**
 * Open the designer for a given mail tab, or focus the one already open.
 *
 * Reusing the tab matters: the designer autosaves to `localStorage`, so a
 * second tab would be a second view of the same newsletter, and whichever
 * saved last would win. One tab, one editing session.
 */
async function openDesigner(mailTabId, host) {
  const current = await pairs();

  for (const [designerTabId, stored] of Object.entries(current)) {
    const pair = normalizePair(stored);
    if (!pair || pair.tabId !== mailTabId) continue;
    try {
      const tab = await chrome.tabs.get(Number(designerTabId));
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      return tab.id;
    } catch {
      // The tab was closed; fall through and open a fresh one.
      delete current[designerTabId];
    }
  }

  const tab = await chrome.tabs.create({ url: designerUrl(), active: true });
  current[tab.id] = { tabId: mailTabId, host };
  await setPairs(current);
  return tab.id;
}

/**
 * Put the email into the paired draft.
 *
 * The order is the fiddly part. `execCommand('paste')` needs its document
 * focused, and the mail tab is in the background while the user is designing —
 * so the tab has to be brought forward *first*, and only then told to paste.
 * Reversing these two lines makes the paste silently do nothing.
 *
 * The clipboard was already loaded by the designer tab, which had focus and a
 * user gesture. `html` rides along anyway so the content script can fall back
 * to writing it in directly if the paste is refused.
 */
async function insertIntoMail(designerTabId, html) {
  const pair = normalizePair((await pairs())[designerTabId]);
  if (!pair) {
    return {
      status: 'error',
      error: 'No compose window is paired with this tab.',
    };
  }

  const label = labelFor(pair.host);
  const noCompose = {
    status: 'error',
    error: `No ${label} compose window is open. Start a new message, then try again.`,
  };

  let mailTab;
  try {
    mailTab = await chrome.tabs.get(pair.tabId);
  } catch {
    return { status: 'error', error: `That ${label} tab has been closed.` };
  }

  await chrome.tabs.update(pair.tabId, { active: true });
  await chrome.windows.update(mailTab.windowId, { focused: true });

  try {
    const result = await chrome.tabs.sendMessage(pair.tabId, {
      type: 'insert',
      html,
    });
    /*
      A content script with no draft in front of it stays silent rather than
      answering — under `all_frames` the frames without one would otherwise
      race the frame that has one. So "nobody answered" is the no-compose case,
      and it arrives either as an undefined result or as a closed port.
    */
    return result || noCompose;
  } catch (error) {
    if (/message port closed/i.test(error.message)) return noCompose;
    return {
      status: 'error',
      error: `Could not reach the ${label} tab (${error.message}). Reload ${label} and try again.`,
    };
  }
}

/**
 * Was this loaded unpacked, or installed from the Chrome Web Store?
 *
 * `chrome.management.getSelf` is documented as callable without the
 * `management` permission, unlike the rest of that API — but it's guarded, and
 * an unknown answer is reported as unknown rather than guessed at.
 *
 * Content scripts can't reach `chrome.management` at all, which is the only
 * reason this round trip exists.
 */
async function installInfo() {
  try {
    const self = await chrome.management.getSelf();
    return { installType: self.installType, version: self.version };
  } catch {
    return {};
  }
}

/**
 * Which client opened this designer tab, so the app can name it on its button.
 *
 * Unpaired is a real answer, not a failure: the toolbar icon opens the designer
 * with no draft behind it at all.
 */
async function pairedHost(designerTabId) {
  const pair = normalizePair((await pairs())[designerTabId]);
  if (!pair) return { host: null };
  return { host: pair.host, label: labelFor(pair.host) };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'install-info') {
    installInfo().then(sendResponse);
    return true;
  }

  if (message?.type === 'paired-host' && sender.tab) {
    pairedHost(sender.tab.id)
      .then(sendResponse)
      .catch(() => sendResponse({ host: null }));
    return true;
  }

  if (message?.type === 'open-designer' && sender.tab) {
    openDesigner(sender.tab.id, message.host).catch((error) =>
      console.error('[newsletter] open failed', error)
    );
    return false;
  }

  if (message?.type === 'insert-into-mail' && sender.tab) {
    // `true` keeps the message channel open for the async reply below.
    insertIntoMail(sender.tab.id, message.html)
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', error: error.message }));
    return true;
  }

  return false;
});

/* Toolbar icon: open the designer unpaired, for designing without a draft. */
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: designerUrl() });
});

/* A closed designer tab shouldn't leave its pairing behind. */
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const current = await pairs();
  if (current[tabId] === undefined) return;
  delete current[tabId];
  await setPairs(current);
});
