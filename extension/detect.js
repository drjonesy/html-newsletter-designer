/**
 * Tells the designer, running as an ordinary web page, that the extension is
 * here.
 *
 * A page can't ask the browser what's installed — any site could fingerprint
 * you with that. But an extension may speak first, on origins it holds
 * permission for, and this one only asks for the designer's own. So it stamps
 * two attributes onto `<html>` and `src/utils/extensionHost.ts` reads them.
 *
 * Attributes rather than a message: the page can then read the answer whenever
 * it likes, including long after load, with no listener to register and no
 * handshake to miss.
 *
 * Runs at `document_start`, so the presence stamp is in place before the app's
 * bundle executes.
 */
(() => {
  'use strict';

  const PRESENCE = 'data-newsletter-designer-extension';
  const INSTALL_TYPE = 'data-newsletter-designer-install-type';

  const root = document.documentElement;
  if (!root) return;

  root.setAttribute(PRESENCE, chrome.runtime.getManifest().version);

  /*
    `chrome.management` isn't exposed to content scripts, so the install type
    has to come from the service worker. It lands a few milliseconds after the
    presence stamp — fine, because nothing reads it until someone opens the
    Add-ons panel.

    Left unset if the worker can't answer. The reader treats absent as
    "unknown", which is honest; writing a guess here would be worse than
    saying nothing.
  */
  chrome.runtime
    .sendMessage({ type: 'install-info' })
    .then((info) => {
      if (info?.installType) root.setAttribute(INSTALL_TYPE, info.installType);
    })
    .catch(() => {
      /* Worker asleep or extension reloading. Presence is already stamped. */
    });
})();
