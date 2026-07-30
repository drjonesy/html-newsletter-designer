export type ElementType =
  | 'header-image'
  | 'heading'
  | 'accent-section'
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

export interface HeaderImageElement extends BaseElement {
  type: 'header-image';
  src: string;
  alt: string;
  width: number | string;
  height?: number | string;
  href?: string;
  alignment: 'left' | 'center' | 'right';
  paddingTop: number;
  paddingBottom: number;
}

export interface HeadingElement extends BaseElement {
  type: 'heading';
  text: string;
  level: 'h1' | 'h2' | 'h3';
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

export interface AccentSectionElement extends BaseElement {
  type: 'accent-section';
  borderColor: string;
  borderWidth: number;
  paddingLeft: number;
  marginBottom: number;
  // Accent section wraps sub-elements or has title + items
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
  | HeaderImageElement
  | HeadingElement
  | KeyValueElement
  | ParagraphElement
  | ButtonElement
  | AccentSectionElement
  | DividerElement
  | QuoteElement
  | CustomHtmlElement;

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
