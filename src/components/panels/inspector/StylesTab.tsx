import React from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  RotateCcw,
  Scan,
} from 'lucide-react';
import {
  ColumnElement,
  ElementType,
  EmailElement,
  RowElement,
  SectionElement,
  TextAlign,
} from '../../../types';
import {
  blockBackground,
  blockBorder,
  blockPadding,
  blockRadius,
  createColumns,
  evenWidths,
  blockName,
  withBlockBackground,
  withBlockBorder,
  withBlockPadding,
  withBlockRadius,
} from '../../../utils/elementHelpers';
import {
  clearTextOverrides,
  HEADING_LEVELS,
  overriddenFields,
  resolveTextStyle,
  TYPOGRAPHY_LABELS,
  typographyKeyFor,
} from '../../../utils/typography';
import { TextStyleFields } from '../TextStyleFields';
import { useDesigner } from '../../../state/DesignerContext';
import {
  BoxSides,
  Checkbox,
  ColorField,
  FieldGroup,
  NumberStepper,
  SegmentedControl,
  SelectField,
  Side,
  ToggleSwitch,
} from '../../controls';

type Update = (el: EmailElement) => void;

/**
 * Every editor takes the element and one setter, and calls it with a whole new
 * element. Nothing here mutates — the setter is `updateElement` from the
 * designer context, which commits through the history hook.
 */
interface EditorProps<T extends EmailElement = EmailElement> {
  element: T;
  update: Update;
  /** Stable per element, so a slider drag folds into one undo step. */
  key_: string;
}

/* --- Shared groups --------------------------------------------------------- */

/** Bold / italic pair, drawn as the design's two-up toggle. */
const EmphasisToggles: React.FC<{
  bold: boolean;
  italic: boolean;
  onChange: (next: { bold: boolean; italic: boolean }) => void;
}> = ({ bold, italic, onChange }) => (
  <div className="flex gap-2">
    <button
      type="button"
      onClick={() => onChange({ bold: !bold, italic })}
      aria-pressed={bold}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border py-1.5 text-sm font-semibold ${
        bold
          ? 'border-accent-500 bg-accent-50 text-accent-700'
          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Bold className="h-4 w-4" />
      Bold
    </button>
    <button
      type="button"
      onClick={() => onChange({ bold, italic: !italic })}
      aria-pressed={italic}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border py-1.5 text-sm font-semibold ${
        italic
          ? 'border-accent-500 bg-accent-50 text-accent-700'
          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Italic className="h-4 w-4" />
      Italic
    </button>
  </div>
);

/**
 * The fill behind a block — the one control every type has.
 *
 * Which field it writes is `withBlockBackground`'s business: `section`,
 * `column` and `quote` keep their own long-standing `bgColor`, everything else
 * uses the optional `backgroundColor` on `BaseElement`. The panel doesn't need
 * to know, and blocks can't end up with two competing background controls.
 */
const BackgroundGroup: React.FC<{ element: EmailElement }> = ({ element }) => {
  const { updateElement } = useDesigner();
  const isBareText =
    element.type === 'heading' ||
    element.type === 'paragraph' ||
    element.type === 'list';

  return (
    <FieldGroup label="Background">
      <ColorField
        clearable
        value={blockBackground(element)}
        fallback="#f8fafc"
        onChange={(color) =>
          updateElement(withBlockBackground(element, color), {
            coalesceKey: `bg:${element.id}`,
          })
        }
      />
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        {blockBackground(element)
          ? isBareText
            ? 'Painted behind the whole block. Padding, below, is what puts space between the colour and the text.'
            : 'Painted behind the whole block.'
          : 'No fill — whatever is behind the block shows through.'}
      </p>
    </FieldGroup>
  );
};

/**
 * What padding means on a type where it isn't simply "space inside the block".
 *
 * Absent is the common case and needs no explaining. These are the four that
 * would otherwise surprise someone: two knobs that add up, a control that grows
 * a block whose whole point is a stated size, and one that could be mistaken
 * for the button's own.
 */
const PADDING_HINTS: Partial<Record<ElementType, string>> = {
  button:
    'The space around the button. How big the button itself is comes from Padding Y and X under Shape.',
  list: 'Added to the indent, so the markers keep whatever hanging distance you gave them.',
  spacer:
    'Top and bottom add to the height — a cell is as tall as its content box plus its padding. Left and right inset the fill without changing that.',
  row: 'Insets the whole strip. Space inside one cell belongs to that column.',
};

/**
 * The space inside a block — the other control every type has.
 *
 * Which fields it writes is `withBlockPadding`'s business: `section`, `column`
 * and `image` have required sides of their own, a `quote` reads all four absent
 * as the 16/20 it used to hard-code, and everything else drops the fields once
 * they're back to zero. The panel doesn't need to know, which is what keeps a
 * type from ending up with two padding controls — the thing the four-sided
 * section and the two-sided image were heading for.
 */
const PaddingGroup: React.FC<{ element: EmailElement }> = ({ element }) => {
  const { updateElement } = useDesigner();
  const p = blockPadding(element);
  const hint = PADDING_HINTS[element.type];

  return (
    <FieldGroup label="Padding">
      {/*
        Keyed on the block, because `BoxSides` derives "apply to all sides" from
        the values it opens with. This group is the one that never unmounts —
        it's rendered for every type — so without the key a 16/20 quote selected
        after a 20-all-round section would open linked and show a single 16.
      */}
      <BoxSides
        key={element.id}
        label="Padding"
        values={{ top: p.top, right: p.right, bottom: p.bottom, left: p.left }}
        max={100}
        onChange={(next) =>
          updateElement(withBlockPadding(element, next), {
            coalesceKey: `padding:${element.id}`,
          })
        }
      />
      {hint && (
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</p>
      )}
    </FieldGroup>
  );
};

/**
 * What the rounding rounds on a type where "the block's own box" isn't the
 * whole story — a chip inside a cell, a picture inside one, and the one block
 * that has been rounded by default since long before this control existed.
 */
const RADIUS_HINTS: Partial<Record<ElementType, string>> = {
  button: 'Rounds the button itself, not the cell around it.',
  image: 'Rounds the picture.',
  quote: 'A quote is rounded by 4px until you say otherwise. 0 squares it off.',
};

/**
 * How far a block's corners are rounded — the third control every type has.
 *
 * Which field it writes is `withBlockRadius`'s business: `section`, `column`
 * and `button` require a radius of their own, a `quote` reads absent as the 4px
 * it used to hard-code, and everything else drops the field once it's back to
 * zero. The panel doesn't need to know, which is what keeps a type from ending
 * up with two rounding controls — the thing the section, the column and the
 * button each having their own was heading for.
 */
const RoundedCornersGroup: React.FC<{ element: EmailElement }> = ({
  element,
}) => {
  const { updateElement } = useDesigner();
  const hint = RADIUS_HINTS[element.type];

  return (
    <FieldGroup label="Rounded corners">
      <NumberStepper
        value={blockRadius(element)}
        min={0}
        max={40}
        icon={<Scan className="h-4 w-4" />}
        onChange={(radius) =>
          updateElement(withBlockRadius(element, radius), {
            coalesceKey: `radius:${element.id}`,
          })
        }
      />
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        {hint ??
          'Rounds the block’s own fill and border — blocks inside keep their own corners.'}{' '}
        Ignored by Outlook’s Word engine, where corners stay square.
      </p>
    </FieldGroup>
  );
};

const ALIGN_SEGMENTS: { value: TextAlign; label: string; icon: React.ReactNode }[] =
  [
    { value: 'left', label: 'Left', icon: <AlignLeft className="h-4 w-4" /> },
    {
      value: 'center',
      label: 'Centre',
      icon: <AlignCenter className="h-4 w-4" />,
    },
    { value: 'right', label: 'Right', icon: <AlignRight className="h-4 w-4" /> },
  ];

/**
 * Left / centre / right, shared by every block that has an alignment.
 *
 * `value` is optional because on most blocks **absent means inherit** — no
 * segment is raised, and the block follows the container around it. The reset
 * is the only way back to that state once a segment has been picked, so it
 * belongs to the control rather than to each of the seven callers; `image` and
 * `button` omit `onReset`, their alignment being a field that is always set.
 */
const AlignmentGroup: React.FC<{
  value?: TextAlign;
  onChange: (align: TextAlign) => void;
  onReset?: () => void;
  label?: string;
  /** Shown under the control once an alignment is set. */
  hint?: string;
}> = ({ value, onChange, onReset, label = 'Alignment', hint }) => (
  <FieldGroup label={label}>
    <SegmentedControl
      value={value}
      segments={ALIGN_SEGMENTS}
      onChange={onChange}
    />

    {onReset &&
      (value ? (
        <button
          type="button"
          onClick={onReset}
          title="Follow the block or section around this one"
          className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-accent-600 hover:text-accent-700 hover:underline"
        >
          <RotateCcw className="h-3 w-3" />
          Set on this block — inherit instead
        </button>
      ) : (
        <p className="mt-1.5 text-[11px] text-slate-500">
          Inheriting from the section around it.
        </p>
      ))}

    {hint && <p className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</p>}
  </FieldGroup>
);

/**
 * Top/bottom margin, which is all most blocks have.
 *
 * The generator emits no left/right margin for a non-container, so offering
 * those two fields would be controls that visibly do nothing.
 */
const MarginGroup: React.FC<{
  top: number;
  bottom: number;
  onChange: (next: { marginTop?: number; marginBottom?: number }) => void;
}> = ({ top, bottom, onChange }) => (
  <FieldGroup label="Spacing">
    <BoxSides
      label="Margin"
      sides={['top', 'bottom']}
      values={{ top, bottom }}
      onChange={(next) =>
        onChange({
          ...(next.top !== undefined ? { marginTop: next.top } : {}),
          ...(next.bottom !== undefined ? { marginBottom: next.bottom } : {}),
        })
      }
    />
  </FieldGroup>
);

/* --- Section --------------------------------------------------------------- */

const BORDER_PRESETS: { label: string; sides: Side[] }[] = [
  { label: 'None', sides: [] },
  { label: 'All sides', sides: ['top', 'right', 'bottom', 'left'] },
  { label: 'Left only', sides: ['left'] },
  { label: 'Right only', sides: ['right'] },
  { label: 'Top only', sides: ['top'] },
  { label: 'Bottom only', sides: ['bottom'] },
];

/**
 * Per-side borders: a preset picker, then width / style / colour once there's
 * a border to configure.
 *
 * Shared by `section` and `quote`, which have the same border shape on purpose
 * — a pull quote's accent bar and a section's left rule are the same control,
 * and giving them two would let them drift apart.
 *
 * The presets are a shortcut, not the model. Any combination is reachable
 * through the four width fields; the dropdown just shows "Custom" for one it
 * doesn't have a name for.
 */
const BorderEditor: React.FC<{
  widths: Record<Side, number>;
  style: 'solid' | 'dashed' | 'dotted';
  color: string;
  /** Called with only the sides that changed. */
  onWidths: (next: Partial<Record<Side, number>>) => void;
  onStyle: (style: 'solid' | 'dashed' | 'dotted') => void;
  onColor: (color: string) => void;
}> = ({ widths, style, color, onWidths, onStyle, onColor }) => {
  const active = (Object.keys(widths) as Side[]).filter((s) => widths[s] > 0);

  const preset =
    BORDER_PRESETS.find(
      (p) =>
        p.sides.length === active.length &&
        p.sides.every((s) => active.includes(s))
    )?.label ?? 'Custom';

  const setSides = (sides: Side[]) => {
    // Keep whatever width the author already chose, so switching which side
    // the rule is on doesn't also reset how thick it is.
    const width = Math.max(1, ...active.map((s) => widths[s]), 0) || 1;
    onWidths({
      top: sides.includes('top') ? width : 0,
      right: sides.includes('right') ? width : 0,
      bottom: sides.includes('bottom') ? width : 0,
      left: sides.includes('left') ? width : 0,
    });
  };

  return (
    <>
      <SelectField
        value={preset}
        options={[
          // Only offered while it's the current state — "Custom" isn't
          // something you can meaningfully pick.
          ...(preset === 'Custom' ? [{ value: 'Custom', label: 'Custom' }] : []),
          ...BORDER_PRESETS.map((p) => ({ value: p.label, label: p.label })),
        ]}
        onChange={(label) => {
          const next = BORDER_PRESETS.find((p) => p.label === label);
          if (next) setSides(next.sides);
        }}
      />

      {active.length > 0 && (
        <div className="mt-3 space-y-3">
          <BoxSides label="Width" values={widths} max={20} onChange={onWidths} />
          <SelectField
            label="Style"
            value={style}
            options={[
              { value: 'solid', label: 'Solid' },
              { value: 'dashed', label: 'Dashed' },
              { value: 'dotted', label: 'Dotted' },
            ]}
            onChange={onStyle}
          />
          <ColorField label="Colour" value={color} onChange={onColor} />
        </div>
      )}
    </>
  );
};

/**
 * What a border means on a type where "around the block" isn't the whole story
 * — a chip inside a cell, a block that already draws a line of its own, and the
 * one that has come with a rule since long before this control existed.
 */
const BORDER_HINTS: Partial<Record<ElementType, string>> = {
  button:
    'Draws around the button itself. Outlook can only show it when all four sides are the same width.',
  divider:
    'A frame around the whole block. The line across it is Line, above.',
  image: 'Draws around the picture.',
  quote: 'A quote has a 4px left rule until you say otherwise.',
};

/**
 * The border every block can have — the fourth of the shared groups.
 *
 * Which fields it writes is `withBlockBorder`'s business: `section` and
 * `column` require all six, a `quote` reads its widths absent as the 4px left
 * rule it used to hard-code, and everything else drops them once no side is
 * left. The panel doesn't need to know, which is what keeps a type from ending
 * up with two border controls.
 */
const BorderGroup: React.FC<{ element: EmailElement }> = ({ element }) => {
  const { updateElement } = useDesigner();
  const b = blockBorder(element);
  const hint = BORDER_HINTS[element.type];

  return (
    <FieldGroup label="Border">
      <BorderEditor
        widths={{ top: b.top, right: b.right, bottom: b.bottom, left: b.left }}
        style={b.style}
        color={b.color}
        onWidths={(next) => updateElement(withBlockBorder(element, next))}
        onStyle={(style) => updateElement(withBlockBorder(element, { style }))}
        onColor={(color) =>
          updateElement(withBlockBorder(element, { color }), {
            coalesceKey: `border:${element.id}`,
          })
        }
      />
      {hint && (
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</p>
      )}
    </FieldGroup>
  );
};

const SectionStyles: React.FC<EditorProps<SectionElement>> = ({ element, update }) => {
  return (
    <>
      <AlignmentGroup
        value={element.textAlign}
        onChange={(textAlign) => update({ ...element, textAlign })}
        onReset={() => update({ ...element, textAlign: undefined })}
        hint="Applies to every block in the section. A block that sets its own alignment keeps it."
      />

      <MarginGroup
        top={element.marginTop}
        bottom={element.marginBottom}
        onChange={(next) => update({ ...element, ...next })}
      />

      <FieldGroup>
        <p className="text-xs leading-relaxed text-slate-500">
          A section with no border, padding, margin, fill or alignment emits
          nothing of its own — only its blocks. That's what lets you group
          content without adding a byte to the email.
        </p>
      </FieldGroup>
    </>
  );
};

/* --- Rows and columns ------------------------------------------------------ */

/**
 * Named width splits, per column count.
 *
 * A shortcut, not the model — same bargain as `BORDER_PRESETS`. Any split is
 * reachable by editing a column's own width, and the picker shows "Custom" for
 * one it has no name for. The lists are keyed by count because "66 / 33" means
 * nothing to a three-column row.
 */
const WIDTH_PRESETS: Record<number, { label: string; widths: number[] }[]> = {
  2: [
    { label: 'Equal', widths: [50, 50] },
    { label: 'Wide left', widths: [66, 34] },
    { label: 'Wide right', widths: [34, 66] },
    { label: 'Sidebar left', widths: [25, 75] },
    { label: 'Sidebar right', widths: [75, 25] },
  ],
  3: [
    { label: 'Equal', widths: evenWidths(3) },
    { label: 'Wide centre', widths: [25, 50, 25] },
    { label: 'Wide left', widths: [50, 25, 25] },
    { label: 'Wide right', widths: [25, 25, 50] },
  ],
};

const MAX_COLUMNS = 4;

const RowStyles: React.FC<EditorProps<RowElement>> = ({ element, update }) => {
  const { select } = useDesigner();
  const columns = element.childElements || [];

  const setWidths = (widths: number[]) =>
    update({
      ...element,
      childElements: columns.map((child, i) =>
        child.type === 'column' ? { ...child, width: widths[i] } : child
      ),
    });

  /**
   * Change how many columns there are.
   *
   * Removing one moves its blocks into the column before it rather than
   * deleting them — losing a paragraph because you nudged a stepper is the kind
   * of thing undo shouldn't have to rescue you from. Widths are re-evened
   * either way, since the old split no longer adds up.
   */
  const setCount = (count: number) => {
    const next = [...columns];

    if (count > next.length) {
      next.push(...createColumns(count - next.length));
    } else {
      const dropped = next.splice(count);
      const last = next[next.length - 1];
      const orphans = dropped.flatMap((col) =>
        col.type === 'column' ? col.childElements || [] : [col]
      );
      if (last && last.type === 'column' && orphans.length > 0) {
        next[next.length - 1] = {
          ...last,
          childElements: [...(last.childElements || []), ...orphans],
        };
      }
    }

    const widths = evenWidths(next.length);
    update({
      ...element,
      childElements: next.map((child, i) =>
        child.type === 'column' ? { ...child, width: widths[i] } : child
      ),
    });
  };

  const presets = WIDTH_PRESETS[columns.length] ?? [];
  const current = columns.map((c) => (c.type === 'column' ? c.width : 0));
  const preset =
    presets.find((p) => p.widths.every((w, i) => Math.abs(w - current[i]) < 0.5))
      ?.label ?? 'Custom';

  return (
    <>
      <FieldGroup label="Columns">
        <NumberStepper
          value={columns.length}
          min={1}
          max={MAX_COLUMNS}
          onChange={setCount}
        />
        <p className="mt-2 text-xs text-slate-500">
          More than three columns is under 150px each on a phone, before it
          stacks. Two or three is what most email designs use.
        </p>
      </FieldGroup>

      {presets.length > 0 && (
        <FieldGroup label="Width split">
          <SelectField
            value={preset}
            options={[
              ...(preset === 'Custom'
                ? [{ value: 'Custom', label: 'Custom' }]
                : []),
              ...presets.map((p) => ({ value: p.label, label: p.label })),
            ]}
            onChange={(label) => {
              const next = presets.find((p) => p.label === label);
              if (next) setWidths(next.widths);
            }}
          />
        </FieldGroup>
      )}

      {columns.length > 0 && (
        <FieldGroup label="The columns">
          <ul className="space-y-1.5">
            {columns.map((column) => (
              <li key={column.id}>
                <button
                  type="button"
                  onClick={() => select(column.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:border-accent-400 hover:text-accent-700"
                >
                  <span className="min-w-0 truncate">{blockName(column)}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {column.type === 'column'
                      ? `${Number(column.width.toFixed(2))}%`
                      : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            A border, an exact width and padding inside one cell live on the
            column itself. The row's own padding insets the whole strip.
          </p>
        </FieldGroup>
      )}

      <FieldGroup label="Gap between columns">
        <NumberStepper
          value={element.gap}
          min={0}
          max={60}
          suffix="px"
          onChange={(gap) => update({ ...element, gap })}
        />
      </FieldGroup>

      <FieldGroup label="Mobile">
        <ToggleSwitch
          checked={element.stackOnMobile !== false}
          label="Stack on narrow screens"
          hint="Full-width, one under the other, below 600px."
          onChange={(stackOnMobile) => update({ ...element, stackOnMobile })}
        />
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Stacking is a media query in the email's head. A few clients strip
          those — there the columns stay side by side, which is narrow but
          readable.
        </p>
      </FieldGroup>

      <MarginGroup
        top={element.marginTop}
        bottom={element.marginBottom}
        onChange={(next) => update({ ...element, ...next })}
      />

      {columns.length === 1 && (
        <FieldGroup>
          <p className="text-xs leading-relaxed text-slate-500">
            A single column with no border, padding, margin or fill emits
            nothing of its own — only its blocks. That's what lets you group
            content without adding a byte to the email.
          </p>
        </FieldGroup>
      )}
    </>
  );
};

const ColumnStyles: React.FC<EditorProps<ColumnElement>> = ({ element, update }) => {
  return (
    <>
      <FieldGroup label="Width">
        <NumberStepper
          value={Number(element.width.toFixed(2))}
          min={5}
          // 100 is the real value for the only column of a one-column row —
          // clamping below it would make the field disagree with the canvas.
          max={100}
          suffix="%"
          onChange={(width) => update({ ...element, width })}
        />
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          A share of the row. The row's own "Width split" is the quick way to
          set every column at once and keep the total at 100%.
        </p>
      </FieldGroup>

      {/*
        The same border control a section gets, because a one-column row is the
        general-purpose box — it's what "1 Column" in the palette makes.
      */}
      <AlignmentGroup
        label="Horizontal alignment"
        value={element.textAlign}
        onChange={(textAlign) => update({ ...element, textAlign })}
        onReset={() => update({ ...element, textAlign: undefined })}
        hint="Applies to every block in the column. A block that sets its own alignment keeps it."
      />

      <FieldGroup label="Vertical alignment">
        <SegmentedControl
          value={element.verticalAlign}
          segments={[
            { value: 'top', label: 'Top' },
            { value: 'middle', label: 'Middle' },
            { value: 'bottom', label: 'Bottom' },
          ]}
          onChange={(verticalAlign) => update({ ...element, verticalAlign })}
        />
        <p className="mt-2 text-xs text-slate-500">
          How this column sits against the tallest one in the row.
        </p>
      </FieldGroup>
    </>
  );
};

/* --- Everything else ------------------------------------------------------- */

/**
 * Per-block appearance, minus the background every type shares.
 *
 * One switch over the union, so `pnpm lint` fails loudly if a new element type
 * arrives without an editor — the same guard the generator and `createNewElement`
 * rely on.
 */
const TypeStyles: React.FC<{ element: EmailElement }> = ({ element }) => {
  const { settings, updateElement } = useDesigner();
  const update: Update = (el) => updateElement(el);
  const key_ = element.id;

  /** Colour and size drags fire per pixel; fold each into one undo step. */
  const updateColor = (el: EmailElement, field: string) =>
    updateElement(el, { coalesceKey: `${field}:${key_}` });

  switch (element.type) {
    case 'section':
      return <SectionStyles element={element} update={update} key_={key_} />;

    case 'row':
      return <RowStyles element={element} update={update} key_={key_} />;

    case 'column':
      return <ColumnStyles element={element} update={update} key_={key_} />;

    case 'heading':
    case 'paragraph':
    case 'list': {
      /*
        Every typographic control shows the *resolved* style — theme underneath,
        this block's own fields on top — so the panel always reads as what the
        canvas renders. `overrides` is what tells the fields which of those the
        block actually owns, and therefore which get a "use theme" reset.
      */
      const resolved = resolveTextStyle(element, settings);
      const overrides = overriddenFields(element);
      const scaleKey = typographyKeyFor(element);

      return (
        <>
          {element.type === 'heading' && (
            <FieldGroup label="Level">
              <SegmentedControl
                value={element.level}
                segments={HEADING_LEVELS.map((l) => ({
                  value: l,
                  label: l.toUpperCase(),
                }))}
                onChange={(level) => update({ ...element, level })}
              />
              <p className="mt-2 text-xs text-slate-500">
                Changing the level also changes which theme style it follows.
              </p>
            </FieldGroup>
          )}

          <FieldGroup label="Text">
            <TextStyleFields
              value={resolved}
              overrides={overrides}
              coalesceScope={key_}
              onChange={(patch) => update({ ...element, ...patch })}
              onColorChange={(color) => updateColor({ ...element, color }, 'color')}
              onReset={(field) => update({ ...element, [field]: undefined })}
            />

            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                {overrides.length === 0
                  ? `Following the theme's ${TYPOGRAPHY_LABELS[scaleKey]} style.`
                  : `${overrides.length} field${
                      overrides.length === 1 ? '' : 's'
                    } set on this block.`}
              </p>
              {overrides.length > 0 && (
                <button
                  type="button"
                  onClick={() => update(clearTextOverrides(element))}
                  className="shrink-0 text-xs font-semibold text-accent-600 hover:underline"
                >
                  Reset all
                </button>
              )}
            </div>
          </FieldGroup>

          <AlignmentGroup
            value={element.textAlign}
            onChange={(textAlign) => update({ ...element, textAlign })}
            onReset={() => update({ ...element, textAlign: undefined })}
            hint={
              element.type === 'list'
                ? 'Centring or right-aligning a list moves its markers in with the text, so they travel with it.'
                : undefined
            }
          />

          {element.type === 'list' && (
            <FieldGroup label="Layout">
              <div className="space-y-3">
                <NumberStepper
                  label="Indent"
                  suffix="px"
                  min={0}
                  max={80}
                  value={element.indent}
                  onChange={(indent) => update({ ...element, indent })}
                />
                <NumberStepper
                  label="Gap between items"
                  suffix="px"
                  min={0}
                  max={40}
                  value={element.itemSpacing}
                  onChange={(itemSpacing) => update({ ...element, itemSpacing })}
                />
              </div>
            </FieldGroup>
          )}

          <MarginGroup
            top={element.marginTop}
            bottom={element.marginBottom}
            onChange={(next) => update({ ...element, ...next })}
          />
        </>
      );
    }

    case 'button':
      return (
        <>
          {/*
            "Fill", not "Background": the block's background is the shared
            group above, and this is the colour of the button itself.
          */}
          <FieldGroup label="Colours">
            <div className="space-y-3">
              <ColorField
                label="Button fill"
                value={element.bgColor}
                onChange={(bgColor) => updateColor({ ...element, bgColor }, 'bg')}
              />
              <ColorField
                label="Label"
                value={element.textColor}
                onChange={(textColor) =>
                  updateColor({ ...element, textColor }, 'fg')
                }
              />
            </div>
          </FieldGroup>

          <FieldGroup label="Shape">
            <div className="space-y-3">
              <NumberStepper
                label="Size"
                suffix="px"
                min={8}
                max={32}
                value={element.fontSize}
                onChange={(fontSize) => update({ ...element, fontSize })}
              />
              {/*
                The chip's own padding — what makes the button bigger than its
                label. The space *around* the button is the shared Padding group
                above, which is why these two say Y and X rather than sides.
              */}
              <div className="grid grid-cols-2 gap-3">
                <NumberStepper
                  label="Padding Y"
                  suffix="px"
                  min={0}
                  max={40}
                  value={element.paddingVertical}
                  onChange={(paddingVertical) =>
                    update({ ...element, paddingVertical })
                  }
                />
                <NumberStepper
                  label="Padding X"
                  suffix="px"
                  min={0}
                  max={80}
                  value={element.paddingHorizontal}
                  onChange={(paddingHorizontal) =>
                    update({ ...element, paddingHorizontal })
                  }
                />
              </div>
              <Checkbox
                checked={element.fontWeight === 'bold'}
                label="Bold label"
                onChange={(bold) =>
                  update({ ...element, fontWeight: bold ? 'bold' : 'normal' })
                }
              />
            </div>
          </FieldGroup>

          <FieldGroup label="Width">
            <ToggleSwitch
              checked={!!element.fullWidth}
              label="Full width"
              hint="Fills the section or column the button sits in."
              onChange={(fullWidth) =>
                // Stored only when on: absent is the default shrink-to-fit
                // button, and a saved file shouldn't gain a field for it.
                update({ ...element, fullWidth: fullWidth || undefined })
              }
            />
            {element.fullWidth && (
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Outlook's Word engine sizes full-width buttons in tenths of a
                percent, so it may land a pixel or two off the column's edge.
              </p>
            )}
          </FieldGroup>

          {/*
            No reset: a button's alignment is a required field on the cell that
            holds it, so there is no "inherit" state to go back to. A full-width
            button has nowhere to sit but where it is, so the control goes away
            rather than sitting there doing nothing — its label centres.
          */}
          {!element.fullWidth && (
            <AlignmentGroup
              value={element.alignment}
              onChange={(alignment) => update({ ...element, alignment })}
            />
          )}

          <MarginGroup
            top={element.marginTop}
            bottom={element.marginBottom}
            onChange={(next) => update({ ...element, ...next })}
          />
        </>
      );

    case 'image':
      return (
        <>
          <AlignmentGroup
            value={element.alignment}
            onChange={(alignment) => update({ ...element, alignment })}
          />

          <FieldGroup label="Spacing">
            <BoxSides
              label="Padding"
              sides={['top', 'bottom']}
              values={{ top: element.paddingTop, bottom: element.paddingBottom }}
              max={80}
              onChange={(next) =>
                update({
                  ...element,
                  ...(next.top !== undefined ? { paddingTop: next.top } : {}),
                  ...(next.bottom !== undefined
                    ? { paddingBottom: next.bottom }
                    : {}),
                })
              }
            />
          </FieldGroup>
        </>
      );

    case 'divider':
      return (
        <>
          <FieldGroup label="Line">
            <div className="space-y-3">
              <ColorField
                label="Colour"
                value={element.color}
                onChange={(color) => updateColor({ ...element, color }, 'color')}
              />
              <NumberStepper
                label="Thickness"
                suffix="px"
                min={1}
                max={20}
                value={element.height}
                onChange={(height) => update({ ...element, height })}
              />
              <SelectField
                label="Style"
                value={element.style}
                options={[
                  { value: 'solid', label: 'Solid' },
                  { value: 'dashed', label: 'Dashed' },
                  { value: 'dotted', label: 'Dotted' },
                ]}
                onChange={(style) => update({ ...element, style })}
              />
            </div>
          </FieldGroup>

          <MarginGroup
            top={element.marginTop}
            bottom={element.marginBottom}
            onChange={(next) => update({ ...element, ...next })}
          />
        </>
      );

    case 'quote': {
      return (
        <>
          {/* The fill is the shared Background group above — a quote's is its
              own `bgColor`, which is why only the text colour is left here. */}
          <FieldGroup label="Text colour">
            <ColorField
              value={element.textColor}
              onChange={(textColor) =>
                updateColor({ ...element, textColor }, 'fg')
              }
            />
          </FieldGroup>

          <FieldGroup label="Text">
            <div className="space-y-3">
              <NumberStepper
                label="Size"
                suffix="px"
                min={8}
                max={48}
                value={element.fontSize}
                onChange={(fontSize) => update({ ...element, fontSize })}
              />
              <EmphasisToggles
                bold={(element.fontWeight ?? 'normal') === 'bold'}
                italic={(element.fontStyle ?? 'italic') === 'italic'}
                onChange={({ bold, italic }) =>
                  update({
                    ...element,
                    fontWeight: bold ? 'bold' : 'normal',
                    fontStyle: italic ? 'italic' : 'normal',
                  })
                }
              />
            </div>
          </FieldGroup>

          <AlignmentGroup
            value={element.textAlign}
            onChange={(textAlign) => update({ ...element, textAlign })}
            onReset={() => update({ ...element, textAlign: undefined })}
          />

          <MarginGroup
            top={element.marginTop}
            bottom={element.marginBottom}
            onChange={(next) => update({ ...element, ...next })}
          />
        </>
      );
    }

    case 'spacer':
    case 'custom-html':
      // Nothing beyond the background and padding above — a spacer is otherwise
      // its height (Content tab), and raw HTML carries whatever styling its
      // author wrote (Code tab).
      return (
        <FieldGroup>
          <p className="text-sm text-slate-500">
            {element.type === 'spacer'
              ? 'A spacer is a coloured band or empty space — its height is on the Content tab.'
              : 'This block is raw HTML. Everything else about it is on the Code tab.'}
          </p>
        </FieldGroup>
      );
  }
};

/**
 * The Styles tab: the four controls every block has — its fill, the space
 * inside it, its border and how far its corners are rounded — then whatever
 * this type adds.
 *
 * All four are rendered here rather than in each arm, so they sit in the same
 * place on every type, and so a type added later gets them without anyone
 * remembering to. They run in the order the box is built: the fill, how far it
 * stands off the content, what encloses it, and how that corner is cut.
 */
export const StylesTab: React.FC<{ element: EmailElement }> = ({ element }) => (
  <>
    <BackgroundGroup element={element} />
    <PaddingGroup element={element} />
    <BorderGroup element={element} />
    <RoundedCornersGroup element={element} />
    <TypeStyles element={element} />
  </>
);
