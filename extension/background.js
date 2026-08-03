/**
 * The service worker: it pairs a designer tab with the Gmail tab that opened
 * it, and relays the finished email back.
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

const PAIRS = 'designer-tab-pairs'; // { [designerTabId]: gmailTabId }

async function pairs() {
  const stored = await chrome.storage.session.get(PAIRS);
  return stored[PAIRS] || {};
}

async function setPairs(next) {
  await chrome.storage.session.set({ [PAIRS]: next });
}

const designerUrl = () => chrome.runtime.getURL('app/index.html');

/**
 * Open the designer for a given Gmail tab, or focus the one already open.
 *
 * Reusing the tab matters: the designer autosaves to `localStorage`, so a
 * second tab would be a second view of the same newsletter, and whichever
 * saved last would win. One tab, one editing session.
 */
async function openDesigner(gmailTabId) {
  const current = await pairs();

  for (const [designerTabId, pairedGmailTabId] of Object.entries(current)) {
    if (pairedGmailTabId !== gmailTabId) continue;
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
  current[tab.id] = gmailTabId;
  await setPairs(current);
  return tab.id;
}

/**
 * Put the email into the paired Gmail draft.
 *
 * The order is the fiddly part. `execCommand('paste')` needs its document
 * focused, and the Gmail tab is in the background while the user is designing —
 * so the tab has to be brought forward *first*, and only then told to paste.
 * Reversing these two lines makes the paste silently do nothing.
 *
 * The clipboard was already loaded by the designer tab, which had focus and a
 * user gesture. `html` rides along anyway so the content script can fall back
 * to writing it in directly if the paste is refused.
 */
async function insertIntoGmail(designerTabId, html) {
  const gmailTabId = (await pairs())[designerTabId];
  if (gmailTabId === undefined) {
    return { status: 'error', error: 'No Gmail compose window is paired with this tab.' };
  }

  let gmailTab;
  try {
    gmailTab = await chrome.tabs.get(gmailTabId);
  } catch {
    return { status: 'error', error: 'That Gmail tab has been closed.' };
  }

  await chrome.tabs.update(gmailTabId, { active: true });
  await chrome.windows.update(gmailTab.windowId, { focused: true });

  try {
    const result = await chrome.tabs.sendMessage(gmailTabId, {
      type: 'insert',
      html,
    });
    return result || { status: 'error', error: 'Gmail tab did not respond.' };
  } catch (error) {
    return {
      status: 'error',
      error: `Could not reach the Gmail tab (${error.message}). Reload Gmail and try again.`,
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'install-info') {
    installInfo().then(sendResponse);
    return true;
  }

  if (message?.type === 'open-designer' && sender.tab) {
    openDesigner(sender.tab.id).catch((error) =>
      console.error('[newsletter] open failed', error)
    );
    return false;
  }

  if (message?.type === 'insert-into-gmail' && sender.tab) {
    // `true` keeps the message channel open for the async reply below.
    insertIntoGmail(sender.tab.id, message.html)
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
