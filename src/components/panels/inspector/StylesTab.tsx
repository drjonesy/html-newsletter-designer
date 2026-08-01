import React from 'react';
import { Bold, Italic, Scan } from 'lucide-react';
import {
  ColumnElement,
  EmailElement,
  RowElement,
  SectionElement,
} from '../../../types';
import {
  createColumns,
  evenWidths,
  blockName,
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

const SectionStyles: React.FC<EditorProps<SectionElement>> = ({
  element,
  update,
  key_,
}) => {
  const { updateElement } = useDesigner();

  return (
    <>
      <FieldGroup label="Block background color">
        <ColorField
          clearable
          value={element.bgColor}
          fallback="#f8fafc"
          onChange={(bgColor) =>
            updateElement({ ...element, bgColor }, { coalesceKey: `bg:${key_}` })
          }
        />
      </FieldGroup>

      <FieldGroup label="Border">
        <BorderEditor
          widths={{
            top: element.borderTopWidth,
            right: element.borderRightWidth,
            bottom: element.borderBottomWidth,
            left: element.borderLeftWidth,
          }}
          style={element.borderStyle}
          color={element.borderColor}
          onWidths={(next) =>
            update({
              ...element,
              ...(next.top !== undefined ? { borderTopWidth: next.top } : {}),
              ...(next.right !== undefined
                ? { borderRightWidth: next.right }
                : {}),
              ...(next.bottom !== undefined
                ? { borderBottomWidth: next.bottom }
                : {}),
              ...(next.left !== undefined ? { borderLeftWidth: next.left } : {}),
            })
          }
          onStyle={(borderStyle) => update({ ...element, borderStyle })}
          onColor={(borderColor) =>
            updateElement(
              { ...element, borderColor },
              { coalesceKey: `border:${key_}` }
            )
          }
        />
      </FieldGroup>

      <FieldGroup label="Rounded corners">
        <NumberStepper
          value={element.borderRadius}
          min={0}
          max={40}
          icon={<Scan className="h-4 w-4" />}
          onChange={(borderRadius) => update({ ...element, borderRadius })}
        />
        <p className="mt-2 text-xs text-slate-500">
          Ignored by Outlook's Word engine — corners stay square there. Harmless
          everywhere else.
        </p>
      </FieldGroup>

      <FieldGroup label="Padding">
        <BoxSides
          label="Padding"
          values={{
            top: element.paddingTop,
            right: element.paddingRight,
            bottom: element.paddingBottom,
            left: element.paddingLeft,
          }}
          max={100}
          onChange={(next) =>
            update({
              ...element,
              ...(next.top !== undefined ? { paddingTop: next.top } : {}),
              ...(next.right !== undefined ? { paddingRight: next.right } : {}),
              ...(next.bottom !== undefined
                ? { paddingBottom: next.bottom }
                : {}),
              ...(next.left !== undefined ? { paddingLeft: next.left } : {}),
            })
          }
        />
      </FieldGroup>

      <MarginGroup
        top={element.marginTop}
        bottom={element.marginBottom}
        onChange={(next) => update({ ...element, ...next })}
      />

      <FieldGroup>
        <p className="text-xs leading-relaxed text-slate-500">
          A section with no border, padding, margin or fill emits nothing of its
          own — only its blocks. That's what lets you group content without
          adding a byte to the email.
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
            Padding, fill and an exact width live on the column itself.
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

const ColumnStyles: React.FC<EditorProps<ColumnElement>> = ({
  element,
  update,
  key_,
}) => {
  const { updateElement } = useDesigner();

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

      <FieldGroup label="Column background color">
        <ColorField
          clearable
          value={element.bgColor}
          fallback="#f8fafc"
          onChange={(bgColor) =>
            updateElement({ ...element, bgColor }, { coalesceKey: `bg:${key_}` })
          }
        />
      </FieldGroup>

      {/*
        The same border control a section gets, because a one-column row is the
        general-purpose box — it's what "1 Column" in the palette makes.
      */}
      <FieldGroup label="Border">
        <BorderEditor
          widths={{
            top: element.borderTopWidth,
            right: element.borderRightWidth,
            bottom: element.borderBottomWidth,
            left: element.borderLeftWidth,
          }}
          style={element.borderStyle}
          color={element.borderColor}
          onWidths={(next) =>
            update({
              ...element,
              ...(next.top !== undefined ? { borderTopWidth: next.top } : {}),
              ...(next.right !== undefined
                ? { borderRightWidth: next.right }
                : {}),
              ...(next.bottom !== undefined
                ? { borderBottomWidth: next.bottom }
                : {}),
              ...(next.left !== undefined ? { borderLeftWidth: next.left } : {}),
            })
          }
          onStyle={(borderStyle) => update({ ...element, borderStyle })}
          onColor={(borderColor) =>
            updateElement(
              { ...element, borderColor },
              { coalesceKey: `border:${key_}` }
            )
          }
        />
      </FieldGroup>

      <FieldGroup label="Rounded corners">
        <NumberStepper
          value={element.borderRadius}
          min={0}
          max={40}
          icon={<Scan className="h-4 w-4" />}
          onChange={(borderRadius) => update({ ...element, borderRadius })}
        />
      </FieldGroup>

      <FieldGroup label="Padding">
        <BoxSides
          label="Padding"
          values={{
            top: element.paddingTop,
            right: element.paddingRight,
            bottom: element.paddingBottom,
            left: element.paddingLeft,
          }}
          max={60}
          onChange={(next) =>
            update({
              ...element,
              ...(next.top !== undefined ? { paddingTop: next.top } : {}),
              ...(next.right !== undefined ? { paddingRight: next.right } : {}),
              ...(next.bottom !== undefined
                ? { paddingBottom: next.bottom }
                : {}),
              ...(next.left !== undefined ? { paddingLeft: next.left } : {}),
            })
          }
        />
      </FieldGroup>

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
 * Per-block appearance.
 *
 * One switch over the union, so `pnpm lint` fails loudly if a new element type
 * arrives without an editor — the same guard the generator and `createNewElement`
 * rely on.
 */
export const StylesTab: React.FC<{ element: EmailElement }> = ({ element }) => {
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
          <FieldGroup label="Colours">
            <div className="space-y-3">
              <ColorField
                label="Background"
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
              <NumberStepper
                label="Rounded corners"
                min={0}
                max={40}
                icon={<Scan className="h-4 w-4" />}
                value={element.borderRadius}
                onChange={(borderRadius) => update({ ...element, borderRadius })}
              />
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

          <FieldGroup label="Alignment">
            <SegmentedControl
              value={element.alignment}
              segments={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Centre' },
                { value: 'right', label: 'Right' },
              ]}
              onChange={(alignment) => update({ ...element, alignment })}
            />
          </FieldGroup>

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
          <FieldGroup label="Alignment">
            <SegmentedControl
              value={element.alignment}
              segments={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Centre' },
                { value: 'right', label: 'Right' },
              ]}
              onChange={(alignment) => update({ ...element, alignment })}
            />
          </FieldGroup>

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
      /*
        Mirrors `quoteBorderWidths` in the generator: all four absent means a
        quote saved before the sides were configurable, which drew a 4px left
        rule. Showing 0s here would tell the author their accent bar is off
        while the export still draws it.
      */
      const unset =
        element.borderTopWidth === undefined &&
        element.borderRightWidth === undefined &&
        element.borderBottomWidth === undefined &&
        element.borderLeftWidth === undefined;
      const quoteWidths: Record<Side, number> = unset
        ? { top: 0, right: 0, bottom: 0, left: 4 }
        : {
            top: element.borderTopWidth ?? 0,
            right: element.borderRightWidth ?? 0,
            bottom: element.borderBottomWidth ?? 0,
            left: element.borderLeftWidth ?? 0,
          };

      return (
        <>
          <FieldGroup label="Border">
            <BorderEditor
              widths={quoteWidths}
              style={element.borderStyle ?? 'solid'}
              color={element.borderColor}
              onWidths={(next) =>
                update({
                  ...element,
                  // Write all four, never a partial patch: a legacy quote has
                  // none of them, and leaving three undefined would keep it on
                  // the "unset" path and snap the border back to left-only.
                  borderTopWidth: next.top ?? quoteWidths.top,
                  borderRightWidth: next.right ?? quoteWidths.right,
                  borderBottomWidth: next.bottom ?? quoteWidths.bottom,
                  borderLeftWidth: next.left ?? quoteWidths.left,
                  borderStyle: element.borderStyle ?? 'solid',
                })
              }
              onStyle={(borderStyle) => update({ ...element, borderStyle })}
              onColor={(borderColor) =>
                updateColor({ ...element, borderColor }, 'border')
              }
            />
          </FieldGroup>

          <FieldGroup label="Colours">
            <div className="space-y-3">
              <ColorField
                label="Background"
                value={element.bgColor}
                clearable
                onChange={(bgColor) => updateColor({ ...element, bgColor }, 'bg')}
              />
              <ColorField
                label="Text"
                value={element.textColor}
                onChange={(textColor) =>
                  updateColor({ ...element, textColor }, 'fg')
                }
              />
            </div>
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
      // Nothing to style — a spacer is its height (Content tab), and raw HTML
      // carries whatever styling its author wrote (Code tab).
      return (
        <FieldGroup>
          <p className="text-sm text-slate-500">
            {element.type === 'spacer'
              ? 'A spacer has no styling beyond its height — see the Content tab.'
              : 'This block is raw HTML. Edit it on the Code tab.'}
          </p>
        </FieldGroup>
      );
  }
};
