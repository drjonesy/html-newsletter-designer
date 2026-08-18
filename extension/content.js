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
  const BUTTON_CLASS = 'nl-designer-btn';

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
    'div[g_editable="true"][contenteditable="true"]',
  ];
  const BODY_SELECTOR = BODY_SELECTORS.join(',');

  function composeBodies(root = document) {
    return root.querySelectorAll(BODY_SELECTOR);
  }

  function sendButtonIn(scope) {
    return (
      scope.querySelector('div[role="button"][aria-label^="Send"]') ||
      scope.querySelector('div[role="button"][data-tooltip^="Send"]')
    );
  }

  /*
    The compose scope: the smallest ancestor of a body that also holds that
    draft's Send button.

    Scanning for `div[role="dialog"]` only ever found the pop-out window. A
    reply written *in* the conversation — the common case — isn't a dialog at
    all, it's part of the thread, so it never got a button. There's no one
    container Gmail marks for both, but every compose has a body and a Send,
    so climbing from the body to the first ancestor holding a Send finds the
    right box in either shape.

    Tightest wins, which is what keeps two open drafts apart: the other
    draft's Send button is down a different branch, so the climb reaches this
    one's first. A compose whose Send hasn't rendered yet would otherwise walk
    out to a container holding somebody else's, so the climb stops the moment
    it can see a second draft. Giving up costs nothing: the scan runs again on
    the next mutation, by which time the button it was looking for exists.
  */
  const MAX_SCOPE_DEPTH = 15;

  function composeScopeFor(body) {
    let node = body.parentElement;
    for (let depth = 0; node && depth < MAX_SCOPE_DEPTH; depth++) {
      if (node === document.body) break;
      /*
        Asked before the Send check, not after: an ancestor that can already
        see two drafts is past this compose rather than around it, and the
        Send button it holds belongs to the neighbour. Checking Send first
        hands this body the wrong compose and puts a second button there.
      */
      if (composeBodies(node).length > 1) return null;
      if (sendButtonIn(node)) return node;
      node = node.parentElement;
    }
    return null;
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
    // An inline reply is as good a draft as a pop-out one, so ask for both.
    return composeBodies()[0] || null;
  }

  /* --- The button ------------------------------------------------------- */

  function mountButton(scope, body) {
    const send = sendButtonIn(scope);
    if (!send) return false;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = BUTTON_CLASS;
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
      scope.appendChild(button);
      button.classList.add('nl-designer-btn--floating');
    }

    scope.setAttribute(MOUNTED, '1');
    return true;
  }

  function scan() {
    for (const body of composeBodies()) {
      const scope = composeScopeFor(body);
      if (!scope) continue;
      /*
        The attribute alone isn't enough. Gmail re-renders a compose in place —
        minimise, pop out, switch to full screen — and takes our button with it
        while leaving the marked container behind, so check the button is still
        there rather than trusting the mark.
      */
      if (scope.hasAttribute(MOUNTED) && scope.querySelector(`.${BUTTON_CLASS}`)) {
        continue;
      }
      mountButton(scope, body);
    }
  }

  /*
    Gmail is a single-page app: compose windows are created, minimised and
    destroyed without a navigation, so there's no one moment to hook.

    Coalesced, because the scan now climbs from every compose body rather than
    matching one selector, and Gmail mutates the DOM on every keystroke. A
    timer rather than `requestAnimationFrame`: frames are suspended while the
    tab is hidden, and a reply opened in a background tab would then sit there
    without a button until something brought the tab forward.
  */
  const SCAN_DELAY_MS = 100;
  let scanTimer = 0;
  function queueScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = 0;
      scan();
    }, SCAN_DELAY_MS);
  }

  new MutationObserver(queueScan).observe(document.body, {
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
