import {
  ColumnElement,
  ElementType,
  EmailElement,
  EmailSettings,
  NewsletterTemplate,
  QuoteElement,
  RowElement,
  TextAlign,
} from '../types';
import { resolveTextStyle } from './typography';
import { cssFontFamily } from './richText';
import {
  BlockPadding,
  blockBorder,
  blockMargin,
  blockPadding,
  blockRadius,
  evenWidths,
  isContainerElement,
} from './elementHelpers';

/**
 * Wraps text in <strong>/<em> on top of the inline font-weight/font-style styles.
 * Outlook (Word engine) ignores inherited font-style on some containers, so the
 * semantic tags are the reliable belt to the inline-style braces.
 */
function wrapEmphasis(html: string, bold: boolean, italic: boolean): string {
  let out = html;
  if (bold) out = `<strong>${out}</strong>`;
  if (italic) out = `<em>${out}</em>`;
  return out;
}

/**
 * The `text-align` declaration for a block, or `''` when it has none.
 *
 * Absent means *inherit*, not left — the block follows whatever container it
 * sits in — so an unaligned block emits nothing and a newsletter that has never
 * used alignment exports exactly the bytes it did before the field existed.
 *
 * The leading space is part of it: every caller appends this to a style
 * attribute that already ends in `;`, and an empty string has to leave no gap.
 */
function alignStyle(align: TextAlign | undefined): string {
  return align ? ` text-align:${align};` : '';
}

/**
 * The `background-color` declaration for a block, or `''` when it has none.
 *
 * Same bargain as `alignStyle`, and the same leading space: absent means no
 * fill, so a block that has never been given one emits the bytes it always did.
 *
 * `section`, `column` and `quote` don't come through here — each paints the box
 * it already draws from its own `bgColor`, which the cases below build into the
 * `<td>` or `<blockquote>` style directly. See `blockBackground`.
 */
function bgStyle(element: EmailElement): string {
  const bg = element.backgroundColor;
  return bg && bg !== 'transparent' ? ` background-color:${bg};` : '';
}

/**
 * The `bgcolor` attribute for a block, or `''` when it has none.
 *
 * Stated alongside the CSS wherever the fill lands on a `<td>` or a `<table>`:
 * Outlook's Word engine reads the attribute, and it is the one place a
 * background is reliable there.
 */
function bgAttr(element: EmailElement): string {
  const bg = element.backgroundColor;
  return bg && bg !== 'transparent' ? ` bgcolor="${bg}"` : '';
}

/**
 * A `padding` declaration, in the shortest form that says the same thing.
 *
 * Collapsing matters for more than tidiness: a quote that has never been
 * repadded resolves to 16/20/16/20, and only the two-value form emits the
 * `padding:16px 20px;` the generator has always written for it.
 *
 * `section` and `column` deliberately don't come through here — both have
 * always written the four-value form on their `<td>`, and collapsing it now
 * would rewrite the export of every newsletter that uses one.
 */
function paddingShorthand(p: BlockPadding): string {
  if (p.top === p.right && p.right === p.bottom && p.bottom === p.left) {
    return `padding:${p.top}px;`;
  }
  if (p.top === p.bottom && p.left === p.right) {
    return `padding:${p.top}px ${p.left}px;`;
  }
  return `padding:${p.top}px ${p.right}px ${p.bottom}px ${p.left}px;`;
}

/**
 * The `padding` declaration for a block, or `''` when it has none.
 *
 * Same bargain as `alignStyle` and `bgStyle`, and the same leading space:
 * absent means no padding, so a block that has never been padded emits the
 * bytes it always did.
 *
 * The four types that pad themselves — `section` and `column` on their `<td>`,
 * `image` with its long-standing top/bottom pair, `quote` with its legacy
 * default — build their own declaration from `blockPadding` instead, since each
 * has bytes to preserve that a plain shorthand would change.
 */
function paddingStyle(element: EmailElement): string {
  const p = blockPadding(element);
  if (!p.top && !p.right && !p.bottom && !p.left) return '';
  return ` ${paddingShorthand(p)}`;
}

/**
 * The `border-*` declarations for a block, or `''` when it draws none.
 *
 * Same bargain as `alignStyle`, `bgStyle` and `paddingStyle`, and the same
 * leading space: no side with a width means no border, so a block that has
 * never been given one emits the bytes it always did. Only non-zero sides are
 * written — see `sideBorders` for why.
 *
 * It lands on the same box as the block's fill and rounding: the `<td>` for
 * image, divider, spacer and custom-html, the element's own tag for heading,
 * paragraph, list and quote, the strip's table for a row, and the chip's `<a>`
 * for a button.
 */
function borderStyle(element: EmailElement): string {
  const b = blockBorder(element);
  const decls = sideBorders(b, b.style, b.color);
  return decls ? ` ${decls}` : '';
}

/**
 * The `border-radius` declaration for a block, or `''` when it has none.
 *
 * Same bargain as `alignStyle`, `bgStyle` and `paddingStyle`, and the same
 * leading space: absent and 0 both mean square, so a block that has never been
 * rounded emits the bytes it always did.
 *
 * It goes on whatever the block's own box is — the `<td>` for image, divider,
 * spacer and custom-html, the element's own tag for heading, paragraph, list
 * and quote, the strip's table for a row. `button` doesn't come through here:
 * its radius is the chip's, written unconditionally on the `<a>` and mirrored
 * as the VML `arcsize` Outlook needs. Nothing clips children to a radius, so
 * this rounds the block's fill and border rather than what sits inside it.
 */
function radiusStyle(element: EmailElement): string {
  const r = blockRadius(element);
  return r > 0 ? ` border-radius:${r}px;` : '';
}

/**
 * The block types whose own tag is a block-level element that can carry all
 * four margins itself.
 *
 * A heading, a paragraph's `<div>`, a list and a `<blockquote>` are all
 * auto-width, so a left or right margin narrows them rather than pushing them
 * out of whatever holds them. Every other type's box is a full-width `<table>`,
 * where the same declaration overflows — see `applyOuterMargin`.
 */
const TAG_MARGIN_TYPES: ElementType[] = ['heading', 'paragraph', 'list', 'quote'];

/**
 * The block types that have written a vertical margin on their own `<table>`
 * since long before the sides were general.
 *
 * They keep writing exactly those two declarations, which is what makes the
 * four sides a no-op for every newsletter that hasn't used them. Only the
 * horizontal pair goes to the wrapper.
 */
const TABLE_MARGIN_TYPES: ElementType[] = ['button', 'section', 'row', 'divider'];

/** No margin at all, for a row child that isn't a column and has no cell of its own. */
const ZERO_SIDES: BlockPadding = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * The `margin` declarations for a block that carries them on its own tag.
 *
 * Widens to the four-value shorthand only once a horizontal side is set, the
 * same bargain `paddingStyle` strikes for an image: with none, this is byte for
 * byte the pair these blocks have always emitted.
 */
function tagMargin(element: EmailElement): string {
  const m = blockMargin(element);
  if (!m.left && !m.right) {
    return `margin-top:${m.top}px; margin-bottom:${m.bottom}px;`;
  }
  return `margin:${m.top}px ${m.right}px ${m.bottom}px ${m.left}px;`;
}

/**
 * The vertical `margin` pair for a block whose own box is a `<table>`.
 *
 * Always written, at 0 as much as at 24 — these types have emitted both
 * declarations for their whole life, and dropping them at 0 would rewrite the
 * export of every newsletter that holds one.
 */
function tableMargin(element: EmailElement): string {
  const m = blockMargin(element);
  return `margin-top:${m.top}px; margin-bottom:${m.bottom}px;`;
}

/**
 * Wraps a block in a cell carrying the margin its own box can't.
 *
 * `margin-left` on a `<table width="100%">` doesn't inset it — the table is
 * already as wide as the thing holding it, so the margin pushes it out the
 * other side. A wrapper cell's padding is the one form of "space outside this
 * block" that a table layout renders the way it reads: the fill, border and
 * radius all live on the inner box, so the space this adds is outside them.
 *
 * Which sides come through depends on where the block already puts them:
 *
 * - `TAG_MARGIN_TYPES` need no wrapper at all — all four are on their own tag.
 * - `TABLE_MARGIN_TYPES` keep their vertical pair where it has always been, so
 *   only a horizontal margin builds the wrapper.
 * - `image`, `spacer` and `custom-html` never had a margin field, so all four
 *   come through here and none of them costs an existing newsletter a byte.
 * - A `column` is skipped because its margin is applied somewhere else, not
 *   because it hasn't got one: the cell it lives in belongs to the row, so
 *   `columnCell` makes the same translation there — see it for how.
 */
function applyOuterMargin(html: string, element: EmailElement): string {
  if (!html.trim()) return html;
  if (element.type === 'column') return html;
  if (TAG_MARGIN_TYPES.includes(element.type)) return html;

  const m = blockMargin(element);
  const ownsVertical = TABLE_MARGIN_TYPES.includes(element.type);
  const top = ownsVertical ? 0 : m.top;
  const bottom = ownsVertical ? 0 : m.bottom;
  if (!top && !m.right && !bottom && !m.left) return html;

  // `paddingShorthand` for the same reason the padded blocks use it: 24 on
  // every side should read as `padding:24px;` rather than four copies of it.
  const inset = paddingShorthand({
    top,
    right: m.right,
    bottom,
    left: m.left,
  });

  return `<table width="100%" border="0" cellspacing="0" cellpadding="0">
  <tr>
    <td style="${inset}">
${html}
    </td>
  </tr>
</table>`;
}

export interface RenderOptions {
  /**
   * Canvas-only. Wraps each directly-typeable text field in a marker span so
   * VisualCanvas can turn it into a contenteditable region. Never pass this
   * when generating markup that leaves the app — the spans are editor chrome,
   * not email HTML.
   */
  editable?: boolean;
}

/**
 * How a field behaves once the user is typing in it.
 *
 * - `plain` — one line of text, committed as `textContent`. Enter saves.
 * - `rich`  — a block of formatted text, committed as sanitized HTML. The
 *   formatting toolbar appears, and Enter starts a new paragraph.
 * - `item`  — one entry of a list: formatted like `rich`, but a single line, so
 *   Enter makes the *next* item instead of a paragraph.
 */
export type EditMode = 'plain' | 'rich' | 'item';

/**
 * Tags a text field for inline editing on the canvas. Returns `value` untouched
 * unless `opts.editable` is set, so the exported email HTML is byte-identical
 * to what it was before inline editing existed.
 *
 * `field` must be the element property name — VisualCanvas writes the edited
 * text straight back to `element[field]`. A field holding one entry of an array
 * uses `name.index` (`items.2`), which is the one nesting the writer supports.
 *
 * A `rich` field is emitted as a `<div>`: paragraph breaks are block-level, and
 * a browser asked to put a `<p>` inside a `<span>` will do something else
 * instead.
 */
function editableField(
  value: string,
  field: string,
  opts: RenderOptions | undefined,
  mode: EditMode = 'plain'
): string {
  if (!opts?.editable) return value;

  // An empty field would collapse to a zero-width box with nothing to click.
  const isEmpty = value.trim().length === 0;
  const shown = isEmpty ? 'Click to edit…' : value;
  const tag = mode === 'rich' ? 'div' : 'span';

  return `<${tag} data-edit-field="${field}"${
    mode === 'plain' ? '' : ` data-edit-rich="1" data-edit-enter="${mode}"`
  }${
    isEmpty ? ' data-edit-empty="1" style="opacity:0.4;"' : ''
  }>${shown}</${tag}>`;
}

/**
 * Class names carrying the per-device visibility rules. Defined in
 * `generateEmailHtml`'s `<head>`, which is the only CSS email clients reliably
 * honour — and even then not all of them; see `BlockVisibility`.
 */
export const HIDE_ON_MOBILE_CLASS = 'nl-hide-sm';
export const HIDE_ON_DESKTOP_CLASS = 'nl-only-sm';

/**
 * Wraps a block so it is hidden on one device.
 *
 * Returns `html` untouched when the block is shown everywhere, which is the
 * case for every block that has never been given a visibility setting — so
 * adding this feature changed nothing about existing exports.
 *
 * Hiding on *desktop* needs the inline `display:none` as the default state and
 * a media query to undo it, because there is no "min-width" support to rely on;
 * hiding on mobile is the other way round.
 */
function applyVisibility(html: string, element: EmailElement): string {
  const desktop = element.visibility?.desktop !== false;
  const mobile = element.visibility?.mobile !== false;

  if (desktop && mobile) return html;
  // Hidden on every device. Emitting the markup and hiding it twice would leave
  // contradictory rules for a client to resolve.
  if (!desktop && !mobile) return '';

  return mobile
    ? `<div class="${HIDE_ON_DESKTOP_CLASS}" style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
${html}
</div>`
    : `<div class="${HIDE_ON_MOBILE_CLASS}">
${html}
</div>`;
}

/**
 * Class names carrying the column-stacking rules, written into `<head>` by
 * `generateEmailHtml` only when a row actually asks to stack.
 *
 * `nl-stack` goes on the row's table and the other two on its cells, so the
 * media query can turn one row's cells into full-width blocks without reaching
 * into a row that opted out.
 */
export const ROW_STACK_CLASS = 'nl-stack';
export const COLUMN_CLASS = 'nl-col';
export const COLUMN_GAP_CLASS = 'nl-gap';

/** Trims a width to at most two decimals without leaving a trailing `.00`. */
const pct = (value: number) => String(Number(value.toFixed(2)));

/**
 * The width of each cell in a row.
 *
 * Falls back to an even split for any child that isn't a column or has no
 * usable width. A hand-edited project file can put a paragraph straight into a
 * row; rendering it in a cell of its own is a better answer than dropping the
 * author's block on the floor.
 */
function columnWidths(children: EmailElement[]): number[] {
  const fallback = evenWidths(children.length);
  return children.map((child, i) =>
    child.type === 'column' && isFinite(child.width) && child.width > 0
      ? child.width
      : fallback[i]
  );
}

/**
 * One `<td>` of a row.
 *
 * The column's own padding and fill go here rather than on a wrapper inside
 * it: a `<td>` is the one box Outlook's Word engine pads reliably, and keeping
 * them on the cell means a row is one table deep however many columns it has.
 */
function columnCell(
  child: EmailElement,
  width: number,
  settings: EmailSettings,
  opts?: RenderOptions
): string {
  const column = child.type === 'column' ? child : null;
  const valign = column?.verticalAlign ?? 'top';
  const bg =
    column?.bgColor && column.bgColor !== 'transparent' ? column.bgColor : '';

  const borders = column ? borderStyle(column).trim() : '';

  /*
    Everything that makes the column a *box*, kept apart from the two
    declarations that make the cell a cell — its share of the width and how it
    sits against its neighbours. A margin is the one thing that has to come
    between them, so it needs to be able to take the box and move it inwards.
  */
  const box = [
    column
      ? `padding:${column.paddingTop}px ${column.paddingRight}px ${column.paddingBottom}px ${column.paddingLeft}px;`
      : '',
    borders,
    bg ? `background-color:${bg};` : '',
    column ? radiusStyle(column).trim() : '',
    alignStyle(column?.textAlign).trim(),
  ]
    .filter(Boolean)
    .join(' ');

  const fill = bg ? ` bgcolor="${bg}"` : '';

  // An empty cell collapses in some clients, taking the row's other columns
  // out of alignment with it.
  const body =
    renderElementToHtml(child, settings, opts).trim() ||
    '<div style="font-size:1px; line-height:1px;">&nbsp;</div>';

  const m = column ? blockMargin(column) : ZERO_SIDES;
  const cell = `width:${pct(width)}%; vertical-align:${valign};`;

  if (!m.top && !m.right && !m.bottom && !m.left) {
    const style = [cell, box].filter(Boolean).join(' ');
    return `    <td class="${COLUMN_CLASS}" width="${pct(width)}%" valign="${valign}"${fill} style="${style}">
${body}
    </td>`;
  }

  /*
    A margined column is the one case that needs a table inside the cell.

    A margin has to fall *outside* the column's fill and border, and both of
    those are on the `<td>` — the only box Outlook's Word engine paints and
    pads reliably. So the cell keeps its width and its vertical alignment, takes
    the margin as padding (the same translation `applyOuterMargin` makes, and
    for the same reason: a `<td>` has no margin to give), and hands the whole
    box to a cell of its own inside.

    The class stays on the outer cell, so stacking still turns *this* into the
    full-width block and the margin travels to mobile with it.
  */
  return `    <td class="${COLUMN_CLASS}" width="${pct(width)}%" valign="${valign}" style="${cell} ${paddingShorthand(
    m
  )}">
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td${fill}${box ? ` style="${box}"` : ''}>
${body}
          </td>
        </tr>
      </table>
    </td>`;
}

/**
 * The spacer cell that makes the gap between two columns.
 *
 * A cell rather than padding on the columns, so the gap only ever falls
 * *between* them — padding would also inset the row's outer edges. The inner
 * `<div>` is what carries the gap over to mobile: once the media query turns
 * the cell into a full-width block, its px width stops meaning anything and the
 * div's height becomes the vertical gap between the stacked columns.
 *
 * The div also has to state that **width**, and that is what actually makes the
 * gap appear. The column percentages already total 100, so there is nothing
 * left of the table for this cell to be given: a `width` attribute and a
 * `width:` declaration are both hints the auto table layout is free to ignore,
 * and it does — the cell collapses to its minimum content width, which for a
 * `&nbsp;` at `font-size:1px` is about a pixel, and the columns come out flush.
 * A fixed-width child is not a hint. It raises the cell's *minimum* width to
 * the gap, which the layout has to honour, so the percentage columns shrink to
 * make room the way the canvas's flex row does.
 */
function columnGapCell(gap: number): string {
  return `    <td class="${COLUMN_GAP_CLASS}" width="${gap}" style="width:${gap}px; font-size:0; line-height:0;"><div style="width:${gap}px; height:${gap}px; line-height:${gap}px; font-size:1px;">&nbsp;</div></td>`;
}

/**
 * True for a column that draws no box of its own — and so has nothing a `<td>`
 * has to carry for it. Alignment counts: it lives on the cell, so a column that
 * aligns its contents is no longer bare however empty its border and padding.
 * A margin counts for the same reason — it is padding on that cell.
 */
function isBareColumn(column: ColumnElement): boolean {
  const m = blockMargin(column);
  return (
    !m.top &&
    !m.right &&
    !m.bottom &&
    !m.left &&
    !column.textAlign &&
    column.borderTopWidth === 0 &&
    column.borderRightWidth === 0 &&
    column.borderBottomWidth === 0 &&
    column.borderLeftWidth === 0 &&
    column.paddingTop === 0 &&
    column.paddingRight === 0 &&
    column.paddingBottom === 0 &&
    column.paddingLeft === 0 &&
    (!column.bgColor || column.bgColor === 'transparent') &&
    !radiusStyle(column)
  );
}

function renderRow(
  element: RowElement,
  settings: EmailSettings,
  opts?: RenderOptions
): string {
  const children = element.childElements || [];
  // No columns means no cells, and a `<tr>` with none is invalid markup. The
  // canvas shows a placeholder to drop into; the email shows nothing.
  if (children.length === 0) return '';

  /*
    A one-column row that draws nothing emits only its blocks — the same
    bargain a bare `section` strikes, and it matters more now that "1 Column"
    is what the palette offers as the general-purpose box. There is no layout
    to express with a single unstyled cell, and Gmail clips at ~102KB, so the
    wrapper table would be pure weight. The blank-line join matches how
    `generateEmailHtml` joins top-level blocks, making the wrap byte-neutral
    rather than merely render-neutral.

    Only for one column: two cells side by side *are* the layout.
  */
  const padding = paddingStyle(element);

  const only = children.length === 1 ? children[0] : null;
  if (
    only &&
    only.type === 'column' &&
    isBareColumn(only) &&
    // Vertical only, for the same reason the section's `hasSpacing` is: a
    // horizontal margin lands on the wrapper `applyOuterMargin` puts outside
    // this table, so it can't be a reason to keep the table.
    element.marginTop === 0 &&
    element.marginBottom === 0 &&
    // A fill is drawn on the row's own table, and padding on a cell wrapped
    // around it, so a row with either is no longer emitting nothing — the same
    // reason `textAlign` costs a section its early return.
    !bgStyle(element) &&
    !radiusStyle(element) &&
    !borderStyle(element) &&
    !padding
  ) {
    return (only.childElements || [])
      .map((child) => renderElementToHtml(child, settings, opts))
      .join('\n\n');
  }

  const gap = Math.max(0, element.gap || 0);
  const widths = columnWidths(children);

  const cells: string[] = [];
  children.forEach((child, i) => {
    if (i > 0 && gap > 0) cells.push(columnGapCell(gap));
    cells.push(columnCell(child, widths[i], settings, opts));
  });

  // Only a row that stacks wears the class, so the `<head>` rules can't reach a
  // row whose author wants it side-by-side everywhere.
  const stack = element.stackOnMobile !== false ? ` class="${ROW_STACK_CLASS}"` : '';

  /*
    A padded row is the one case that needs a second table. Padding on the
    strip's own `<table>` is not reliable — a `<td>` is the box Outlook's Word
    engine pads — and it can't go on the column cells either, since that would
    inset the gaps between them as well as the row's outer edges.

    When the wrapper is there it takes the margins and the fill too, so the
    colour covers the padding and the space around the row stays outside it.
    An unpadded row still emits the single table it always did.
  */
  const wrapped = !!padding;
  const margins = tableMargin(element);

  const strip = `<table${stack} width="100%" border="0" cellspacing="0" cellpadding="0"${
    wrapped ? '' : bgAttr(element)
  }${
    wrapped
      ? ''
      : ` style="${margins}${bgStyle(element)}${borderStyle(
          element
        )}${radiusStyle(element)}"`
  }>
  <tr>
${cells.join('\n')}
  </tr>
</table>`;

  if (!wrapped) return strip;

  return `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="${margins}">
  <tr>
    <td${bgAttr(element)} style="${padding.trim()}${bgStyle(element)}${borderStyle(
    element
  )}${radiusStyle(element)}">
${strip}
    </td>
  </tr>
</table>`;
}

export interface SideWidths {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * `border-*` declarations for the sides that have a width.
 *
 * Only non-zero sides emit anything: a shorthand plus per-side overrides fights
 * Outlook, and `0px solid` still reserves a hairline in some clients. Returns
 * `''` when there's no border at all, which the callers filter out so no empty
 * slot is left in the style attribute.
 */
function sideBorders(
  widths: SideWidths,
  style: string,
  color: string
): string {
  return (['top', 'right', 'bottom', 'left'] as const)
    .filter((side) => widths[side] > 0)
    .map((side) => `border-${side}:${widths[side]}px ${style} ${color};`)
    .join(' ');
}

export function renderElementToHtml(
  element: EmailElement,
  settings: EmailSettings,
  opts?: RenderOptions
): string {
  /*
    The margin wrapper is *not* editor chrome, so it goes on both paths: it is
    space the block really has, and leaving it off the canvas would make the
    preview disagree with the email. Blocks that carry their margins on their
    own tag come back untouched.
  */
  const html = applyOuterMargin(
    renderElementBody(element, settings, opts),
    element
  );
  /*
    Never on the canvas. The editor has to keep showing a block the author has
    hidden — otherwise hiding one would make it unselectable and unrecoverable.
    `BlockFrame` marks it with a badge instead.
  */
  return opts?.editable ? html : applyVisibility(html, element);
}

function renderElementBody(
  element: EmailElement,
  settings: EmailSettings,
  opts?: RenderOptions
): string {
  // Quote-safe: this is interpolated into `style="…"` attributes.
  const fontFamily = cssFontFamily(settings.fontFamily);

  switch (element.type) {
    case 'image': {
      // On the `<img>` rather than its cell: the image is the box here, and a
      // radius on the `<td>` would round a fill the picture then covers.
      const img = `<img src="${element.src}" alt="${element.alt}" width="${element.width}" ${element.height ? `height="${element.height}"` : ''} style="max-width:100%; height:auto; display:inline-block; border:0;${borderStyle(element)}${radiusStyle(element)}" />`;
      const wrappedImg = element.href
        ? `<a href="${element.href}" target="_blank" style="text-decoration:none;">${img}</a>`
        : img;
      /*
        An image has padded its cell top and bottom since long before the sides
        were general, so it keeps emitting those two declarations until one of
        the new sides is actually used — which is what keeps every existing
        image exporting the bytes it always did.
      */
      const p = blockPadding(element);
      const padding =
        p.left || p.right
          ? paddingShorthand(p)
          : `padding-top:${p.top}px; padding-bottom:${p.bottom}px;`;
      return `<table width="100%" border="0" cellspacing="0" cellpadding="0">
  <tr>
    <td align="${element.alignment}"${bgAttr(element)} style="${padding}${bgStyle(element)}">
      ${wrappedImg}
    </td>
  </tr>
</table>`;
    }

    case 'heading': {
      const Tag = element.level || 'h2';
      // Theme first, the block's own fields over the top — see
      // `resolveTextStyle`. Nothing here reads `element.fontSize` directly,
      // because absent means "inherit", not zero.
      const t = resolveTextStyle(element, settings);
      const text = wrapEmphasis(
        editableField(element.text, 'text', opts),
        t.fontWeight === 'bold',
        t.fontStyle === 'italic'
      );
      return `<${Tag} style="font-size:${t.fontSize}px; color:${t.color}; ${tagMargin(element)} text-transform:${t.transform}; letter-spacing:${t.letterSpacing}; font-family:${fontFamily}; font-weight:${t.fontWeight}; font-style:${t.fontStyle}; line-height:${t.lineHeight};${alignStyle(element.textAlign)}${bgStyle(element)}${paddingStyle(element)}${borderStyle(element)}${radiusStyle(element)}">${text}</${Tag}>`;
    }

    case 'paragraph': {
      const t = resolveTextStyle(element, settings);
      const weight = t.fontWeight;
      const style = t.fontStyle;
      /*
        The editable branch skips `wrapEmphasis`: whole-block bold/italic is
        already on the wrapper's inline style, and the tags are only there for
        Outlook — which never sees the canvas. Wrapping would also put the
        editable <div> inside a <strong>, where a paragraph break can't go.
      */
      const content = opts?.editable
        ? editableField(element.content, 'content', opts, 'rich')
        : wrapEmphasis(element.content, weight === 'bold', style === 'italic');
      return `<div style="font-size:${t.fontSize}px; line-height:${t.lineHeight}; color:${t.color}; ${tagMargin(element)} font-family:${fontFamily}; font-weight:${weight}; font-style:${style};${alignStyle(element.textAlign)}${bgStyle(element)}${paddingStyle(element)}${borderStyle(element)}${radiusStyle(element)}">
  ${content}
</div>`;
    }

    case 'list': {
      const Tag = element.ordered ? 'ol' : 'ul';
      // A list is body copy, so it reads the theme's `paragraph` entry.
      const t = resolveTextStyle(element, settings);
      const weight = t.fontWeight;
      const style = t.fontStyle;
      // A list with nothing in it still needs one row, or there'd be nothing
      // on the canvas to click into.
      const items = element.items?.length ? element.items : [''];

      const rows = items
        .map((item, i) => {
          // Same split as `paragraph`: the semantic tags are Outlook's belt for
          // whole-block emphasis, and Outlook never sees the editable branch.
          const body = opts?.editable
            ? editableField(item, `items.${i}`, opts, 'item')
            : wrapEmphasis(item, weight === 'bold', style === 'italic');
          return `    <li style="margin:0 0 ${element.itemSpacing}px 0; padding:0;">${body}</li>`;
        })
        .join('\n');

      /*
        A centred or right-aligned list also moves its markers into the text
        flow. `list-style-position` is `outside` by default, which pins the
        marker to the padding edge — align the copy away from that edge and the
        bullets are left behind on their own. Left alignment keeps `outside`,
        which is both the nicer hanging indent and the byte the generator has
        always emitted.
      */
      const marker =
        element.textAlign === 'center' || element.textAlign === 'right'
          ? ' list-style-position:inside;'
          : '';

      /*
        `padding-left` rather than `margin-left`: Outlook's Word engine indents
        lists with padding and ignores the margin, so stating both would double
        the indent there.

        Which is also why the list is the one block whose padding can't simply
        be appended — it already writes the property. The indent is the marker's
        own hanging distance, so the two *add*: pad the list by 12 and it keeps
        whatever indent its markers were given, 12px further in. A list that has
        never been padded emits the declaration it always did.
      */
      const p = blockPadding(element);
      const padding =
        p.top || p.right || p.bottom || p.left
          ? `padding:${p.top}px ${p.right}px ${p.bottom}px ${
              p.left + element.indent
            }px;`
          : `padding:0 0 0 ${element.indent}px;`;

      /*
        The one block that doesn't go through `tagMargin`: it has always
        written the four-value shorthand with bare zeros in the horizontal
        slots, so it widens on its own terms — the two-declaration form
        `tagMargin` returns would rewrite every list in every newsletter.
      */
      const m = blockMargin(element);
      const margin =
        !m.left && !m.right
          ? `margin:${m.top}px 0 ${m.bottom}px 0;`
          : `margin:${m.top}px ${m.right}px ${m.bottom}px ${m.left}px;`;

      return `<${Tag} style="${margin} ${padding} color:${t.color}; font-size:${t.fontSize}px; line-height:${t.lineHeight}; font-family:${fontFamily}; font-weight:${weight}; font-style:${style}; list-style-type:${element.marker};${alignStyle(element.textAlign)}${marker}${bgStyle(element)}${borderStyle(element)}${radiusStyle(element)}">
${rows}
</${Tag}>`;
    }

    case 'button': {
      /*
        Full width fills whatever cell the button sits in — the email body, or
        one column of a row — so there is no px width to state anywhere.

        The `<a>` gets `display:block`, which fills the cell's content box; its
        padding is taken out of that width rather than added to it, so the
        button can't overflow its column. Outlook is the awkward half: VML has
        no percentage `width`, so the roundrect uses `mso-width-percent:1000`
        (tenths of a percent — 1000 is 100%), the Word engine's own way of
        saying the same thing. Alignment is dropped on both sides, because a
        box that fills its cell has nowhere to sit but where it is; the label
        centres instead.
      */
      const full = !!element.fullWidth;
      const vmlWidth = full
        ? 'mso-width-percent:1000;'
        : `width:${element.paddingHorizontal * 2 + 100}px;`;
      const anchorBox = full
        ? 'display:block;'
        : 'display:inline-block;';

      /*
        The block's padding goes on the cell, not on the `<a>` — the anchor's
        padding is the chip's own (`paddingVertical` / `paddingHorizontal`), and
        adding to it would make the button bigger rather than move it. On a
        full-width button the cell padding is also what keeps it off the edges
        of the column, since the anchor fills whatever box it is given.
      */
      const cellStyle = `${bgStyle(element)}${paddingStyle(element)}`.trim();

      /*
        The border draws around the chip, like the radius — the cell behind it
        is the block's background, and a rule there would trace the whole row
        rather than the button.

        Outlook is the awkward half again: VML strokes a shape with one width
        and one colour, so it can only follow a border whose four sides match.
        An uneven one is left to the clients that can draw it, rather than
        guessing which side Outlook should show. `stroke="f"` — no border at
        all — is what this block has always emitted.
      */
      const b = blockBorder(element);
      const evenBorder =
        b.top === b.right && b.right === b.bottom && b.bottom === b.left
          ? b.top
          : 0;
      const vmlStroke =
        evenBorder > 0
          ? `strokecolor="${b.color}" strokeweight="${evenBorder}px"`
          : 'stroke="f"';

      return `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="${tableMargin(element)}">
  <tr>
    <td align="${full ? 'center' : element.alignment}"${bgAttr(element)}${
      cellStyle ? ` style="${cellStyle}"` : ''
    }>
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${element.url}" style="height:${element.paddingVertical * 2 + element.fontSize}px;v-text-anchor:middle;${vmlWidth}" arcsize="${element.borderRadius * 2}%" ${vmlStroke} fillcolor="${element.bgColor}">
        <w:anchorlock/>
        <center style="color:${element.textColor};font-family:${fontFamily};font-size:${element.fontSize}px;font-weight:${element.fontWeight};">${element.text}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${element.url}" target="_blank" style="background-color:${element.bgColor}; color:${element.textColor}; font-size:${element.fontSize}px; font-weight:${element.fontWeight}; text-decoration:none; padding:${element.paddingVertical}px ${element.paddingHorizontal}px; border-radius:${element.borderRadius}px;${borderStyle(element)} ${anchorBox} font-family:${fontFamily}; text-align:center;">
        ${editableField(element.text, 'text', opts)}
      </a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`;
    }

    case 'section': {
      const children = (element.childElements || []).map((child) =>
        renderElementToHtml(child, settings, opts)
      );

      const hasBorder =
        element.borderTopWidth > 0 ||
        element.borderRightWidth > 0 ||
        element.borderBottomWidth > 0 ||
        element.borderLeftWidth > 0;
      const hasPadding =
        element.paddingTop > 0 ||
        element.paddingRight > 0 ||
        element.paddingBottom > 0 ||
        element.paddingLeft > 0;
      // Vertical only: a horizontal margin is a wrapper cell `applyOuterMargin`
      // adds outside all this, so it doesn't need the section's own table.
      const hasSpacing = element.marginTop > 0 || element.marginBottom > 0;
      const hasFill = !!element.bgColor && element.bgColor !== 'transparent';
      // Alignment is the one non-box thing a section can carry, and it lives on
      // the `<td>` — so a section that only aligns still needs its table.
      const hasAlign = !!element.textAlign;

      /*
        A section that draws nothing emits nothing of its own — just its
        children. Email HTML is size-constrained (Gmail clips at ~102KB), so a
        wrapper table with no borders, padding, margin or fill is pure weight.

        This is also what makes wrapping legacy top-level blocks in a bare
        section (see `migrateToSections`) safe: the structure the editor sees
        changes, the exported email does not. The blank-line join matches how
        `generateEmailHtml` joins top-level blocks, so the wrap is byte-neutral
        rather than merely render-neutral.
      */
      if (!hasBorder && !hasPadding && !hasSpacing && !hasFill && !hasAlign) {
        return children.join('\n\n');
      }

      const childrenHtml = children.join('\n');

      const borders = borderStyle(element).trim();

      const hasBg = hasFill;

      const cellStyle = [
        `padding:${element.paddingTop}px ${element.paddingRight}px ${element.paddingBottom}px ${element.paddingLeft}px;`,
        borders,
        hasBg ? `background-color:${element.bgColor};` : '',
        radiusStyle(element).trim(),
        alignStyle(element.textAlign).trim(),
      ]
        .filter(Boolean)
        .join(' ');

      // An empty section would collapse in some clients — a zero-height spacer
      // keeps its padding and borders visible.
      const body = childrenHtml.trim()
        ? childrenHtml
        : '<div style="font-size:1px; line-height:1px;">&nbsp;</div>';

      return `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="${tableMargin(element)}">
  <tr>
    <td${hasBg ? ` bgcolor="${element.bgColor}"` : ''} style="${cellStyle}">
${body}
    </td>
  </tr>
</table>`;
    }

    case 'row':
      return renderRow(element, settings, opts);

    case 'column': {
      /*
        Just its blocks. The cell that gives a column its width, padding and
        fill is built by `columnCell` as part of the row, because those have to
        land on a `<td>` — so a column emits nothing of its own, exactly like a
        bare section. Rendering one on its own (the Code tab) therefore shows
        what it holds rather than a stray `<td>`.
      */
      return (element.childElements || [])
        .map((child) => renderElementToHtml(child, settings, opts))
        .join('\n');
    }

    case 'divider': {
      const rule = `border-top:${element.height}px ${element.style} ${element.color};`;
      const padding = paddingStyle(element);

      /*
        Unpadded and unbordered, the rule is the cell's own top border — the
        bytes this block has always emitted. Otherwise it moves to a `<div>`
        inside the cell, for two reasons: a border sits *outside* padding, so
        leaving it on the `<td>` would put the line above the space rather than
        inside it and left/right padding wouldn't shorten it — the one thing a
        padded divider is for — and a block border of its own would be a second
        `border-top` on the same cell, where only one of them can win.
      */
      const box = borderStyle(element);
      const body =
        padding || box
          ? `<div style="${rule} font-size:1px; line-height:1px;">&nbsp;</div>`
          : '';

      return `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="${tableMargin(element)}">
  <tr>
    <td${bgAttr(element)} style="${`${
      body ? padding.trim() : `${rule} font-size:1px; line-height:1px;`
    }${bgStyle(element)}${box}${radiusStyle(element)}`.trim()}">${
      body || '&nbsp;'
    }</td>
  </tr>
</table>`;
    }

    case 'spacer': {
      /*
        `height` is stated three ways on purpose. Outlook's Word engine reads
        the attribute, most clients read the style, and `line-height` plus a 1px
        `font-size` is what stops the `&nbsp;` — which is there because an empty
        cell collapses — from forcing the row taller than asked.

        Padding on a spacer adds to that height rather than fitting inside it —
        a cell's stated height is its content box. Left and right padding is the
        useful half: it insets a coloured band without changing how tall it is.
      */
      const h = Math.max(1, element.height);
      return `<table width="100%" border="0" cellspacing="0" cellpadding="0">
  <tr>
    <td height="${h}"${bgAttr(element)} style="height:${h}px; line-height:${h}px; font-size:1px; mso-line-height-rule:exactly;${bgStyle(element)}${paddingStyle(element)}${borderStyle(element)}${radiusStyle(element)}">&nbsp;</td>
  </tr>
</table>`;
    }

    case 'quote': {
      const weight = element.fontWeight ?? 'normal';
      const style = element.fontStyle ?? 'italic';
      const quote = wrapEmphasis(
        `"${editableField(element.quote, 'quote', opts)}"`,
        weight === 'bold',
        style === 'italic'
      );

      // Every side absent is the 4px left rule this block hard-coded before
      // the sides were configurable — `blockBorder` is where that lives.
      const borders = borderStyle(element).trim();

      /*
        Assembled from parts rather than one template literal so the border
        segment can drop out entirely when every side is 0 — a hard-coded slot
        would leave a double space, and the whole point of building this way is
        that a left-only quote still emits the exact bytes it always did.
      */
      const blockquoteStyle = [
        // One entry rather than two: with no horizontal margin `tagMargin`
        // returns exactly the pair that used to sit here, and the parts are
        // joined with the same single space.
        tagMargin(element),
        // All four sides absent means the 16/20 this block hard-coded before
        // padding was configurable — `blockPadding` is where that lives, and
        // the two-value shorthand is the byte it has always emitted.
        paddingShorthand(blockPadding(element)),
        `background-color:${element.bgColor};`,
        borders,
        `color:${element.textColor};`,
        `font-size:${element.fontSize}px;`,
        `font-weight:${weight};`,
        `font-style:${style};`,
        `font-family:${fontFamily};`,
        // Absent is the 4px this block hard-coded before the control existed —
        // `blockRadius` is where that lives. A deliberate 0 drops out here,
        // which is the one way to square a quote off.
        radiusStyle(element).trim(),
        alignStyle(element.textAlign).trim(),
      ]
        .filter(Boolean)
        .join(' ');

      return `<blockquote style="${blockquoteStyle}">
  ${quote}
  ${element.author ? `<footer style="font-style:normal; font-size:14px; margin-top:8px; font-weight:bold; color:${element.textColor};">— ${editableField(element.author, 'author', opts)}</footer>` : ''}
</blockquote>`;
    }

    case 'custom-html': {
      /*
        The one block whose fill and padding need a wrapper: there is no markup
        of ours to put them on, and reaching into the author's HTML to style its
        first tag would be editing what they wrote. A `<td>` rather than a
        `<div>` for the usual reason — it's the box Outlook's Word engine fills
        and pads reliably.

        Neither set means no wrapper at all, so a Custom HTML block still
        exports exactly what its author pasted.
      */
      const boxStyle = `${bgStyle(element)}${paddingStyle(element)}${borderStyle(
        element
      )}${radiusStyle(element)}`.trim();
      if (!boxStyle) return element.html;

      return `<table width="100%" border="0" cellspacing="0" cellpadding="0">
  <tr>
    <td${bgAttr(element)} style="${boxStyle}">
${element.html}
    </td>
  </tr>
</table>`;
    }

    default:
      return '';
  }
}

/**
 * True if any block anywhere in the tree is hidden on one device.
 *
 * The visibility rules are only written into `<head>` when something uses them.
 * That is ~300 bytes against Gmail's ~102KB clipping threshold — not much, but
 * it keeps the export of a newsletter that doesn't use the feature identical to
 * what it was before the feature existed, which is the property that makes
 * "did my change alter the email?" answerable with `diff`.
 */
function usesVisibility(elements: EmailElement[]): boolean {
  return elements.some(
    (el) =>
      el.visibility?.desktop === false ||
      el.visibility?.mobile === false ||
      (isContainerElement(el) && usesVisibility(el.childElements || []))
  );
}

/**
 * True if any row anywhere in the tree asks to stack on mobile.
 *
 * Same bargain as `usesVisibility`: the stacking rules are only written into
 * `<head>` when something needs them, so a newsletter without columns exports
 * exactly the bytes it did before rows existed.
 */
function usesStackedColumns(elements: EmailElement[]): boolean {
  return elements.some(
    (el) =>
      (el.type === 'row' &&
        el.stackOnMobile !== false &&
        (el.childElements || []).length > 1) ||
      (isContainerElement(el) && usesStackedColumns(el.childElements || []))
  );
}

export function generateEmailHtml(template: NewsletterTemplate): string {
  const { settings, elements } = template;
  const fontFamily = cssFontFamily(settings.fontFamily);

  const elementsHtml = elements
    .map((el) => renderElementToHtml(el, settings))
    .join('\n\n');

  /*
    `display:block` on a `<td>` is the long-standing way to stack columns on a
    phone. It needs the width overridden too, or the cell keeps the percentage
    it was given and the "stacked" columns come out narrow.
  */
  const columnCss = usesStackedColumns(elements)
    ? `
      .${ROW_STACK_CLASS} .${COLUMN_CLASS} { display: block !important; width: 100% !important; max-width: 100% !important; }
      .${ROW_STACK_CLASS} .${COLUMN_GAP_CLASS} { display: block !important; width: 100% !important; }`
    : '';

  const visibilityCss = usesVisibility(elements)
    ? `
      .${HIDE_ON_MOBILE_CLASS} { display: none !important; max-height: 0 !important; overflow: hidden !important; mso-hide: all; }
      .${HIDE_ON_DESKTOP_CLASS} { display: block !important; max-height: none !important; overflow: visible !important; }`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${template.name}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: ${settings.bgColor}; font-family: ${fontFamily}; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .responsive-td { padding: 15px !important; }${columnCss}${visibilityCss}
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${settings.bgColor}; font-family: ${fontFamily};">
  <center style="width: 100%; background-color: ${settings.bgColor}; padding-top: 20px; padding-bottom: 40px;">
    <!--[if mso]>
    <table align="center" border="0" cellspacing="0" cellpadding="0" width="${settings.width}">
    <tr>
    <td align="center" valign="top" width="${settings.width}">
    <![endif]-->
    <table class="email-container" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto; width: ${settings.width}px; max-width: ${settings.width}px; background-color: ${settings.cardBgColor}; color: ${settings.textColor}; font-family: ${fontFamily}; font-size: 16px;">
      <tbody>
        <tr>
          <td class="responsive-td" style="padding: ${settings.padding}px;">
${elementsHtml}
          </td>
        </tr>
      </tbody>
    </table>
    <!--[if mso]>
    </td>
    </tr>
    </table>
    <![endif]-->
  </center>
</body>
</html>`;
}
