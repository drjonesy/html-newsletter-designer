import {
  ColumnElement,
  ContainerElement,
  EmailElement,
  ElementType,
  HeadingElement,
  HeadingLevel,
  ImageElement,
  ParagraphElement,
  RowElement,
  SectionElement,
} from '../types';
import { sanitizeRichHtml } from './richText';

/** The block types that hold `childElements`. */
export const CONTAINER_TYPES: ElementType[] = ['section', 'row', 'column'];

export function isContainerType(type: ElementType): boolean {
  return CONTAINER_TYPES.includes(type);
}

/**
 * True for blocks that hold `childElements`. Every tree walk (find, update,
 * delete, move, reorder, re-id) goes through this instead of comparing `type`
 * directly, so a new container type only has to be added to `CONTAINER_TYPES`.
 */
export function isContainerElement(el: EmailElement): el is ContainerElement {
  return isContainerType(el.type);
}

/**
 * Whether a block of this type may sit at the top level of the email.
 *
 * Only containers may, and a `column` isn't one of them — a column is a cell of
 * a row and means nothing outside it. Everything else has to live inside a
 * container, which is what keeps the document organised into sections; the rule
 * is enforced when adding from the palette and when dragging on the canvas.
 *
 * Templates saved before the rule existed are brought into line on load by
 * `migrateToSections`, so nothing in the editor has to cope with a loose
 * top-level block.
 */
export function canSitAtTopLevel(type: ElementType): boolean {
  return isContainerType(type) && type !== 'column';
}

/**
 * Whether a block of type `child` may be placed directly inside a `parent`
 * container.
 *
 * "Is this a container" and "may this go in it" are different questions, and
 * columns are why. A `row` is a strip of cells: putting a paragraph straight
 * into one would have nowhere to render, since the generator builds a `<td>`
 * per child column. And a `column` is meaningless anywhere but a row.
 *
 * Every placement path asks this — the palette click, the canvas drag rules,
 * and `reorderElement` as a backstop — so there is one statement of the rule
 * rather than three that can drift.
 */
export function canNest(child: ElementType, parent: ElementType): boolean {
  if (!isContainerType(parent)) return false;
  if (parent === 'row') return child === 'column';
  return child !== 'column';
}

/**
 * A section with no borders, no padding, no margins and no fill.
 *
 * Used to wrap content that wants no visible framing — preset bodies, and the
 * blocks migrated out of pre-section templates. `renderElementToHtml` emits
 * such a section's children directly with no wrapper table, so adding one
 * around existing content leaves the exported email byte-identical.
 */
export function createBareSection(
  id: string,
  childElements: EmailElement[]
): SectionElement {
  return {
    id,
    type: 'section',
    label: 'Section',
    bgColor: 'transparent',
    borderColor: '#cbd5e1',
    borderStyle: 'solid',
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRadius: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    marginTop: 0,
    marginBottom: 0,
    childElements,
  };
}

/** The removed "Red Accent Block". Only ever seen in already-saved templates. */
export const LEGACY_ACCENT_TYPE = 'accent-section';

/**
 * Rewrites a legacy "Red Accent Block" as the equivalent `section`.
 *
 * The block type is gone from the palette, but templates saved while it existed
 * are still in `localStorage` and in project files on disk. Its left rule, left
 * padding and bottom margin all have exact counterparts on `section`, so the
 * author's block survives the removal looking the way they left it.
 *
 * Takes an unvalidated record because both load paths run this on parsed JSON;
 * anything missing falls back to what the old block defaulted to. Child blocks
 * are passed through untouched — the caller recurses.
 */
export function convertLegacyAccentSection(
  raw: Record<string, unknown>
): SectionElement {
  const base = createNewElement('section') as SectionElement;
  const num = (value: unknown, fallback: number) =>
    typeof value === 'number' && isFinite(value) ? value : fallback;
  const str = (value: unknown, fallback: string) =>
    typeof value === 'string' && value ? value : fallback;

  return {
    ...base,
    id: str(raw.id, base.id),
    label: str(raw.label, 'Accent Section'),
    bgColor: 'transparent',
    borderColor: str(raw.borderColor, '#b22222'),
    borderStyle: 'solid',
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: num(raw.borderWidth, 5),
    borderRadius: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: num(raw.paddingLeft, 20),
    marginTop: 0,
    marginBottom: num(raw.marginBottom, 25),
    childElements: Array.isArray(raw.childElements)
      ? (raw.childElements as EmailElement[])
      : [],
  };
}

/** The renamed "Header Logo / Banner". Only ever seen in already-saved templates. */
export const LEGACY_HEADER_IMAGE_TYPE = 'header-image';

/**
 * Rewrites a legacy "Header Logo / Banner" as the generic `image` block.
 *
 * Nothing about the block changed but its name — it was never restricted to the
 * top of the email — so every field carries over untouched and only `type` is
 * rewritten. Anything missing falls back to the current defaults, same as every
 * other load path.
 */
export function convertLegacyHeaderImage(
  raw: Record<string, unknown>
): ImageElement {
  const base = createNewElement('image') as ImageElement;
  const { type: _legacyType, label, ...rest } = raw;

  return {
    ...base,
    ...(rest as Partial<ImageElement>),
    // The old default label named a block type that no longer exists.
    label: typeof label === 'string' && label !== 'Header Banner / Logo' ? label : base.label,
    type: 'image',
  };
}

/** The removed "Label: value" pair block. Only ever seen in saved templates. */
export const LEGACY_KEY_VALUE_TYPE = 'key-value';

/**
 * Rewrites a legacy key-value pair as the equivalent `paragraph`.
 *
 * The block was one line of "**Label** value" with independent colour and
 * emphasis on each half — everything a paragraph's rich `content` already
 * expresses, which is why the type could go. The two halves become inline
 * `<strong>` / `<em>` / `<span style="color:…">` runs separated by a
 * non-breaking space, exactly as the old generator emitted them.
 *
 * Takes an unvalidated record because both load paths run this on parsed JSON.
 * The result goes through `sanitizeRichHtml` for the reason everything else
 * does: whatever the author had in `label`/`value` is untrusted, and `content`
 * is the one field that holds markup.
 */
export function convertLegacyKeyValue(
  raw: Record<string, unknown>
): ParagraphElement {
  const base = createNewElement('paragraph') as ParagraphElement;
  const num = (value: unknown, fallback: number) =>
    typeof value === 'number' && isFinite(value) ? value : fallback;
  const str = (value: unknown, fallback: string) =>
    typeof value === 'string' ? value : fallback;

  // `boldLabel` defaulted to true when absent; every other flag defaulted false.
  const part = (text: string, color: string, bold: boolean, italic: boolean) => {
    let out = bold
      ? `<strong style="color:${color};">${text}</strong>`
      : `<span style="color:${color};">${text}</span>`;
    if (italic) out = `<em>${out}</em>`;
    return out;
  };

  const labelColor = str(raw.labelColor, '#1a2b56');
  const valueColor = str(raw.valueColor, '#1a2b56');

  return {
    ...base,
    id: str(raw.id, base.id),
    type: 'paragraph',
    // The old block put the *label text* in `label`, which is the name field on
    // every other type — so it can't carry over as the block's name.
    label: 'Text',
    content: sanitizeRichHtml(
      [
        part(
          str(raw.label, 'Label:'),
          labelColor,
          raw.boldLabel !== false,
          !!raw.italicLabel
        ),
        part(str(raw.value, ''), valueColor, !!raw.boldValue, !!raw.italicValue),
      ].join('&nbsp;')
    ),
    // The wrapper carries no emphasis of its own — both halves state theirs
    // inline, and doubling up would bold the whole line.
    color: valueColor,
    fontSize: num(raw.fontSize, 16),
    fontWeight: 'normal',
    fontStyle: 'normal',
    lineHeight: 1.6,
    marginTop: num(raw.marginTop, 8),
    marginBottom: num(raw.marginBottom, 12),
  };
}

/** Converts every legacy block in a tree, at any depth. Idempotent. */
function convertLegacyBlocks(elements: EmailElement[]): EmailElement[] {
  return elements.map((el) => {
    const type = (el as { type?: string }).type;
    const raw = el as unknown as Record<string, unknown>;
    const converted =
      type === LEGACY_ACCENT_TYPE
        ? convertLegacyAccentSection(raw)
        : type === LEGACY_HEADER_IMAGE_TYPE
          ? convertLegacyHeaderImage(raw)
          : type === LEGACY_KEY_VALUE_TYPE
            ? convertLegacyKeyValue(raw)
            : el;

    return isContainerElement(converted)
      ? {
          ...converted,
          childElements: convertLegacyBlocks(converted.childElements || []),
        }
      : converted;
  });
}

/**
 * Brings a saved template into line with the current schema: removed block
 * types are converted to their replacements, then any run of loose top-level
 * blocks is wrapped in one bare section.
 *
 * Consecutive blocks share a wrapper rather than getting one each, so the
 * document keeps the grouping the author had rather than exploding into a
 * section per paragraph. Existing containers are left exactly where they are.
 *
 * Because the wrapper is a `createBareSection`, this changes the *structure*
 * the editor sees without changing a byte of the exported email.
 */
export function migrateToSections(input: EmailElement[]): {
  elements: EmailElement[];
  wrapped: number;
} {
  const elements = convertLegacyBlocks(input);
  const out: EmailElement[] = [];
  let loose: EmailElement[] = [];
  let wrapped = 0;

  const flush = () => {
    if (loose.length === 0) return;
    wrapped += loose.length;
    out.push(
      createBareSection(
        `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        loose
      )
    );
    loose = [];
  };

  for (const el of elements) {
    if (isContainerElement(el)) {
      flush();
      out.push(el);
    } else {
      loose.push(el);
    }
  }
  flush();

  return { elements: out, wrapped };
}

/**
 * What each block type is called in the interface.
 *
 * One map, read by the canvas tab, the Inspector title and the palette, so a
 * block never has two names. Note `paragraph` is shown as "Text" — the word
 * people reach for, and the word the design uses.
 */
const TYPE_LABELS: Record<ElementType, string> = {
  section: 'Section',
  row: 'Columns',
  column: 'Column',
  image: 'Image',
  heading: 'Heading',
  paragraph: 'Text',
  list: 'List',
  button: 'Button',
  divider: 'Divider',
  spacer: 'Spacer',
  quote: 'Quote',
  'custom-html': 'HTML',
};

export function typeLabel(type: ElementType): string {
  return TYPE_LABELS[type] ?? type;
}

/**
 * What to call *this* block: its own name if the author gave it one, otherwise
 * its type. Sections are the ones people rename ("Header", "Footer"), which is
 * why the outline and the canvas tab both go through here.
 */
export function blockName(el: EmailElement): string {
  return el.label?.trim() || typeLabel(el.type);
}

/**
 * What the text toolbar's leftmost dropdown offers: the block formats a run of
 * text can take.
 */
export type TextBlockFormat = 'paragraph' | HeadingLevel;

export const TEXT_BLOCK_FORMATS: { value: TextBlockFormat; label: string }[] = [
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'h4', label: 'Heading 4' },
  { value: 'h5', label: 'Heading 5' },
  { value: 'h6', label: 'Heading 6' },
];

/** The dropdown's current value, or null for a block it doesn't apply to. */
export function textBlockFormat(el: EmailElement): TextBlockFormat | null {
  if (el.type === 'paragraph') return 'paragraph';
  if (el.type === 'heading') return el.level;
  return null;
}

/** Strips markup, leaving the text a heading can hold. */
function toPlainText(html: string): string {
  const node = document.createElement('div');
  node.innerHTML = html;
  return (node.textContent || '').replace(/\s+/g, ' ').trim();
}

/** Escapes text on its way into a field that holds markup. */
function toRichText(text: string): string {
  const node = document.createElement('div');
  node.textContent = text;
  return node.innerHTML;
}

/**
 * Switches a text block between paragraph and the six heading levels.
 *
 * Changing *level* keeps everything. Changing *kind* cannot: a heading holds
 * one line of plain text and a paragraph holds rich HTML, so going to a heading
 * flattens formatting. That is the honest outcome — a heading is a single
 * styled run by definition, and the alternative (refusing the conversion, or
 * silently keeping markup a heading can't render) is worse. Callers that want
 * to warn first can compare `toPlainText(content)` against `content`.
 *
 * Returns `el` unchanged when the format already matches or doesn't apply.
 */
export function convertTextBlock(
  el: EmailElement,
  format: TextBlockFormat
): EmailElement {
  if (format === 'paragraph') {
    if (el.type !== 'heading') return el;
    const base = createNewElement('paragraph') as ParagraphElement;
    return {
      ...base,
      id: el.id,
      label: 'Text',
      content: toRichText(el.text),
      /*
        Scale-specific overrides are dropped, so the new format picks up the
        theme's style for what it now is — keeping a heading's 32px would make
        the paragraph look like the heading it just stopped being. Colour and
        emphasis carry over only if the author had actually set them.
      */
      color: el.color,
      fontWeight: el.fontWeight,
      fontStyle: el.fontStyle,
      marginTop: el.marginTop,
      marginBottom: el.marginBottom,
      visibility: el.visibility,
    };
  }

  if (el.type === 'heading') {
    return el.level === format ? el : { ...el, level: format };
  }
  if (el.type !== 'paragraph') return el;

  const base = createNewElement('heading') as HeadingElement;
  return {
    ...base,
    id: el.id,
    label: 'Heading',
    level: format,
    text: toPlainText(el.content),
    // Same rule as the other direction: size and case come from the theme entry
    // for this level; only explicit colour and emphasis follow the text across.
    color: el.color,
    fontWeight: el.fontWeight,
    fontStyle: el.fontStyle,
    marginTop: el.marginTop,
    marginBottom: el.marginBottom,
    visibility: el.visibility,
  };
}

export function createNewElement(type: ElementType): EmailElement {
  const id = `el-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  switch (type) {
    case 'image':
      return {
        id,
        type: 'image',
        label: 'Image',
        src: 'https://placehold.co/600x200?text=Max-Width:+600px',
        alt: 'Placeholder - Please Upload Image',
        width: 600,
        height: 200,
        alignment: 'left',
        paddingTop: 10,
        paddingBottom: 20,
      };

    case 'heading':
      // No typography of its own — size, weight, colour, spacing and case all
      // come from the theme's `h2` entry, so a new heading matches the ones
      // already in the newsletter. Any control the author touches becomes an
      // override on this block.
      return {
        id,
        type: 'heading',
        label: 'Heading',
        text: 'New Heading',
        level: 'h2',
        marginTop: 15,
        marginBottom: 10,
      };

    case 'paragraph':
      return {
        id,
        type: 'paragraph',
        label: 'Paragraph Text',
        content:
          'Add your email message content here. Select any text on the canvas to make it <strong>bold</strong>, <em>italic</em>, or <span style="color:#b22222;">coloured</span> — press Enter to start a new paragraph.',
        // Inherits the theme's `paragraph` entry — see the heading above.
        marginTop: 8,
        marginBottom: 16,
      };

    case 'list':
      return {
        id,
        type: 'list',
        label: 'List',
        ordered: false,
        items: ['First item', 'Second item', 'Third item'],
        marker: 'disc',
        // Body copy, so it inherits the theme's `paragraph` entry.
        indent: 24,
        itemSpacing: 6,
        marginTop: 8,
        marginBottom: 16,
      };

    case 'button':
      return {
        id,
        type: 'button',
        label: 'Button',
        text: 'Click Here to Learn More',
        url: 'https://example.com',
        bgColor: '#b22222',
        textColor: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
        borderRadius: 5,
        paddingVertical: 14,
        paddingHorizontal: 25,
        alignment: 'left',
        marginTop: 15,
        marginBottom: 15,
      };

    case 'section':
      // Starts empty on purpose: the canvas shows a drop zone, and the sidebar
      // adds into whichever section is selected, so the next click fills it.
      return {
        id,
        type: 'section',
        label: 'Section',
        bgColor: 'transparent',
        borderColor: '#cbd5e1',
        borderStyle: 'solid',
        borderTopWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderLeftWidth: 1,
        borderRadius: 0,
        paddingTop: 20,
        paddingRight: 20,
        paddingBottom: 20,
        paddingLeft: 20,
        marginTop: 0,
        marginBottom: 20,
        childElements: [],
      };

    case 'row':
      // Two even columns, because a row with none is unusable and a row with
      // one isn't a row. `createColumnRow` is the way to ask for a count.
      return {
        id,
        type: 'row',
        label: '2 Columns',
        gap: 20,
        stackOnMobile: true,
        marginTop: 0,
        marginBottom: 20,
        childElements: createColumns(2),
      };

    case 'column':
      /*
        Half a two-column row. Whoever builds the row overwrites `width`;
        `columnWidths` in the generator falls back to an even split anyway, so
        a stray default here can't produce a broken table.

        Draws nothing by default — no border, padding or fill. A column that
        frames itself would put a box around every cell of every layout, and
        `renderRow`'s early return depends on "unstyled" being the starting
        point for a one-column row to stay free.
      */
      return {
        id,
        type: 'column',
        label: 'Column',
        width: 50,
        verticalAlign: 'top',
        bgColor: 'transparent',
        borderColor: '#cbd5e1',
        borderStyle: 'solid',
        borderTopWidth: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderLeftWidth: 0,
        borderRadius: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        childElements: [],
      };

    case 'divider':
      return {
        id,
        type: 'divider',
        label: 'Divider Line',
        color: '#e2e8f0',
        height: 1,
        style: 'solid',
        marginTop: 15,
        marginBottom: 20,
      };

    case 'spacer':
      return {
        id,
        type: 'spacer',
        label: 'Spacer',
        height: 24,
      };

    case 'quote':
      return {
        id,
        type: 'quote',
        label: 'Quote',
        quote: '“You can’t heal a wound by saying it’s not there.”',
        author: 'Jeremiah 6:14',
        bgColor: '#fdf2f2',
        borderColor: '#b22222',
        // Left rule only — what a pull quote conventionally looks like, and
        // what this block drew before the sides were configurable.
        borderTopWidth: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderLeftWidth: 4,
        borderStyle: 'solid',
        textColor: '#1a2b56',
        fontSize: 16,
        fontWeight: 'normal',
        fontStyle: 'italic',
        marginTop: 12,
        marginBottom: 18,
      };

    case 'custom-html':
      return {
        id,
        type: 'custom-html',
        label: 'HTML Block',
        html: `<div style="padding: 10px; background-color: #f8fafc; border: 1px dashed #cbd5e1; text-align: center; font-size: 14px; color: #64748b;">
  HTML Block (Edit raw HTML in properties panel)
</div>`,
      };

    default:
      throw new Error(`Unknown element type: ${type}`);
  }
}

/* ---------------------------------------------------------------------------
   Columns
   --------------------------------------------------------------------------- */

/**
 * `count` percentages totalling exactly 100.
 *
 * The remainder lands on the last column rather than being spread, so three
 * columns are 33.33 / 33.33 / 33.34 — the arithmetic is visible in the
 * Inspector, and a row whose widths sum to 99.99 leaves a hairline of the
 * background showing in some clients.
 */
export function evenWidths(count: number): number[] {
  if (count <= 0) return [];
  const each = Math.floor((100 / count) * 100) / 100;
  const widths = Array.from({ length: count }, () => each);
  widths[count - 1] = Number((100 - each * (count - 1)).toFixed(2));
  return widths;
}

/** `count` fresh, evenly sized columns. */
export function createColumns(count: number): ColumnElement[] {
  const widths = evenWidths(count);
  return widths.map((width, i) => {
    const column = createNewElement('column') as ColumnElement;
    // Several columns are minted in the same millisecond, and `createNewElement`
    // only has a random suffix to tell them apart. Duplicate ids would make
    // selecting one select them all.
    return { ...column, id: `${column.id}-${i}`, width };
  });
}

/** A row of `count` even columns, named for what it is. */
export function createColumnRow(count: number): RowElement {
  const row = createNewElement('row') as RowElement;
  return {
    ...row,
    label: `${count} Column${count === 1 ? '' : 's'}`,
    childElements: createColumns(count),
  };
}

/* ---------------------------------------------------------------------------
   Palette recipes
   --------------------------------------------------------------------------- */

/**
 * What a palette item makes.
 *
 * Usually just an element type — but a multi-column row is one `row` holding N
 * `column`s, which is a *shape* rather than a type, so the palette can't hand
 * an `ElementType` around and have it mean enough. Everything that carries a
 * pending block instead carries a recipe: the palette buttons, the drag state
 * in `DesignerContext`, and the two add handlers.
 *
 * Placement rules are still written against the element type, which
 * `recipeType` resolves — so a dragged "3 Columns" obeys exactly the same rules
 * as any other row.
 */
export type BlockRecipe =
  | ElementType
  | 'columns-1'
  | 'columns-2'
  | 'columns-3';

/** The column count a `columns-N` recipe asks for, or null for anything else. */
function recipeColumns(recipe: BlockRecipe): number | null {
  const match = /^columns-(\d+)$/.exec(recipe);
  return match ? Number(match[1]) : null;
}

export function recipeType(recipe: BlockRecipe): ElementType {
  return recipeColumns(recipe) === null ? (recipe as ElementType) : 'row';
}

export function createFromRecipe(recipe: BlockRecipe): EmailElement {
  const columns = recipeColumns(recipe);
  return columns === null
    ? createNewElement(recipe as ElementType)
    : createColumnRow(columns);
}
