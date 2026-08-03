/**
 * The Gmail half: a button in the compose window, and the insertion that comes
 * back the other way.
 *
 * Two jobs, and they're separated by however long the user spends designing:
 *
 *   1. Put a "Design newsletter" button in every compose window
 *   2. Later, on a message from the service worker, put the finished email into
 *      whichever draft the user was last in
 */
(() => {
  'use strict';

  const MOUNTED = 'data-newsletter-designer';

  /* --- Finding things in Gmail ------------------------------------------ */
  /*
    Gmail's class names are obfuscated and rotate between deploys. Its ARIA
    attributes are load-bearing for screen readers, so they change far less —
    target those, and keep a fallback for a localised interface where the
    English label won't match.
  */
  const BODY_SELECTORS = [
    'div[aria-label="Message Body"][contenteditable="true"]',
    'div[role="textbox"][contenteditable="true"][aria-multiline="true"]',
  ];

  function composeBodyIn(dialog) {
    for (const selector of BODY_SELECTORS) {
      const found = dialog.querySelector(selector);
      if (found) return found;
    }
    return null;
  }

  function sendButtonIn(dialog) {
    return (
      dialog.querySelector('div[role="button"][aria-label^="Send"]') ||
      dialog.querySelector('div[role="button"][data-tooltip^="Send"]')
    );
  }

  /*
    Which draft to insert into. A user can have several compose windows open,
    and by the time the email comes back the designer tab has had focus for
    minutes — so "the focused one" is meaningless. The last one the user typed
    in or clicked into is the honest answer.
  */
  let lastBody = null;
  document.addEventListener(
    'focusin',
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (BODY_SELECTORS.some((selector) => target.matches(selector))) {
        lastBody = target;
      }
    },
    true
  );

  function targetBody() {
    // Still in the document? A closed compose window leaves a detached node.
    if (lastBody && lastBody.isConnected) return lastBody;
    for (const dialog of document.querySelectorAll('div[role="dialog"]')) {
      const body = composeBodyIn(dialog);
      if (body) return body;
    }
    return null;
  }

  /* --- The button ------------------------------------------------------- */

  function mountButton(dialog) {
    const send = sendButtonIn(dialog);
    const body = composeBodyIn(dialog);
    if (!send || !body) return false;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nl-designer-btn';
    button.textContent = 'Design newsletter';
    button.title = 'Open the Newsletter Designer and insert the result here';
    button.addEventListener('click', (event) => {
      // Never let this reach Gmail — it sits next to Send.
      event.preventDefault();
      event.stopPropagation();
      // Clicking here decides which draft the result comes back to.
      lastBody = body;
      chrome.runtime.sendMessage({ type: 'open-designer' });
    });

    /*
      Sit beside Send rather than floating: this is a peer of the compose
      actions, not an overlay. The cell is the natural unit — Gmail lays that
      row out as a table — and the parent is the fallback for when it isn't.
    */
    const anchor = send.closest('td') || send.parentElement;
    if (anchor && anchor.parentElement) {
      anchor.parentElement.insertBefore(button, anchor.nextSibling);
    } else {
      dialog.appendChild(button);
      button.classList.add('nl-designer-btn--floating');
    }

    dialog.setAttribute(MOUNTED, '1');
    return true;
  }

  function scan() {
    const dialogs = document.querySelectorAll(
      `div[role="dialog"]:not([${MOUNTED}])`
    );
    for (const dialog of dialogs) mountButton(dialog);
  }

  /*
    Gmail is a single-page app: compose windows are created, minimised and
    destroyed without a navigation, so there's no one moment to hook.
  */
  new MutationObserver(scan).observe(document.body, {
    childList: true,
    subtree: true,
  });
  scan();

  /* --- Insertion -------------------------------------------------------- */

  /**
   * Put the caret at the very start of the draft.
   *
   * Paste lands wherever the selection is, and a compose window that hasn't
   * been clicked has no selection inside its body at all — the paste would go
   * nowhere. Starting at the top also leaves the signature below the
   * newsletter, which is where it belongs.
   */
  function caretToStart(body) {
    body.focus();
    const range = document.createRange();
    range.setStart(body, 0);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /**
   * Preferred: paste, so Gmail's own handler runs.
   *
   * That handler is what uploads `data:` images and rewrites `src` to a hosted
   * URL — the same thing it does for a hand-paste, and the reason images
   * survive at all. The clipboard was loaded by the designer tab before it
   * handed over. `execCommand('paste')` is refused to ordinary pages and
   * allowed here only because the manifest asks for `clipboardRead`.
   */
  function insertByPaste(body) {
    caretToStart(body);
    return document.execCommand('paste');
  }

  /**
   * Fallback: write the markup in directly.
   *
   * Always lands, which is exactly why it's second — Gmail's paste handler
   * never runs, so a `data:` image goes out as a `data:` image and most
   * clients drop it. The caller tells the user when it comes to this.
   */
  function insertByMarkup(body, html) {
    body.focus();
    caretToStart(body);
    body.insertAdjacentHTML('afterbegin', html);
    body.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' })
    );
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'insert') return false;

    const body = targetBody();
    if (!body) {
      sendResponse({
        status: 'error',
        error: 'No Gmail compose window is open. Hit Compose, then try again.',
      });
      return false;
    }

    try {
      if (insertByPaste(body)) {
        sendResponse({ status: 'ok', method: 'paste' });
      } else {
        insertByMarkup(body, message.html);
        sendResponse({ status: 'ok', method: 'markup' });
      }
    } catch (error) {
      try {
        insertByMarkup(body, message.html);
        sendResponse({ status: 'ok', method: 'markup' });
      } catch (fallbackError) {
        sendResponse({ status: 'error', error: fallbackError.message });
      }
    }
    return false;
  });
})();
