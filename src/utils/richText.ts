/**
 * Turns what a `contenteditable` region produces into the small subset of
 * markup email clients agree on.
 *
 * Browsers are free to emit whatever they like from `document.execCommand` —
 * `<b>` here, `<span style="font-weight: 700">` there, `<div>`s for line breaks,
 * `<font>` tags left over from the pre-CSS era — and it varies by engine and by
 * how the user got there (typing, pasting, undo). None of that can be trusted to
 * survive Gmail or Outlook, so nothing goes into an element's `content` until it
 * has been through here.
 *
 * The rules are deliberately narrow:
 *
 * - only `p`, `br`, `strong`, `em`, `u`, `s`, `span` and `a` survive; anything
 *   else is unwrapped, keeping its text
 * - `b`/`i`/`strike`/`div` are rewritten to their allowed equivalents, and
 *   `<font>`'s `color`/`size` attributes become inline styles on a `<span>`
 * - bold / italic / underline expressed as a *style* is re-expressed as
 *   `<strong>` / `<em>` / `<u>`, because Outlook's Word engine drops inherited
 *   font styling on some containers but always honours the tags
 * - only colour, size, weight, style, decoration, background and margin survive
 *   in a `style` attribute
 *
 * Everything runs against a detached DOM node, so no partially-cleaned markup is
 * ever attached to the page.
 */

/** Tags that survive, with the attributes each may keep. */
const ALLOWED_TAGS: Record<string, Set<string>> = {
  P: new Set(['style']),
  BR: new Set<string>(),
  STRONG: new Set(['style']),
  EM: new Set(['style']),
  U: new Set(['style']),
  S: new Set(['style']),
  SPAN: new Set(['style']),
  A: new Set(['style', 'href', 'target', 'rel']),
};

/**
 * Tags removed outright, contents and all.
 *
 * Everything else that isn't allowed is *unwrapped*, keeping its text — the
 * right call for a `<h1>` or a stray `<div>`. These hold code or metadata, so
 * unwrapping one would paste `alert(1)` into the newsletter as visible copy.
 */
const DROPPED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'HEAD',
  'META',
  'LINK',
  'TITLE',
]);

/** Tags rewritten to an allowed equivalent instead of being unwrapped. */
const TAG_ALIASES: Record<string, string> = {
  B: 'STRONG',
  I: 'EM',
  STRIKE: 'S',
  DEL: 'S',
  INS: 'U',
  DIV: 'P',
};

/** Style declarations that survive. Anything else is dropped. */
const ALLOWED_STYLE_PROPS = new Set([
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-decoration-line',
  'margin',
  'margin-top',
  'margin-bottom',
]);

/**
 * `<font size="1..7">` in px. Only ever hit for markup that came from
 * somewhere else — this app's own size control emits real pixel values, see
 * `applyFontSize`.
 */
const FONT_SIZE_PX: Record<string, string> = {
  '1': '10px',
  '2': '13px',
  '3': '16px',
  '4': '18px',
  '5': '24px',
  '6': '32px',
  '7': '48px',
};

/**
 * Bottom margin given to paragraphs typed on the canvas.
 *
 * In `em` so it tracks the block's own font size, and stated explicitly because
 * Outlook and Gmail disagree about what a bare `<p>` is worth.
 */
export const PARAGRAPH_MARGIN = '0 0 1em';

/** Sizes offered for selected text. Body copy sits at 16. */
export const RICH_TEXT_FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];

/** Text colours offered as one click. Anything else goes through the picker. */
export const RICH_TEXT_COLORS = [
  '#111827',
  '#334155',
  '#64748b',
  '#94a3b8',
  '#b22222',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0d9488',
  '#2563eb',
  '#7c3aed',
];

/** Emphasis tags that mean the same thing however many times they're nested. */
const EMPHASIS_TAGS = 'strong, em, u, s';

function unwrap(el: HTMLElement): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

/** Replaces `el` with the same content under a different tag. */
function rename(el: HTMLElement, tagName: string): HTMLElement {
  const next = el.ownerDocument.createElement(tagName);
  for (const attr of Array.from(el.attributes)) {
    next.setAttribute(attr.name, attr.value);
  }
  while (el.firstChild) next.appendChild(el.firstChild);
  el.parentNode?.replaceChild(next, el);
  return next;
}

/** Moves `el`'s children into a new `tagName` child of `el`. */
function wrapInner(el: HTMLElement, tagName: string): void {
  const wrapper = el.ownerDocument.createElement(tagName);
  while (el.firstChild) wrapper.appendChild(el.firstChild);
  el.appendChild(wrapper);
}

/**
 * `rgb(37, 99, 235)` -> `#2563eb`.
 *
 * The CSSOM hands colours back in `rgb()` form whatever was written, and
 * Outlook's Word engine is unreliable with functional colour notation where it
 * has never had trouble with hex. Anything with real transparency is left
 * alone — there's no hex for it, and no email client to be trusted with it
 * either.
 */
function normalizeColor(value: string): string {
  const match =
    /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+)\s*)?\)$/i.exec(
      value.trim()
    );
  if (!match) return value;
  if (match[4] !== undefined && Number(match[4]) < 1) return value;

  const hex = [1, 2, 3]
    .map((i) =>
      Math.max(0, Math.min(255, Math.round(Number(match[i]))))
        .toString(16)
        .padStart(2, '0')
    )
    .join('');
  return `#${hex}`;
}

/** Style properties whose value is a colour. */
const COLOR_PROPS = new Set(['color', 'background-color']);

function filterStyle(el: HTMLElement): void {
  const style = el.getAttribute('style');
  if (style === null) return;
  // Not just absent but blank: clearing the last property off `el.style` leaves
  // `style=""` behind, which would keep an otherwise-empty span alive.
  if (!style.trim()) {
    el.removeAttribute('style');
    return;
  }

  const kept = style
    .split(';')
    .map((decl) => decl.trim())
    .filter(Boolean)
    .map((decl) => {
      const colon = decl.indexOf(':');
      return colon < 0
        ? null
        : ([
            decl.slice(0, colon).trim().toLowerCase(),
            decl.slice(colon + 1).trim(),
          ] as const);
    })
    .filter(
      (pair): pair is readonly [string, string] =>
        !!pair &&
        ALLOWED_STYLE_PROPS.has(pair[0]) &&
        !!pair[1] &&
        // A URL or a legacy IE expression has no business in email text.
        !/url\(|expression\(|javascript:/i.test(pair[1])
    );

  if (kept.length) {
    el.setAttribute(
      'style',
      kept
        .map(([p, v]) => `${p}:${COLOR_PROPS.has(p) ? normalizeColor(v) : v};`)
        .join(' ')
    );
  } else {
    el.removeAttribute('style');
  }
}

/** `<font color size face>` -> `<span style="...">`. */
function fontToSpan(el: HTMLElement): HTMLElement {
  const extra: string[] = [];
  const color = el.getAttribute('color');
  const size = el.getAttribute('size');
  if (color) extra.push(`color:${color};`);
  if (size && FONT_SIZE_PX[size]) extra.push(`font-size:${FONT_SIZE_PX[size]};`);

  const existing = el.getAttribute('style') ?? '';
  el.removeAttribute('color');
  el.removeAttribute('size');
  el.removeAttribute('face');
  if (existing || extra.length) {
    el.setAttribute('style', `${existing} ${extra.join(' ')}`.trim());
  }
  return rename(el, 'SPAN');
}

/**
 * Re-expresses styled emphasis as tags, so Outlook keeps it. The style property
 * is cleared once it has a tag, or the two would say the same thing twice.
 */
function extractEmphasis(el: HTMLElement): void {
  if (/^(bold|bolder|[6-9]00)$/.test(el.style.fontWeight)) {
    wrapInner(el, 'strong');
    el.style.fontWeight = '';
  }
  if (el.style.fontStyle === 'italic' || el.style.fontStyle === 'oblique') {
    wrapInner(el, 'em');
    el.style.fontStyle = '';
  }
  const decoration = `${el.style.textDecoration} ${el.style.textDecorationLine}`;
  if (decoration.includes('underline')) {
    wrapInner(el, 'u');
    el.style.textDecoration = '';
    el.style.textDecorationLine = '';
  }
}

function cleanChildren(parent: HTMLElement, allowParagraphs: boolean): void {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.parentNode?.removeChild(child);
      continue;
    }
    cleanElement(child as HTMLElement, allowParagraphs);
  }
}

function cleanElement(input: HTMLElement, allowParagraphs: boolean): void {
  if (DROPPED_TAGS.has(input.tagName)) {
    input.parentNode?.removeChild(input);
    return;
  }

  // Depth-first: children are already settled before this node is unwrapped or
  // renamed, so a rewrite never has to be redone.
  cleanChildren(input, allowParagraphs);

  let el = input;
  if (el.tagName === 'FONT') el = fontToSpan(el);

  extractEmphasis(el);

  const alias = TAG_ALIASES[el.tagName];
  if (alias) el = rename(el, alias);

  if (el.tagName === 'P' && !allowParagraphs) {
    // A list item is a single line — a paragraph break in one becomes a line
    // break rather than disappearing. `anchor` is grabbed before unwrapping,
    // since that detaches `el` and its parent link with it.
    const parent = el.parentNode;
    const anchor = el.nextSibling;
    unwrap(el);
    if (parent && anchor) {
      parent.insertBefore(document.createElement('br'), anchor);
    }
    return;
  }

  const allowedAttrs = ALLOWED_TAGS[el.tagName];
  if (!allowedAttrs) {
    unwrap(el);
    return;
  }

  for (const attr of Array.from(el.attributes)) {
    if (!allowedAttrs.has(attr.name.toLowerCase())) el.removeAttribute(attr.name);
  }

  if (el.tagName === 'P' && !el.style.margin && !el.style.marginBottom) {
    el.style.margin = PARAGRAPH_MARGIN;
  }

  filterStyle(el);

  // A span carrying nothing is just noise in the exported HTML.
  if (el.tagName === 'SPAN' && el.attributes.length === 0) unwrap(el);
}

/** Drops empty paragraphs and the trailing `<br>` browsers like to leave. */
function trimEmpty(root: HTMLElement): void {
  /*
    Including `<p><br></p>`, which is what a browser leaves behind every time
    Enter is pressed at the end of a field. Blank paragraphs aren't how spacing
    gets made here — each paragraph already carries its own bottom margin — so
    there's nothing to preserve by keeping them.
  */
  for (const el of Array.from(root.querySelectorAll('p'))) {
    if (!el.textContent?.trim()) el.remove();
  }

  // `lastChild`, not `lastElementChild`: a `<br>` in the middle of "a<br>b" is
  // the last *element* but not trailing, and removing it would eat a real line
  // break. Blank text nodes are stepped over, since one often trails the break.
  let last = root.lastChild;
  while (last) {
    if (last.nodeType === Node.TEXT_NODE && !last.textContent?.trim()) {
      const previous = last.previousSibling;
      root.removeChild(last);
      last = previous;
    } else if ((last as Element).tagName === 'BR') {
      const previous = last.previousSibling;
      root.removeChild(last);
      last = previous;
    } else {
      break;
    }
  }
}

/**
 * Flattens `<strong><strong>x</strong></strong>` down to one tag.
 *
 * Lexical's HTML export states a text format twice — once as the wrapper its
 * `exportDOM` adds (`<b>`, `<i>`, `<u>`, `<s>`) and again as the tag its
 * `createDOM` picked for the same node — so bold text arrives here as a tag
 * inside an identical tag. Nesting emphasis is a no-op in every client, so the
 * inner one is dropped; if it carries a style of its own (a colour or size
 * applied to the same words) it becomes a `<span>` so that survives.
 *
 * Runs after `cleanElement`, which is what has already turned Lexical's `<b>`
 * into `<strong>` — before that pass the two tags don't look alike.
 */
function collapseNestedEmphasis(root: HTMLElement): void {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(EMPHASIS_TAGS))) {
    let ancestor = el.parentElement;
    while (ancestor && ancestor !== root) {
      if (ancestor.tagName === el.tagName) {
        if (el.attributes.length === 0) unwrap(el);
        else rename(el, 'SPAN');
        break;
      }
      ancestor = ancestor.parentElement;
    }
  }
}

export interface SanitizeRichHtmlOptions {
  /**
   * Whether `<p>` may appear in the result. True for a block field, where Enter
   * starts a new paragraph; false for a list item, which is one line.
   */
  allowParagraphs?: boolean;
}

/**
 * Cleans one editable field's HTML. Safe to run on markup that is already
 * clean — it is idempotent, which matters because a field is re-sanitized every
 * time it's edited.
 */
export function sanitizeRichHtml(
  html: string,
  opts: SanitizeRichHtmlOptions = {}
): string {
  const allowParagraphs = opts.allowParagraphs !== false;
  const root = document.createElement('div');
  root.innerHTML = html;

  cleanChildren(root, allowParagraphs);
  collapseNestedEmphasis(root);
  trimEmpty(root);

  // Content the user never broke into paragraphs stays flat, so the common case
  // reads the way it did before this block could hold paragraphs at all.
  if (
    allowParagraphs &&
    root.childNodes.length === 1 &&
    root.firstElementChild?.tagName === 'P'
  ) {
    unwrap(root.firstElementChild as HTMLElement);
  }

  return root.innerHTML.trim();
}

/**
 * Applies a pixel font size to the current selection inside `root`.
 *
 * `execCommand('fontSize')` only understands the seven legacy HTML sizes, so
 * this asks for size 7 — a value nothing else in the document uses — and
 * rewrites the `<font size="7">` tags it just created into spans carrying the
 * real size. It is the one reliable way to get the browser's own range-splitting
 * across partially-selected tags without reimplementing it.
 */
export function applyFontSize(root: HTMLElement, px: number): void {
  document.execCommand('fontSize', false, '7');

  let last: HTMLElement | null = null;
  for (const font of Array.from(root.querySelectorAll('font[size="7"]'))) {
    const span = document.createElement('span');
    span.style.fontSize = `${px}px`;
    while (font.firstChild) span.appendChild(font.firstChild);
    font.replaceWith(span);
    last = span;
  }

  // Swapping the nodes out dropped the selection; put it back over the text
  // that was just resized so the next command applies to the same words.
  if (last) {
    const range = document.createRange();
    range.selectNodeContents(last);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}

/**
 * Applies a colour to the current selection as an inline `style`, not a
 * `<font color>` tag.
 *
 * `styleWithCSS` is switched on for just this command: `foreColor` is the one
 * place where the CSS output is the one we want, since `sanitizeRichHtml` would
 * only have to convert the legacy tag back again.
 */
export function applyColor(color: string): void {
  document.execCommand('styleWithCSS', false, 'true');
  document.execCommand('foreColor', false, color);
  document.execCommand('styleWithCSS', false, 'false');
}
