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
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  alt: string;
  width: number | string;
  height?: number | string;
  href?: string;
  alignment: 'left' | 'center' | 'right';
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
  borderRadius: number;
  paddingVertical: number;
  paddingHorizontal: number;
  alignment: 'left' | 'center' | 'right';
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
  /** Ignored by Outlook's Word engine; harmless everywhere else. */
  borderRadius: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
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
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
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
