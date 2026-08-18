/**
 * The mail-client half: a button in the compose window, and the insertion that
 * comes back the other way.
 *
 * Two jobs, and they're separated by however long the user spends designing:
 *
 *   1. Put a "Design newsletter" button in every compose window
 *   2. Later, on a message from the service worker, put the finished email into
 *      whichever draft the user was last in
 *
 * Both jobs are the same shape in Gmail and in Outlook Web — find the drafts,
 * mount beside Send, remember the last one focused, paste into it. What differs
 * is only *how you recognise* those parts, so the differences are collected in
 * `HOSTS` and everything below it is written against the resolved adapter. Add
 * a third client by adding an entry there and a match in the manifest.
 */
(() => {
  'use strict';

  const MOUNTED = 'data-newsletter-designer';
  const BUTTON_CLASS = 'nl-designer-btn';

  /* --- The per-client differences --------------------------------------- */
  /*
    Both apps obfuscate their class names and rotate them between deploys.
    Their ARIA attributes are load-bearing for screen readers, so they change
    far less — target those, and keep a generic fallback for a localised
    interface where the English label won't match.
  */
  const HOSTS = {
    gmail: {
      key: 'gmail',
      label: 'Gmail',
      bodySelectors: [
        'div[aria-label="Message Body"][contenteditable="true"]',
        'div[role="textbox"][contenteditable="true"][aria-multiline="true"]',
        'div[g_editable="true"][contenteditable="true"]',
      ],
      sendSelectors: [
        'div[role="button"][aria-label^="Send"]',
        'div[role="button"][data-tooltip^="Send"]',
      ],
      /*
        Gmail's compose actions are laid out as a table, so the cell is the
        natural unit to sit beside.
      */
      maxScopeDepth: 15,
    },
    outlook: {
      key: 'outlook',
      label: 'Outlook',
      bodySelectors: [
        'div[role="textbox"][contenteditable="true"][aria-label^="Message body"]',
        'div[role="textbox"][contenteditable="true"][aria-multiline="true"]',
        'div[contenteditable="true"][id^="editorParent"]',
      ],
      sendSelectors: [
        'button[aria-label^="Send"]',
        'button[title^="Send"]',
        'div[role="button"][aria-label^="Send"]',
      ],
      /*
        Deeper than Gmail's, because Outlook's Send lives up in the ribbon
        rather than in a bar under the body — the nearest ancestor holding both
        is a long way up a React tree. Walking further is safe: the climb stops
        the moment it can see a second draft, which is the real guard.
      */
      maxScopeDepth: 30,
    },
  };

  function resolveHost() {
    const name = location.hostname;
    if (name === 'mail.google.com') return HOSTS.gmail;
    if (
      name === 'outlook.com' ||
      name.startsWith('outlook.') ||
      name.endsWith('.outlook.com')
    ) {
      return HOSTS.outlook;
    }
    return null;
  }

  const HOST = resolveHost();
  /*
    Outlook is injected with `all_frames`, so this runs in every frame of the
    page — most of which are neither a mail client nor anything with a draft in
    it. Leaving early there costs nothing and keeps the observer off the page.
  */
  if (!HOST || !document.body) return;

  const BODY_SELECTOR = HOST.bodySelectors.join(',');

  function composeBodies(root = document) {
    return root.querySelectorAll(BODY_SELECTOR);
  }

  function sendButtonIn(scope) {
    for (const selector of HOST.sendSelectors) {
      const found = scope.querySelector(selector);
      if (found) return found;
    }
    return null;
  }

  /*
    The compose scope: the smallest ancestor of a body that also holds that
    draft's Send button.

    Scanning for `div[role="dialog"]` only ever found the pop-out window. A
    reply written *in* the conversation — the common case — isn't a dialog at
    all, it's part of the thread, so it never got a button. There's no one
    container either client marks for both, but every compose has a body and a
    Send, so climbing from the body to the first ancestor holding a Send finds
    the right box in either shape.

    Tightest wins, which is what keeps two open drafts apart: the other
    draft's Send button is down a different branch, so the climb reaches this
    one's first. A compose whose Send hasn't rendered yet would otherwise walk
    out to a container holding somebody else's, so the climb stops the moment
    it can see a second draft. Giving up costs nothing: the scan runs again on
    the next mutation, by which time the button it was looking for exists.
  */
  function composeScopeFor(body) {
    let node = body.parentElement;
    for (let depth = 0; node && depth < HOST.maxScopeDepth; depth++) {
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
      if (HOST.bodySelectors.some((selector) => target.matches(selector))) {
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
    button.className = `${BUTTON_CLASS} ${BUTTON_CLASS}--${HOST.key}`;
    button.textContent = 'Design newsletter';
    button.title = 'Open the Newsletter Designer and insert the result here';
    button.addEventListener('click', (event) => {
      // Never let this reach the client — it sits next to Send.
      event.preventDefault();
      event.stopPropagation();
      // Clicking here decides which draft the result comes back to.
      lastBody = body;
      chrome.runtime.sendMessage({ type: 'open-designer', host: HOST.key });
    });

    /*
      Sit beside Send rather than floating: this is a peer of the compose
      actions, not an overlay. Gmail lays that row out as a table, so the cell
      is its natural unit; Outlook's ribbon is a flex row with no cell to find,
      which is what the parent fallback is already for.
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
        The attribute alone isn't enough. Both clients re-render a compose in
        place — minimise, pop out, switch to full screen — and take our button
        with it while leaving the marked container behind, so check the button
        is still there rather than trusting the mark.
      */
      if (scope.hasAttribute(MOUNTED) && scope.querySelector(`.${BUTTON_CLASS}`)) {
        continue;
      }
      mountButton(scope, body);
    }
  }

  /*
    Both are single-page apps: compose windows are created, minimised and
    destroyed without a navigation, so there's no one moment to hook.

    Coalesced, because the scan climbs from every compose body rather than
    matching one selector, and both clients mutate the DOM on every keystroke.
    A timer rather than `requestAnimationFrame`: frames are suspended while the
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
   * Preferred: paste, so the client's own handler runs.
   *
   * That handler is what takes `data:` images off our hands — Gmail uploads
   * them and rewrites `src` to a hosted URL, Outlook turns them into inline
   * attachments — exactly as each does for a hand-paste, and the reason images
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
   * Always lands, which is exactly why it's second — the client's paste handler
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
    /*
      Silence rather than an error, because under `all_frames` every frame of
      an Outlook tab gets this message and only one of them can be holding the
      draft. A frame that answered "no compose here" would race the frame that
      has one and win. The worker reads no-answer-from-anyone as no compose
      window open, which is the same thing said once.
    */
    if (!body) return false;

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
