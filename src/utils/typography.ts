import {
  EmailSettings,
  HeadingElement,
  HeadingLevel,
  ListElement,
  ParagraphElement,
  TypographyKey,
  TypographyStyle,
} from '../types';

export const HEADING_LEVELS: HeadingLevel[] = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
];

/** Everything the Theme panel offers a control for, in the order it shows them. */
export const TYPOGRAPHY_KEYS: TypographyKey[] = [...HEADING_LEVELS, 'paragraph'];

export const TYPOGRAPHY_LABELS: Record<TypographyKey, string> = {
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  h4: 'Heading 4',
  h5: 'Heading 5',
  h6: 'Heading 6',
  paragraph: 'Body text',
};

/**
 * The built-in type scale — what a project gets before anyone touches Theme.
 *
 * Sized for a 600px email rather than a web page: the steps are closer together
 * than Tailwind's or Material's display scale, because a 48px H1 in a column
 * this narrow wraps after three words. H1 is the largest, H6 the smallest, and
 * H5/H6 land at or below body size — which is the point of them, they're labels
 * rather than headlines.
 *
 * **Heading line-height is 1.2 across the board on purpose.** That was
 * hard-coded in the generator before the theme existed, so keeping it means a
 * heading saved by an older build renders to the identical byte. It's also a
 * sensible tight leading for display text; change it per level in Theme.
 */
export const DEFAULT_TYPOGRAPHY: Record<TypographyKey, TypographyStyle> = {
  h1: heading(32),
  h2: heading(26),
  h3: heading(22),
  h4: heading(18),
  h5: heading(16),
  h6: heading(14),
  paragraph: {
    fontSize: 16,
    fontWeight: 'normal',
    fontStyle: 'normal',
    lineHeight: 1.6,
    letterSpacing: '0px',
    transform: 'none',
    color: '#374151',
  },
};

function heading(fontSize: number): TypographyStyle {
  return {
    fontSize,
    fontWeight: 'bold',
    fontStyle: 'normal',
    lineHeight: 1.2,
    letterSpacing: '0px',
    transform: 'none',
    color: '#111827',
  };
}

/**
 * The theme's style for one scale entry, with the built-in defaults filled in
 * behind whatever the project has set.
 */
export function typographyFor(
  settings: EmailSettings,
  key: TypographyKey
): TypographyStyle {
  return { ...DEFAULT_TYPOGRAPHY[key], ...(settings.typography?.[key] ?? {}) };
}

/** Which scale entry a block reads. Lists follow body copy. */
export function typographyKeyFor(
  element: HeadingElement | ParagraphElement | ListElement
): TypographyKey {
  return element.type === 'heading' ? element.level : 'paragraph';
}

/**
 * A block's effective text style: the theme's entry, with the block's own
 * fields laid over the top.
 *
 * The **only** place these fields should be read. Reading `element.fontSize`
 * directly gets `undefined` for a block that inherits, which renders as
 * `font-size:undefinedpx` — the reason they're all optional is that absent
 * carries meaning.
 */
export function resolveTextStyle(
  element: HeadingElement | ParagraphElement | ListElement,
  settings: EmailSettings
): TypographyStyle {
  const base = typographyFor(settings, typographyKeyFor(element));
  const own = element as Partial<TypographyStyle>;

  return {
    fontSize: own.fontSize ?? base.fontSize,
    fontWeight: own.fontWeight ?? base.fontWeight,
    fontStyle: own.fontStyle ?? base.fontStyle,
    lineHeight: own.lineHeight ?? base.lineHeight,
    letterSpacing: own.letterSpacing ?? base.letterSpacing,
    transform: own.transform ?? base.transform,
    color: own.color ?? base.color,
  };
}

/** Which of a block's typographic fields are set rather than inherited. */
export function overriddenFields(
  element: HeadingElement | ParagraphElement | ListElement
): (keyof TypographyStyle)[] {
  const own = element as Partial<TypographyStyle>;
  return (
    [
      'fontSize',
      'fontWeight',
      'fontStyle',
      'lineHeight',
      'letterSpacing',
      'transform',
      'color',
    ] as (keyof TypographyStyle)[]
  ).filter((field) => own[field] !== undefined);
}

/**
 * Strips every typographic override off a block, handing it back to the theme.
 *
 * Explicit `undefined` rather than `delete`, so the result is still a plain
 * spread of the original — `JSON.stringify` drops the keys on the way to
 * `localStorage` and to a project file.
 */
export function clearTextOverrides<
  T extends HeadingElement | ParagraphElement | ListElement,
>(element: T): T {
  return {
    ...element,
    fontSize: undefined,
    fontWeight: undefined,
    fontStyle: undefined,
    lineHeight: undefined,
    letterSpacing: undefined,
    transform: undefined,
    color: undefined,
  };
}
