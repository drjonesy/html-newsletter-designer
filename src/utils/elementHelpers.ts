import {
  ContainerElement,
  EmailElement,
  ElementType,
  ImageElement,
  SectionElement,
} from '../types';

/** The block types that hold `childElements`. */
export const CONTAINER_TYPES: ElementType[] = ['section'];

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
 * Only containers may. Everything else has to live inside one, which is what
 * keeps the document organised into sections — enforced when adding from the
 * palette and when dragging blocks around the canvas.
 *
 * Templates saved before the rule existed are brought into line on load by
 * `migrateToSections`, so nothing in the editor has to cope with a loose
 * top-level block.
 */
export function canSitAtTopLevel(type: ElementType): boolean {
  return isContainerType(type);
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
      return {
        id,
        type: 'heading',
        label: 'Heading',
        text: 'New Heading',
        level: 'h2',
        color: '#1a2b56',
        fontSize: 22,
        fontWeight: 'bold',
        fontStyle: 'normal',
        transform: 'uppercase',
        letterSpacing: '1px',
        marginTop: 15,
        marginBottom: 10,
      };

    case 'key-value':
      return {
        id,
        type: 'key-value',
        label: 'Date & Time:',
        value: 'Next Wednesday @ 7:00 PM',
        labelColor: '#1a2b56',
        valueColor: '#1a2b56',
        fontSize: 16,
        boldLabel: true,
        italicLabel: false,
        boldValue: false,
        italicValue: false,
        marginTop: 8,
        marginBottom: 12,
      };

    case 'paragraph':
      return {
        id,
        type: 'paragraph',
        label: 'Paragraph Text',
        content:
          'Add your email message content here. Select any text on the canvas to make it <strong>bold</strong>, <em>italic</em>, or <span style="color:#b22222;">coloured</span> — press Enter to start a new paragraph.',
        color: '#333333',
        fontSize: 16,
        fontWeight: 'normal',
        fontStyle: 'normal',
        lineHeight: 1.6,
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
        color: '#333333',
        fontSize: 16,
        lineHeight: 1.6,
        fontWeight: 'normal',
        fontStyle: 'normal',
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

    case 'quote':
      return {
        id,
        type: 'quote',
        label: 'Quote',
        quote: '“You can’t heal a wound by saying it’s not there.”',
        author: 'Jeremiah 6:14',
        bgColor: '#fdf2f2',
        borderColor: '#b22222',
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
