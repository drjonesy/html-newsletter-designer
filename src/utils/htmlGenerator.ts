import {
  EmailElement,
  EmailSettings,
  NewsletterTemplate,
  QuoteElement,
  RowElement,
} from '../types';
import { resolveTextStyle } from './typography';
import { cssFontFamily } from './richText';
import { evenWidths, isContainerElement } from './elementHelpers';

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

  const style = [
    `width:${pct(width)}%;`,
    `vertical-align:${valign};`,
    column
      ? `padding:${column.paddingTop}px ${column.paddingRight}px ${column.paddingBottom}px ${column.paddingLeft}px;`
      : '',
    bg ? `background-color:${bg};` : '',
  ]
    .filter(Boolean)
    .join(' ');

  // An empty cell collapses in some clients, taking the row's other columns
  // out of alignment with it.
  const body =
    renderElementToHtml(child, settings, opts).trim() ||
    '<div style="font-size:1px; line-height:1px;">&nbsp;</div>';

  return `    <td class="${COLUMN_CLASS}" width="${pct(width)}%" valign="${valign}"${
    bg ? ` bgcolor="${bg}"` : ''
  } style="${style}">
${body}
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
 */
function columnGapCell(gap: number): string {
  return `    <td class="${COLUMN_GAP_CLASS}" width="${gap}" style="width:${gap}px; font-size:0; line-height:0;"><div style="height:${gap}px; line-height:${gap}px; font-size:1px;">&nbsp;</div></td>`;
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

  return `<table${stack} width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top:${element.marginTop}px; margin-bottom:${element.marginBottom}px;">
  <tr>
${cells.join('\n')}
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

/**
 * A quote's border widths, honouring the legacy default.
 *
 * Every side absent means the block predates configurable sides, and had a 4px
 * left rule baked into the generator. Reading that as "no border" would quietly
 * strip the accent bar off every quote in every saved newsletter.
 */
function quoteBorderWidths(element: QuoteElement): SideWidths {
  const unset =
    element.borderTopWidth === undefined &&
    element.borderRightWidth === undefined &&
    element.borderBottomWidth === undefined &&
    element.borderLeftWidth === undefined;

  if (unset) return { top: 0, right: 0, bottom: 0, left: 4 };

  return {
    top: element.borderTopWidth ?? 0,
    right: element.borderRightWidth ?? 0,
    bottom: element.borderBottomWidth ?? 0,
    left: element.borderLeftWidth ?? 0,
  };
}

export function renderElementToHtml(
  element: EmailElement,
  settings: EmailSettings,
  opts?: RenderOptions
): string {
  const html = renderElementBody(element, settings, opts);
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
      const img = `<img src="${element.src}" alt="${element.alt}" width="${element.width}" ${element.height ? `height="${element.height}"` : ''} style="max-width:100%; height:auto; display:inline-block; border:0;" />`;
      const wrappedImg = element.href
        ? `<a href="${element.href}" target="_blank" style="text-decoration:none;">${img}</a>`
        : img;
      return `<table width="100%" border="0" cellspacing="0" cellpadding="0">
  <tr>
    <td align="${element.alignment}" style="padding-top:${element.paddingTop}px; padding-bottom:${element.paddingBottom}px;">
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
      return `<${Tag} style="font-size:${t.fontSize}px; color:${t.color}; margin-top:${element.marginTop}px; margin-bottom:${element.marginBottom}px; text-transform:${t.transform}; letter-spacing:${t.letterSpacing}; font-family:${fontFamily}; font-weight:${t.fontWeight}; font-style:${t.fontStyle}; line-height:${t.lineHeight};">${text}</${Tag}>`;
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
      return `<div style="font-size:${t.fontSize}px; line-height:${t.lineHeight}; color:${t.color}; margin-top:${element.marginTop}px; margin-bottom:${element.marginBottom}px; font-family:${fontFamily}; font-weight:${weight}; font-style:${style};">
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
        `padding-left` rather than `margin-left`: Outlook's Word engine indents
        lists with padding and ignores the margin, so stating both would double
        the indent there.
      */
      return `<${Tag} style="margin:${element.marginTop}px 0 ${element.marginBottom}px 0; padding:0 0 0 ${element.indent}px; color:${t.color}; font-size:${t.fontSize}px; line-height:${t.lineHeight}; font-family:${fontFamily}; font-weight:${weight}; font-style:${style}; list-style-type:${element.marker};">
${rows}
</${Tag}>`;
    }

    case 'button': {
      return `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top:${element.marginTop}px; margin-bottom:${element.marginBottom}px;">
  <tr>
    <td align="${element.alignment}">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${element.url}" style="height:${element.paddingVertical * 2 + element.fontSize}px;v-text-anchor:middle;width:${element.paddingHorizontal * 2 + 100}px;" arcsize="${element.borderRadius * 2}%" stroke="f" fillcolor="${element.bgColor}">
        <w:anchorlock/>
        <center style="color:${element.textColor};font-family:${fontFamily};font-size:${element.fontSize}px;font-weight:${element.fontWeight};">${element.text}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${element.url}" target="_blank" style="background-color:${element.bgColor}; color:${element.textColor}; font-size:${element.fontSize}px; font-weight:${element.fontWeight}; text-decoration:none; padding:${element.paddingVertical}px ${element.paddingHorizontal}px; border-radius:${element.borderRadius}px; display:inline-block; font-family:${fontFamily}; text-align:center;">
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
      const hasSpacing = element.marginTop > 0 || element.marginBottom > 0;
      const hasFill = !!element.bgColor && element.bgColor !== 'transparent';

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
      if (!hasBorder && !hasPadding && !hasSpacing && !hasFill) {
        return children.join('\n\n');
      }

      const childrenHtml = children.join('\n');

      const borders = sideBorders(
        {
          top: element.borderTopWidth,
          right: element.borderRightWidth,
          bottom: element.borderBottomWidth,
          left: element.borderLeftWidth,
        },
        element.borderStyle,
        element.borderColor
      );

      const hasBg = hasFill;

      const cellStyle = [
        `padding:${element.paddingTop}px ${element.paddingRight}px ${element.paddingBottom}px ${element.paddingLeft}px;`,
        borders,
        hasBg ? `background-color:${element.bgColor};` : '',
        element.borderRadius > 0 ? `border-radius:${element.borderRadius}px;` : '',
      ]
        .filter(Boolean)
        .join(' ');

      // An empty section would collapse in some clients — a zero-height spacer
      // keeps its padding and borders visible.
      const body = childrenHtml.trim()
        ? childrenHtml
        : '<div style="font-size:1px; line-height:1px;">&nbsp;</div>';

      return `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top:${element.marginTop}px; margin-bottom:${element.marginBottom}px;">
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
      return `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top:${element.marginTop}px; margin-bottom:${element.marginBottom}px;">
  <tr>
    <td style="border-top:${element.height}px ${element.style} ${element.color}; font-size:1px; line-height:1px;">&nbsp;</td>
  </tr>
</table>`;
    }

    case 'spacer': {
      /*
        `height` is stated three ways on purpose. Outlook's Word engine reads
        the attribute, most clients read the style, and `line-height` plus a 1px
        `font-size` is what stops the `&nbsp;` — which is there because an empty
        cell collapses — from forcing the row taller than asked.
      */
      const h = Math.max(1, element.height);
      return `<table width="100%" border="0" cellspacing="0" cellpadding="0">
  <tr>
    <td height="${h}" style="height:${h}px; line-height:${h}px; font-size:1px; mso-line-height-rule:exactly;">&nbsp;</td>
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

      const borders = sideBorders(
        quoteBorderWidths(element),
        element.borderStyle ?? 'solid',
        element.borderColor
      );

      /*
        Assembled from parts rather than one template literal so the border
        segment can drop out entirely when every side is 0 — a hard-coded slot
        would leave a double space, and the whole point of building this way is
        that a left-only quote still emits the exact bytes it always did.
      */
      const blockquoteStyle = [
        `margin-top:${element.marginTop}px;`,
        `margin-bottom:${element.marginBottom}px;`,
        `padding:16px 20px;`,
        `background-color:${element.bgColor};`,
        borders,
        `color:${element.textColor};`,
        `font-size:${element.fontSize}px;`,
        `font-weight:${weight};`,
        `font-style:${style};`,
        `font-family:${fontFamily};`,
        `border-radius:4px;`,
      ]
        .filter(Boolean)
        .join(' ');

      return `<blockquote style="${blockquoteStyle}">
  ${quote}
  ${element.author ? `<footer style="font-style:normal; font-size:14px; margin-top:8px; font-weight:bold; color:${element.textColor};">— ${editableField(element.author, 'author', opts)}</footer>` : ''}
</blockquote>`;
    }

    case 'custom-html': {
      return element.html;
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
