import {
  ElementType,
  EmailElement,
  EmailSettings,
  NewsletterTemplate,
  TypographyScale,
  TypographyStyle,
} from '../types';
import { TYPOGRAPHY_KEYS } from './typography';
import {
  convertLegacyAccentSection,
  convertLegacyHeaderImage,
  convertLegacyKeyValue,
  createNewElement,
  isContainerElement,
  LEGACY_ACCENT_TYPE,
  LEGACY_HEADER_IMAGE_TYPE,
  LEGACY_KEY_VALUE_TYPE,
  migrateToSections,
} from './elementHelpers';
import { BLANK_CANVAS_TEMPLATE } from './defaultTemplate';

/**
 * The save-to-disk format for a newsletter project.
 *
 * A project file is plain JSON holding the whole `NewsletterTemplate` — blocks,
 * global settings, and any uploaded images (already inlined as data URIs by the
 * image picker), so one file is entirely self-contained and portable.
 *
 * It is deliberately *not* the exported email HTML: HTML is the output, this is
 * the editable source. `.newsletter.json` keeps that distinction visible in a
 * file listing while staying readable in any text editor.
 *
 * `version` exists so a future breaking change to `EmailElement` can migrate old
 * files on read instead of failing. Bump it only for changes that older builds
 * could not load; additive optional fields don't need it.
 */
export const TEMPLATE_FILE_FORMAT = 'html-newsletter-designer';
/**
 * v2 — `header-image` became the generic `image`. v1 files still load (the block
 * is converted on read); a v1 build reading a v2 file would silently drop every
 * image, so the bump makes it say so instead.
 *
 * Still 2 after the `list` and `spacer` blocks were added: a new *type* is
 * additive. A build without it drops the block with a visible warning, which is
 * the right outcome — bumping would instead make it refuse the whole file,
 * losing the rest of a newsletter it could have read perfectly well.
 *
 * Still 2 after `key-value` was retired and `visibility` added, for the same
 * reason read the other way round. The bump exists to stop an *older* build
 * misreading a *newer* file; removing a type can't do that, and `visibility` is
 * optional — an old build ignores it and shows the block, which is the safe
 * failure. Old files still holding a `key-value` block are converted on read.
 *
 * Still 2 after `row` and `column` arrived, for the first reason again: they
 * are new types, so an old build drops them with a visible warning and reads
 * the rest of the newsletter, which beats refusing the whole file.
 */
export const TEMPLATE_FILE_VERSION = 2;
export const TEMPLATE_FILE_EXTENSION = '.newsletter.json';

export interface NewsletterFile {
  format: typeof TEMPLATE_FILE_FORMAT;
  version: number;
  /** ISO timestamp, informational only — nothing reads it back. */
  savedAt: string;
  template: NewsletterTemplate;
}

const ELEMENT_TYPES = new Set<string>([
  'image',
  'heading',
  'section',
  'row',
  'column',
  'paragraph',
  'list',
  'button',
  'divider',
  'spacer',
  'quote',
  'custom-html',
]);

const DEFAULT_SETTINGS = BLANK_CANVAS_TEMPLATE.settings;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** `Monthly Update Newsletter` -> `monthly-update-newsletter.newsletter.json` */
export function suggestTemplateFileName(template: NewsletterTemplate): string {
  return `${slugify(template.name) || 'newsletter'}${TEMPLATE_FILE_EXTENSION}`;
}

export function serializeTemplateFile(
  template: NewsletterTemplate,
  savedAt: string = new Date().toISOString()
): string {
  const file: NewsletterFile = {
    format: TEMPLATE_FILE_FORMAT,
    version: TEMPLATE_FILE_VERSION,
    savedAt,
    template,
  };
  // Pretty-printed so the file diffs cleanly in git and reads in a text editor.
  return JSON.stringify(file, null, 2);
}

export type ParseTemplateFileResult =
  | {
      status: 'ok';
      template: NewsletterTemplate;
      warnings: string[];
      /**
       * How many loose top-level blocks were wrapped in a section to satisfy
       * the "blocks live inside sections" rule. 0 for anything saved by a
       * build that already had it. Distinct from `warnings` — nothing failed,
       * and the exported email is unchanged.
       */
      wrappedInSections: number;
    }
  | { status: 'error'; error: string };

function uniqueId(candidate: unknown, seen: Set<string>): string {
  const id =
    typeof candidate === 'string' && candidate.trim() && !seen.has(candidate)
      ? candidate
      : `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  seen.add(id);
  return id;
}

/**
 * Rebuilds one element from file data, using `createNewElement` defaults for
 * anything missing. That is what lets a file written by an older build — or by
 * hand — load without every field present.
 *
 * Returns null for a block whose `type` this build doesn't know; the caller
 * records a warning and drops it rather than failing the whole load.
 */
function normalizeElement(
  raw: unknown,
  warnings: string[],
  seen: Set<string>
): EmailElement | null {
  // A block type this build removed or renamed is converted rather than dropped
  // — the check below would otherwise treat the author's work as unreadable.
  if (isRecord(raw) && raw.type === LEGACY_ACCENT_TYPE) {
    raw = convertLegacyAccentSection(raw);
  } else if (isRecord(raw) && raw.type === LEGACY_HEADER_IMAGE_TYPE) {
    raw = convertLegacyHeaderImage(raw);
  } else if (isRecord(raw) && raw.type === LEGACY_KEY_VALUE_TYPE) {
    raw = convertLegacyKeyValue(raw);
  }

  if (!isRecord(raw) || typeof raw.type !== 'string' || !ELEMENT_TYPES.has(raw.type)) {
    const label = isRecord(raw) && typeof raw.type === 'string' ? `"${raw.type}"` : 'with no type';
    warnings.push(`Skipped a block ${label} — this version of the designer doesn't have it.`);
    return null;
  }

  const type = raw.type as ElementType;
  const element = {
    ...createNewElement(type),
    ...raw,
    id: uniqueId(raw.id, seen),
  } as unknown as EmailElement;

  if (isContainerElement(element)) {
    // Normalize nested blocks too, and don't let the defaults' sample children
    // sneak in when the file's section is genuinely empty.
    element.childElements = Array.isArray(raw.childElements)
      ? normalizeList(raw.childElements, warnings, seen)
      : [];
  }

  if (element.type === 'list') {
    // `items` is the one array of plain strings in the schema, and the spread
    // above would have taken whatever the file put there — including a string,
    // or a list of objects — straight into the renderer.
    element.items = Array.isArray(raw.items)
      ? raw.items.filter((item): item is string => typeof item === 'string')
      : [];
  }

  if (element.type === 'custom-html' && raw.convertedFrom !== undefined) {
    // The stashed pre-conversion element powers the Inspector's Revert button;
    // keep it only if it survives the same validation.
    const restored = normalizeElement(raw.convertedFrom, [], new Set());
    if (restored && restored.type !== 'custom-html') element.convertedFrom = restored;
    else delete element.convertedFrom;
  }

  return element;
}

function normalizeList(
  raw: unknown[],
  warnings: string[],
  seen: Set<string>
): EmailElement[] {
  const out: EmailElement[] = [];
  for (const item of raw) {
    const element = normalizeElement(item, warnings, seen);
    if (element) out.push(element);
  }
  return out;
}

/**
 * Rebuilds the theme's type scale from file data, keeping only entries and
 * fields this build knows, with the right types.
 *
 * Handled separately from the flat settings below because a `typeof` check
 * against an object accepts *any* object — including one whose `h1.fontSize` is
 * a string, which would reach the generator as `font-size:NaNpx`.
 */
function normalizeTypography(raw: unknown): TypographyScale | undefined {
  if (!isRecord(raw)) return undefined;

  const scale: TypographyScale = {};
  for (const key of TYPOGRAPHY_KEYS) {
    const entry = raw[key];
    if (!isRecord(entry)) continue;

    const style: Partial<TypographyStyle> = {};
    if (typeof entry.fontSize === 'number' && isFinite(entry.fontSize)) {
      style.fontSize = entry.fontSize;
    }
    if (typeof entry.lineHeight === 'number' && isFinite(entry.lineHeight)) {
      style.lineHeight = entry.lineHeight;
    }
    if (entry.fontWeight === 'normal' || entry.fontWeight === 'bold') {
      style.fontWeight = entry.fontWeight;
    }
    if (entry.fontStyle === 'normal' || entry.fontStyle === 'italic') {
      style.fontStyle = entry.fontStyle;
    }
    if (
      entry.transform === 'none' ||
      entry.transform === 'uppercase' ||
      entry.transform === 'capitalize'
    ) {
      style.transform = entry.transform;
    }
    if (typeof entry.letterSpacing === 'string') {
      style.letterSpacing = entry.letterSpacing;
    }
    if (typeof entry.color === 'string') style.color = entry.color;

    if (Object.keys(style).length > 0) scale[key] = style;
  }

  return Object.keys(scale).length > 0 ? scale : undefined;
}

function normalizeSettings(raw: unknown, warnings: string[]): EmailSettings {
  if (!isRecord(raw)) {
    warnings.push('That file had no global style settings — used the defaults.');
    return { ...DEFAULT_SETTINGS };
  }

  const settings = { ...DEFAULT_SETTINGS };
  let replaced = 0;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof EmailSettings)[]) {
    // The one non-scalar setting — validated field by field below.
    if (key === 'typography') continue;
    const value = raw[key];
    if (typeof value === typeof DEFAULT_SETTINGS[key]) {
      (settings[key] as EmailSettings[typeof key]) = value as EmailSettings[typeof key];
    } else if (value !== undefined) {
      replaced++;
    }
  }

  const typography = normalizeTypography(raw.typography);
  if (typography) settings.typography = typography;
  if (replaced > 0) {
    warnings.push(`${replaced} global style setting(s) were unreadable — used the defaults.`);
  }
  return settings;
}

/**
 * Reads a project file's text into a template.
 *
 * File contents are untrusted input — a hand-edited file, a file from a newer
 * build, or something that isn't a newsletter at all. Every failure returns a
 * message meant to be shown to the user rather than throwing.
 *
 * A bare `NewsletterTemplate` (no envelope) is also accepted, so the JSON copied
 * out of the browser's saved state loads too.
 */
export function parseTemplateFile(text: string): ParseTemplateFileResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      status: 'error',
      error: "That file isn't valid JSON, so it can't be read as a newsletter project.",
    };
  }

  if (!isRecord(raw)) {
    return { status: 'error', error: "That file doesn't contain a newsletter project." };
  }

  let templateRaw: unknown = raw;

  if ('format' in raw || 'template' in raw) {
    if (typeof raw.format === 'string' && raw.format !== TEMPLATE_FILE_FORMAT) {
      return {
        status: 'error',
        error: `That file was saved by a different app ("${raw.format}"), not this designer.`,
      };
    }
    if (typeof raw.version === 'number' && raw.version > TEMPLATE_FILE_VERSION) {
      return {
        status: 'error',
        error: `That file was saved by a newer version of the designer (file format v${raw.version}; this build reads v${TEMPLATE_FILE_VERSION}). Update the app, or re-save the file from the version that wrote it.`,
      };
    }
    templateRaw = raw.template;
  }

  if (!isRecord(templateRaw) || !Array.isArray(templateRaw.elements)) {
    return {
      status: 'error',
      error: "That file has no newsletter blocks in it — it's missing an \"elements\" list.",
    };
  }

  const warnings: string[] = [];
  const elements = normalizeList(templateRaw.elements, warnings, new Set<string>());

  if (elements.length === 0 && templateRaw.elements.length > 0) {
    return {
      status: 'error',
      error:
        'None of the blocks in that file could be read, so nothing was loaded. Your current newsletter is untouched.',
    };
  }

  // Files written before blocks were required to live in sections have loose
  // top-level blocks; wrap them so the editor's rules hold for every template.
  const migrated = migrateToSections(elements);

  return {
    status: 'ok',
    warnings,
    wrappedInSections: migrated.wrapped,
    template: {
      id: typeof templateRaw.id === 'string' ? templateRaw.id : `template-${Date.now()}`,
      name:
        typeof templateRaw.name === 'string' && templateRaw.name.trim()
          ? templateRaw.name
          : 'Untitled Newsletter',
      settings: normalizeSettings(templateRaw.settings, warnings),
      elements: migrated.elements,
    },
  };
}
