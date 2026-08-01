/**
 * Putting the *rendered* email on the clipboard, so pasting into a Gmail
 * compose window keeps the formatting.
 *
 * This is a different job from Export's "Copy HTML", which puts the markup on
 * the clipboard as **text** — paste that into Gmail and you get a wall of
 * `<table>` tags. Formatting survives a paste only when the clipboard carries a
 * `text/html` flavour, which is what the browser produces when you select a
 * rendered page and hit copy, and what this reproduces without the selecting.
 */

/**
 * The email's body content, without the document wrapper.
 *
 * Body-only on purpose. It's what selecting a rendered page and copying
 * produces, and it's what a compose window wants — a receiving editor handed a
 * whole `<!DOCTYPE html>` document has to go and find the body itself, and not
 * all of them do it well.
 */
export function emailBodyHtml(documentHtml: string): string {
  const parsed = new DOMParser().parseFromString(documentHtml, 'text/html');
  return parsed.body?.innerHTML.trim() || documentHtml;
}

/** A readable plain-text fallback for anywhere that won't take HTML. */
function toPlainText(documentHtml: string): string {
  const parsed = new DOMParser().parseFromString(documentHtml, 'text/html');
  return (parsed.body?.innerText || parsed.body?.textContent || '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Older path: put the markup in an offscreen editable node, select it, and let
 * the browser serialise the selection to the clipboard itself.
 *
 * Exactly the manual "select all, copy" gesture, done for the user. Kept as a
 * fallback because `ClipboardItem` only reached Firefox in 2024.
 */
function copyViaSelection(bodyHtml: string): boolean {
  const holder = document.createElement('div');
  // `contenteditable` is what gets Safari to copy the rich flavour rather than
  // flattening the selection to text.
  holder.setAttribute('contenteditable', 'true');
  holder.innerHTML = bodyHtml;
  /*
    Offscreen rather than hidden. A `display:none` or zero-size node isn't laid
    out, and a selection over content that was never rendered copies as nothing.
  */
  holder.style.cssText =
    'position:fixed;top:0;left:-10000px;width:800px;opacity:0;pointer-events:none;';
  document.body.appendChild(holder);

  const selection = window.getSelection();
  // Whatever the user had selected is theirs; put it back afterwards.
  const previous =
    selection && selection.rangeCount > 0
      ? selection.getRangeAt(0).cloneRange()
      : null;

  const range = document.createRange();
  range.selectNodeContents(holder);
  selection?.removeAllRanges();
  selection?.addRange(range);

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  selection?.removeAllRanges();
  if (previous) selection?.addRange(previous);
  holder.remove();
  return copied;
}

/**
 * Copies the email so it pastes with its formatting intact.
 *
 * Writes both flavours: `text/html` for Gmail and any other rich editor, and
 * `text/plain` for anything that only takes text. Resolves false if the browser
 * refused both paths — the caller should say so rather than showing a tick.
 *
 * Must be called from a user gesture: the async clipboard API rejects outside
 * one, and `execCommand('copy')` is ignored outside one.
 */
export async function copyRenderedEmail(documentHtml: string): Promise<boolean> {
  const body = emailBodyHtml(documentHtml);

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([body], { type: 'text/html' }),
          'text/plain': new Blob([toPlainText(documentHtml)], {
            type: 'text/plain',
          }),
        }),
      ]);
      return true;
    } catch {
      // Permission denied, an unfocused document, or a browser that advertises
      // `write` but rejects this pair of types. Fall through.
    }
  }

  return copyViaSelection(body);
}
