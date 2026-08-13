export type ElementType =
  | 'image'
  | 'heading'
  | 'section'
  | 'row'
  | 'column'
  | 'paragraph'
  | 'list'
  | 'button'
  | 'divider'
  | 'spacer'
  | 'quote'
  | 'custom-html';

/**
 * Which devices a block is shown on.
 *
 * Absent — or either side absent — means shown, so a block with no `visibility`
 * at all emits exactly the HTML it did before this field existed. Hiding is
 * driven by `<head>` media queries, which a few clients strip (notably the Gmail
 * app signed in to a non-Gmail account); a hidden block will show there.
 */
export interface BlockVisibility {
  /** Screens wider than the 600px breakpoint. */
  desktop?: boolean;
  mobile?: boolean;
}

/**
 * Horizontal alignment of a block's contents.
 *
 * **Absent means inherit** — from the container around it, or from the client's
 * own default (left) when nothing above sets one. It is deliberately not
 * "left": a block inside a centred section should follow that section until its
 * author says otherwise, and a block that has never been aligned must emit no
 * `text-align` at all so an existing newsletter exports the bytes it always did.
 *
 * `left` is therefore a real value, distinct from absent — it's how you opt one
 * block out of a centred container.
 *
 * Not part of the theme cascade. Alignment is layout, in the same category as
 * the margins that `TypographyStyle` also leaves to the block.
 */
export type TextAlign = 'left' | 'center' | 'right';

export interface BaseElement {
  id: string;
  type: ElementType;
  /**
   * The block's name. User-facing: it titles the Inspector, labels a section on
   * the canvas, and names the rows of the Sections outline.
   */
  label?: string;
  /** Optional — absent means shown everywhere. */
  visibility?: BlockVisibility;
  /**
   * A fill painted behind the whole block.
   *
   * **Optional, and absent means none** — a block that has never been given one
   * emits exactly the bytes it did before this field existed, the same bargain
   * `visibility`, `textAlign` and column stacking strike. `'transparent'` means
   * the same thing as absent, since that's what `ColorField` clears to.
   *
   * `section`, `column` and `quote` are *not* read through this: each already
   * has a required `bgColor`, the fill of the box it has always drawn, and a
   * second field behind the first is how the two drift. `blockBackground` /
   * `withBlockBackground` in `utils/elementHelpers` are the one place that
   * routes a block to whichever of the two it uses, so the Inspector shows a
   * single Background control on every type.
   */
  backgroundColor?: string;
  /**
   * Space between the block's edge and its contents, per side.
   *
   * **Optional, and absent means none** — the same bargain `backgroundColor`,
   * `visibility`, `textAlign` and column stacking strike, so a block that has
   * never been padded exports exactly the bytes it did before these fields
   * existed.
   *
   * They live on `BaseElement` so there is **one set of names** rather than a
   * general `padding` sitting behind the four fields `section`, `column` and
   * `image` already had — that duplication is how two controls end up behind
   * one box. Those three narrow the sides they require to `number`; `quote`
   * leaves all four optional but reads absent as the 16/20 it used to hard-code
   * (see below). `blockPadding` / `withBlockPadding` in `utils/elementHelpers`
   * are the one statement of all that, so the Inspector offers a single Padding
   * control on every type without knowing which arm it is editing.
   *
   * Not to be confused with a button's `paddingVertical` / `paddingHorizontal`,
   * which inflate the chip itself; these four are the space around it.
   */
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  /**
   * Space *outside* the block, per side.
   *
   * **Optional, and absent means none** — the same bargain the padding sides
   * strike, so a block that has never been given a margin exports exactly the
   * bytes it did before these fields existed.
   *
   * They are the *same names* the eight types that have always had a vertical
   * margin use, rather than a second set behind them: those types narrow
   * `marginTop` / `marginBottom` to `number` and keep writing them out even at
   * 0, while `marginLeft` / `marginRight` are the general optional pair.
   * `blockMargin` / `withBlockMargin` in `utils/elementHelpers` are the one
   * statement of that, so the Inspector offers a single Margin control on every
   * type without knowing which arm it is editing.
   *
   * Where they land depends on the block's own box, because a `<table>` or a
   * `<td>` has no margin to give — a horizontal one on a full-width table
   * overflows whatever holds it, and a cell ignores margins outright. A
   * heading, paragraph, list and quote take all four on their own tag; every
   * other type takes them as padding on a cell outside its box, which
   * `applyOuterMargin` adds — or, for a `column`, which the cell its row
   * already builds carries (`columnCell`).
   */
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  /**
   * A border, per side, plus the one style and colour all four share.
   *
   * **Optional, and absent means none** — the same bargain `backgroundColor`
   * and the padding sides strike, so a block that has never been given a border
   * exports the bytes it always did. A side is switched on by a non-zero width;
   * `borderStyle` absent is `'solid'` and `borderColor` absent is
   * `DEFAULT_BORDER_COLOR`, so neither has to be set before a width means
   * something.
   *
   * They live on `BaseElement` for the same reason the padding sides do: they
   * are the *same names* `section`, `column` and `quote` already used, rather
   * than a second set behind them. The first two narrow all six to required;
   * `quote` keeps the widths optional and reads all four absent as the 4px left
   * rule it used to hard-code (see below). `blockBorder` / `withBlockBorder` in
   * `utils/elementHelpers` are the one statement of that, so the Inspector
   * offers a single Border control on every type.
   *
   * On a `button` the border draws around the chip, like its radius — and only
   * Outlook's VML fallback constrains it, which can stroke one width for all
   * four sides but not four different ones.
   */
  borderTopWidth?: number;
  borderRightWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  borderColor?: string;
  /**
   * How far the block's corners are rounded, in px.
   *
   * **Optional, and absent means square** — same bargain as `backgroundColor`
   * and the padding sides, so a block that has never been rounded exports the
   * bytes it always did. `0` says the same thing and emits nothing either.
   *
   * It is the *same name* the four types that already rounded themselves use —
   * `section` and `column` on their `<td>`, `button` on the chip, `quote` with
   * the 4px it used to hard-code — rather than a second field sitting behind
   * theirs, which is how one control becomes two. The first three narrow it to
   * `number`; `quote` leaves it optional and reads absent as 4 (see below).
   * `blockRadius` / `withBlockRadius` in `utils/elementHelpers` are the one
   * statement of that, so the Inspector offers a single Rounded-corners control
   * on every type without knowing which arm it is editing.
   *
   * On a `button` it rounds the chip, not the cell behind it — the same split
   * `bgColor` makes, and what someone asking to round a button means.
   *
   * Rounding is CSS-only: Outlook's Word engine ignores it, and no client clips
   * a block's children to it, so it rounds the block's own fill and border
   * rather than what sits inside.
   */
  borderRadius?: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  alt: string;
  width: number | string;
  height?: number | string;
  href?: string;
  /** Required and always set — an image is placed in a cell that has to align it. */
  alignment: TextAlign;
  /**
   * Required, and always written out even at 0 — `createNewElement` seeds them,
   * so dropping a zero would let the default come back on the next load. The
   * left and right sides are the optional pair inherited from `BaseElement`,
   * and the generator only widens to the four-value shorthand once one of them
   * is set, which keeps an image that predates them exporting the two
   * declarations it always did.
   */
  paddingTop: number;
  paddingBottom: number;
}

/** Every HTML heading tag. Email clients render all six. */
export type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

/**
 * Every typographic field on a text block is optional, and **absent means
 * "inherit from the theme"** — `settings.typography` keyed by heading level, or
 * by `'paragraph'` for body copy.
 *
 * Templates saved before the theme existed have all of these set explicitly, so
 * they keep rendering exactly as they did; only blocks that leave a field out
 * follow the theme. `resolveTextStyle` in `utils/typography.ts` does the
 * merging, and is the only thing that should read these directly.
 */
export interface HeadingElement extends BaseElement {
  type: 'heading';
  text: string;
  level: HeadingLevel;
  color?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  lineHeight?: number;
  transform?: 'uppercase' | 'capitalize' | 'none';
  letterSpacing?: string;
  /** Optional — absent inherits from the container. Not a theme field. */
  textAlign?: TextAlign;
  marginTop: number;
  marginBottom: number;
}

export interface ParagraphElement extends BaseElement {
  type: 'paragraph';
  /**
   * Rich text as HTML: `<strong>`, `<em>`, `<u>`, `<span style>`, `<a>`, `<br>`
   * and `<p>` for paragraph breaks.
   *
   * Written either by hand in the Inspector or by the canvas's WYSIWYG toolbar,
   * which passes everything through `sanitizeRichHtml` first — see
   * `utils/richText.ts` for the tags and style properties that survive.
   */
  content: string;
  /** All optional — absent inherits the theme's `paragraph` style. */
  color?: string;
  fontSize?: number;
  /** Applies to the whole block; inline `<b>`/`<em>` in `content` still work. */
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  lineHeight?: number;
  /** Optional — absent inherits from the container. Not a theme field. */
  textAlign?: TextAlign;
  marginTop: number;
  marginBottom: number;
}

/**
 * `list-style-type` values offered for a list. The first four suit `<ul>`, the
 * rest `<ol>` — nothing stops the other pairing, but the Inspector only offers
 * the ones that match the current `ordered` setting.
 */
export type ListMarker =
  | 'disc'
  | 'circle'
  | 'square'
  | 'none'
  | 'decimal'
  | 'lower-alpha'
  | 'upper-alpha'
  | 'lower-roman'
  | 'upper-roman';

export interface ListElement extends BaseElement {
  type: 'list';
  /** `<ol>` when true, `<ul>` when false. */
  ordered: boolean;
  /** One entry per `<li>`. Each holds rich text, same subset as a paragraph. */
  items: string[];
  marker: ListMarker;
  /**
   * All optional — absent inherits the theme's `paragraph` style. A list is
   * body copy, so it follows the body, not a scale entry of its own.
   */
  color?: string;
  fontSize?: number;
  lineHeight?: number;
  /** Applies to the whole list; inline emphasis in items still works. */
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  /**
   * Optional — absent inherits from the container. Not a theme field.
   *
   * Centring or right-aligning a list also moves its markers inside the text
   * flow, or they'd stay pinned to the left padding edge with the copy floating
   * away from them — see `renderElementBody`.
   */
  textAlign?: TextAlign;
  /** Left padding on the list, i.e. how far the markers sit from the edge. */
  indent: number;
  /** Gap below each item. */
  itemSpacing: number;
  marginTop: number;
  marginBottom: number;
}

export interface ButtonElement extends BaseElement {
  type: 'button';
  text: string;
  url: string;
  bgColor: string;
  textColor: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  /**
   * The chip's own corners — `BaseElement.borderRadius` narrowed to required,
   * since `createNewElement` seeds it and the generator has always written the
   * declaration out. It rounds the button, not the cell behind it.
   */
  borderRadius: number;
  /**
   * The chip's own padding — what makes the button bigger than its label.
   * Distinct from the block padding on `BaseElement`, which is the space
   * between the button and whatever holds it.
   */
  paddingVertical: number;
  paddingHorizontal: number;
  /** Required and always set — a button is placed in a cell that has to align it. */
  alignment: TextAlign;
  /**
   * Stretch the button across whatever holds it — the email body, or one
   * column of a row. Optional, and absent means the default shrink-to-fit
   * button, so a newsletter that has never used it exports the bytes it
   * always did. `alignment` has no effect while this is on.
   */
  fullWidth?: boolean;
  marginTop: number;
  marginBottom: number;
}

/**
 * General-purpose container: a box with independently controlled borders and
 * padding on each side, holding any other blocks.
 *
 * Each side's border is switched on by giving it a non-zero width, so a single
 * type covers a full outline, a single rule under a group of blocks, or a left
 * accent bar. Sides at width 0 emit no `border-*` declaration at all.
 */
export interface SectionElement extends BaseElement {
  type: 'section';
  /** `'transparent'` leaves the email card's own background showing. */
  bgColor: string;
  borderColor: string;
  borderStyle: 'solid' | 'dashed' | 'dotted';
  borderTopWidth: number;
  borderRightWidth: number;
  borderBottomWidth: number;
  borderLeftWidth: number;
  /**
   * `BaseElement.borderRadius` narrowed to required — the box this type has
   * always drawn keeps a field that is always written out. Ignored by Outlook's
   * Word engine; harmless everywhere else.
   */
  borderRadius: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  /**
   * Optional — absent inherits from whatever is around the section.
   *
   * A container's alignment lands on its `<td>` and cascades to every block
   * inside it, so this is "align everything in here"; a child that sets its own
   * `textAlign` still wins. A section that sets it can no longer emit *nothing*
   * of its own, so it builds its wrapper table — see `renderElementBody`.
   */
  textAlign?: TextAlign;
  marginTop: number;
  marginBottom: number;
  childElements: EmailElement[];
}

/**
 * A horizontal band of columns.
 *
 * Holds `ColumnElement`s and nothing else — the blocks go inside the columns.
 * It deliberately draws no frame of its own: fill, border and outer padding
 * belong either to the section around it or to the individual columns, which
 * keeps the exported markup down to a single table.
 */
export interface RowElement extends BaseElement {
  type: 'row';
  /** Always `ColumnElement`s. How many there are *is* the column count. */
  childElements: EmailElement[];
  /**
   * Space between columns, px. Emitted as a spacer cell rather than as padding
   * on the columns, so the gap only ever falls *between* them.
   */
  gap: number;
  /**
   * Stack the columns full-width below the 600px breakpoint.
   *
   * Depends on `<head>` CSS, which a few clients strip — see `BlockVisibility`
   * for the same caveat. Where it's stripped the columns stay side by side,
   * which is narrow but readable rather than broken.
   */
  stackOnMobile: boolean;
  marginTop: number;
  marginBottom: number;
}

/**
 * One cell of a `row`. Only ever a child of one — `canNest` enforces that at
 * every placement path, so nothing has to cope with a loose column.
 */
export interface ColumnElement extends BaseElement {
  type: 'column';
  /** Share of the row's width, as a percentage. Siblings should total 100. */
  width: number;
  verticalAlign: 'top' | 'middle' | 'bottom';
  /** `'transparent'` leaves whatever is behind the row showing. */
  bgColor: string;
  /**
   * Per-side borders, switched on by a non-zero width — the same shape as
   * `SectionElement`, driven by the same Inspector control.
   *
   * A column carries the box styling a section does because a one-column row
   * *is* the general-purpose box: it's what the palette's "1 Column" makes, and
   * what used to be reached by adding a Section.
   */
  borderColor: string;
  borderStyle: 'solid' | 'dashed' | 'dotted';
  borderTopWidth: number;
  borderRightWidth: number;
  borderBottomWidth: number;
  borderLeftWidth: number;
  /**
   * `BaseElement.borderRadius` narrowed to required — the box this type has
   * always drawn keeps a field that is always written out. Ignored by Outlook's
   * Word engine; harmless everywhere else.
   */
  borderRadius: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  /**
   * Optional — absent inherits from the row's surroundings. Cascades to the
   * column's blocks the same way a section's does, and for the same reason a
   * column carries the section's box controls: a one-column row *is* the
   * general-purpose box.
   */
  textAlign?: TextAlign;
  childElements: EmailElement[];
}

export interface DividerElement extends BaseElement {
  type: 'divider';
  color: string;
  height: number;
  style: 'solid' | 'dashed' | 'dotted';
  marginTop: number;
  marginBottom: number;
}

/**
 * A fixed vertical gap.
 *
 * Margins on the blocks around it are the usual way to make space, but they
 * collapse unpredictably across email clients — a spacer is a real table cell
 * with a stated height, which every client honours.
 */
export interface SpacerElement extends BaseElement {
  type: 'spacer';
  height: number;
}

/**
 * A pull quote.
 *
 * Its four padding sides are the optional ones on `BaseElement`, with the same
 * legacy rule its border widths have: **all four absent means the `16px 20px`
 * the generator used to hard-code.** A quote saved before padding was
 * configurable has none of the fields, and reading them as 0 would silently
 * collapse the box onto its text. All four at 0 is a real value, distinct from
 * absent — which is why the Inspector writes every side rather than a patch.
 */
export interface QuoteElement extends BaseElement {
  type: 'quote';
  quote: string;
  author?: string;
  bgColor: string;
  borderColor: string;
  /**
   * Per-side border widths, switched on by a non-zero width — same shape as
   * `SectionElement`, so the same Inspector control drives both.
   *
   * **All four absent means the 4px left rule this block used to hard-code.**
   * A quote saved before the sides were configurable has none of these fields,
   * and defaulting them to 0 would silently delete its accent bar. All four at
   * 0 is a real value — "no border" — and is distinct from absent.
   */
  borderTopWidth?: number;
  borderRightWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  /** Optional — defaults to 'solid' when absent. */
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  textColor: string;
  fontSize: number;
  /** Optional — defaults to 'normal' when absent (older saved templates). */
  fontWeight?: 'normal' | 'bold';
  /** Optional — defaults to 'italic' for quotes when absent (older saved templates). */
  fontStyle?: 'normal' | 'italic';
  /** Optional — absent inherits from the container. */
  textAlign?: TextAlign;
  marginTop: number;
  marginBottom: number;
}

export interface CustomHtmlElement extends BaseElement {
  type: 'custom-html';
  html: string;
  /**
   * Set when this block was produced by saving hand-edited markup in the
   * Inspector's HTML tab. Holds the typed element it replaced so the edit can
   * be reverted. Absent on blocks the user added as Custom HTML outright.
   */
  convertedFrom?: Exclude<EmailElement, CustomHtmlElement>;
}

export type EmailElement =
  | ImageElement
  | HeadingElement
  | ParagraphElement
  | ListElement
  | ButtonElement
  | SectionElement
  | RowElement
  | ColumnElement
  | DividerElement
  | SpacerElement
  | QuoteElement
  | CustomHtmlElement;

/**
 * The block types that hold `childElements`. Anything that walks the element
 * tree must recurse through these — use `isContainerElement` from
 * `utils/elementHelpers` rather than testing `type` by hand, so adding another
 * container later doesn't mean re-auditing every traversal.
 *
 * Which container may hold which block is a separate question from "is this a
 * container", and is answered by `canNest`: a `row` takes only `column`s, and a
 * `column` may sit nowhere else.
 */
export type ContainerElement = SectionElement | RowElement | ColumnElement;

/**
 * One entry in the theme's type scale — everything that decides how a run of
 * text looks, short of the font stack (which is global) and the margins (which
 * are spacing, and belong to the block).
 */
export interface TypographyStyle {
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  lineHeight: number;
  /** A CSS length, e.g. `'0px'` or `'1.5px'`. */
  letterSpacing: string;
  transform: 'none' | 'uppercase' | 'capitalize';
  color: string;
}

/** What a typographic block looks its style up under. */
export type TypographyKey = HeadingLevel | 'paragraph';

/**
 * The theme's type scale.
 *
 * Blocks *inherit* from this: a heading with no `fontSize` of its own renders
 * at whatever the scale says for its level, so changing `h2` here restyles
 * every H2 in the newsletter. A block that sets a field overrides it.
 *
 * Partial and optional so a template saved before the scale existed still
 * loads — anything missing falls back to `DEFAULT_TYPOGRAPHY`.
 */
export type TypographyScale = Partial<
  Record<TypographyKey, Partial<TypographyStyle>>
>;

export interface EmailSettings {
  width: number; // default 600
  bgColor: string; // container outer
  cardBgColor: string; // inner card
  fontFamily: string;
  /** The document's base colour. Per-block colour comes from `typography`. */
  textColor: string;
  accentColor: string;
  padding: number;
  /** Optional — absent means the built-in scale. */
  typography?: TypographyScale;
}

export interface NewsletterTemplate {
  id: string;
  name: string;
  settings: EmailSettings;
  elements: EmailElement[];
}
