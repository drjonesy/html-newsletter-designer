export type ElementType =
  | 'image'
  | 'heading'
  | 'section'
  | 'key-value'
  | 'paragraph'
  | 'button'
  | 'divider'
  | 'quote'
  | 'custom-html';

export interface BaseElement {
  id: string;
  type: ElementType;
  label?: string;
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

export interface HeadingElement extends BaseElement {
  type: 'heading';
  text: string;
  level: HeadingLevel;
  color: string;
  fontSize: number;
  /** Optional — defaults to 'bold' for headings when absent (older saved templates). */
  fontWeight?: 'normal' | 'bold';
  /** Optional — defaults to 'normal' when absent (older saved templates). */
  fontStyle?: 'normal' | 'italic';
  transform: 'uppercase' | 'capitalize' | 'none';
  letterSpacing: string;
  marginTop: number;
  marginBottom: number;
}

export interface KeyValueElement extends BaseElement {
  type: 'key-value';
  label: string;
  value: string;
  labelColor: string;
  valueColor: string;
  fontSize: number;
  boldLabel: boolean;
  /** Optional — default false when absent (older saved templates). */
  italicLabel?: boolean;
  boldValue?: boolean;
  italicValue?: boolean;
  marginTop: number;
  marginBottom: number;
}

export interface ParagraphElement extends BaseElement {
  type: 'paragraph';
  content: string; // HTML allowed (<b>, <span>, <font>, <a>)
  color: string;
  fontSize: number;
  /** Optional — applies to the whole block; inline <b>/<em> in `content` still work. */
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  lineHeight: number;
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

export interface DividerElement extends BaseElement {
  type: 'divider';
  color: string;
  height: number;
  style: 'solid' | 'dashed' | 'dotted';
  marginTop: number;
  marginBottom: number;
}

export interface QuoteElement extends BaseElement {
  type: 'quote';
  quote: string;
  author?: string;
  bgColor: string;
  borderColor: string;
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
  | KeyValueElement
  | ParagraphElement
  | ButtonElement
  | SectionElement
  | DividerElement
  | QuoteElement
  | CustomHtmlElement;

/**
 * The block types that hold `childElements`. Anything that walks the element
 * tree must recurse through these — use `isContainerElement` from
 * `utils/elementHelpers` rather than testing `type` by hand, so adding another
 * container later doesn't mean re-auditing every traversal.
 */
export type ContainerElement = SectionElement;

export interface EmailSettings {
  width: number; // default 600
  bgColor: string; // container outer
  cardBgColor: string; // inner card
  fontFamily: string;
  textColor: string;
  accentColor: string;
  padding: number;
}

export interface NewsletterTemplate {
  id: string;
  name: string;
  settings: EmailSettings;
  elements: EmailElement[];
}
