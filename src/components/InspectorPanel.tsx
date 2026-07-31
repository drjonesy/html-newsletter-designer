import React, { useEffect, useRef, useState } from 'react';
import {
  EmailElement,
  HeadingLevel,
  ListElement,
  ListMarker,
  SectionElement,
} from '../types';
import { renderElementToHtml } from '../utils/htmlGenerator';
import { isContainerElement } from '../utils/elementHelpers';
import { RichTextField } from './RichTextField';
import {
  X,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Trash2,
  Copy,
  Upload,
  Bold,
  Italic,
  Code2,
  SlidersHorizontal,
  AlertTriangle,
  Undo2,
  RotateCcw,
  Check,
  Square,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Plus,
} from 'lucide-react';

export type InspectorTab = 'design' | 'html';

/** "key-value" -> "Key Value", for use in prose. */
function typeLabel(type: EmailElement['type']): string {
  return type
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface TextStyleTogglesProps {
  bold: boolean;
  italic: boolean;
  onChange: (next: { bold: boolean; italic: boolean }) => void;
  label?: string;
}

/** Shared Bold (<strong>) / Italic (<em>) toggle pair used by every text block. */
const TextStyleToggles: React.FC<TextStyleTogglesProps> = ({
  bold,
  italic,
  onChange,
  label = 'Text Style',
}) => {
  const baseClass =
    'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border text-[11px] transition-colors';
  const activeClass = 'bg-red-700 border-red-700 text-white';
  const idleClass =
    'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-200';

  return (
    <div className="space-y-1">
      <label className="font-semibold text-slate-700">{label}</label>
      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={bold}
          onClick={() => onChange({ bold: !bold, italic })}
          className={`${baseClass} ${bold ? activeClass : idleClass}`}
          title="Bold / Strong"
        >
          <Bold className="w-3.5 h-3.5" />
          <span className="font-bold">Bold</span>
        </button>
        <button
          type="button"
          aria-pressed={italic}
          onClick={() => onChange({ bold, italic: !italic })}
          className={`${baseClass} ${italic ? activeClass : idleClass}`}
          title="Italic / Emphasis"
        >
          <Italic className="w-3.5 h-3.5" />
          <span className="italic font-semibold">Italic</span>
        </button>
      </div>
    </div>
  );
};

interface ElementHtmlEditorProps {
  element: EmailElement;
  fontFamily: string;
  onUpdateElement: (updated: EmailElement) => void;
  onBackToDesign: () => void;
}

/**
 * The Inspector's HTML tab: shows the markup this block emits, and lets it be
 * hand-edited.
 *
 * Saving hand-edited markup on a typed block converts it to a `custom-html`
 * element — arbitrary HTML can't be parsed back into typed fields like
 * `fontSize` or `alignment`. The element it replaced is stashed on
 * `convertedFrom` so the conversion can be undone.
 *
 * Mount this with `key={element.id}` so the draft resets when the selection
 * changes.
 */
const ElementHtmlEditor: React.FC<ElementHtmlEditorProps> = ({
  element,
  fontFamily,
  onUpdateElement,
  onBackToDesign,
}) => {
  const isRawBlock = element.type === 'custom-html';
  const source = isRawBlock
    ? element.html
    : renderElementToHtml(element, fontFamily);

  const [draft, setDraft] = useState(source);
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);

  // Keep mirroring the generator until the user starts typing — edits made in
  // the Design tab should show up here live.
  useEffect(() => {
    if (!dirty) setDraft(source);
  }, [source, dirty]);

  const revertTarget =
    element.type === 'custom-html' ? element.convertedFrom : undefined;

  const handleCopy = () => {
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (isRawBlock) {
      onUpdateElement({ ...element, html: draft });
    } else {
      onUpdateElement({
        id: element.id,
        type: 'custom-html',
        label: element.label ?? `${typeLabel(element.type)} (HTML)`,
        html: draft,
        convertedFrom: element,
      });
    }
    setDirty(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <label className="font-semibold text-slate-700">
          {isRawBlock ? 'Raw HTML Code' : `Generated HTML — ${typeLabel(element.type)}`}
        </label>
        <div className="flex items-center gap-1">
          {dirty && (
            <button
              type="button"
              onClick={() => {
                setDraft(source);
                setDirty(false);
              }}
              className="flex items-center gap-1 px-1.5 py-1 rounded border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px]"
              title="Discard edits and regenerate from the Design tab"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-1.5 py-1 rounded border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px]"
            title="Copy this block's HTML"
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-600" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <textarea
        spellCheck={false}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setDirty(e.target.value !== source);
        }}
        className="w-full h-72 bg-slate-900 font-mono text-[11px] leading-relaxed text-slate-100 border border-slate-800 rounded p-2 focus:ring-1 focus:ring-red-500 resize-y"
      />

      {!isRawBlock && !dirty && (
        <p className="text-[11px] text-slate-500">
          This markup is generated from the Design tab. Edit it here to take
          manual control of the block.
        </p>
      )}

      {!isRawBlock && dirty && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-2">
          <p className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Saving converts this block
          </p>
          <p className="text-[11px] leading-relaxed">
            This {typeLabel(element.type)} block becomes a raw HTML block holding
            your code. Its design controls stop applying
            {isContainerElement(element)
              ? ', and its child elements are flattened into this markup'
              : ''}
            . You can revert afterwards.
          </p>
        </div>
      )}

      {isRawBlock && dirty && (
        <p className="text-[11px] text-slate-500">
          Unsaved changes. This block already stores raw HTML, so saving just
          updates it.
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={!dirty}
        className={`w-full flex items-center justify-center gap-1.5 rounded p-2 font-bold transition-colors ${
          dirty
            ? 'bg-red-700 hover:bg-red-800 text-white cursor-pointer'
            : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
        }`}
      >
        <Code2 className="w-3.5 h-3.5" />
        {isRawBlock ? 'Save HTML' : 'Save as HTML Block'}
      </button>

      {revertTarget && (
        <div className="pt-3 border-t border-slate-200 space-y-2">
          <p className="text-[11px] text-slate-500">
            Converted from a {typeLabel(revertTarget.type)} block. Reverting
            restores its design controls and discards the code above.
          </p>
          <button
            type="button"
            onClick={() => {
              onUpdateElement(revertTarget);
              onBackToDesign();
            }}
            className="w-full flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded p-2 font-semibold cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5 text-red-700" />
            Revert to {typeLabel(revertTarget.type)} Block
          </button>
        </div>
      )}
    </div>
  );
};

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
type Side = (typeof SIDES)[number];
type BoxValues = Record<Side, number>;

interface BoxSideInputsProps {
  label: string;
  hint?: string;
  values: BoxValues;
  onChange: (values: BoxValues) => void;
}

/**
 * Four per-side number inputs (top / right / bottom / left) with a link toggle
 * that drives all four together. Starts linked when the sides already match, so
 * the common "same all round" case stays one field to edit.
 */
const BoxSideInputs: React.FC<BoxSideInputsProps> = ({
  label,
  hint,
  values,
  onChange,
}) => {
  const [linked, setLinked] = useState(() =>
    SIDES.every((side) => values[side] === values.top)
  );

  const set = (side: Side, raw: string) => {
    const next = Math.max(0, Number(raw) || 0);
    onChange(
      linked
        ? { top: next, right: next, bottom: next, left: next }
        : { ...values, [side]: next }
    );
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="font-semibold text-slate-700">{label}</label>
        <button
          type="button"
          aria-pressed={linked}
          onClick={() => {
            // Linking up adopts the top value so the four don't disagree.
            if (!linked) {
              onChange({
                top: values.top,
                right: values.top,
                bottom: values.top,
                left: values.top,
              });
            }
            setLinked(!linked);
          }}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold transition-colors ${
            linked
              ? 'bg-red-700 border-red-700 text-white'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-200'
          }`}
          title={linked ? 'Editing all four sides together' : 'Editing each side separately'}
        >
          {linked ? (
            <Link2 className="w-3 h-3" />
          ) : (
            <Link2Off className="w-3 h-3" />
          )}
          {linked ? 'All sides' : 'Per side'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {SIDES.map((side) => (
          <div key={side} className="space-y-0.5">
            <label className="block text-[10px] uppercase tracking-wide text-slate-500 font-semibold text-center">
              {side.charAt(0)}
            </label>
            <input
              type="number"
              min={0}
              value={values[side]}
              onChange={(e) => set(side, e.target.value)}
              className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-1.5 text-center focus:ring-1 focus:ring-red-500"
            />
          </div>
        ))}
      </div>

      {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
    </div>
  );
};

/** One-click border layouts, since "just a left rule" is the common case. */
const BORDER_PRESETS: { label: string; sides: Side[] }[] = [
  { label: 'All', sides: ['top', 'right', 'bottom', 'left'] },
  { label: 'None', sides: [] },
  { label: 'Left', sides: ['left'] },
  { label: 'Right', sides: ['right'] },
  { label: 'Top', sides: ['top'] },
  { label: 'Bottom', sides: ['bottom'] },
];

/**
 * Reminder that blocks come from the palette, not from here.
 *
 * The Inspector used to carry a grid of "+ Heading / + Paragraph" buttons;
 * they duplicated the palette and gave the section two different ways to be
 * filled. Dragging from the palette is now the one way in.
 */
const FillSectionHint: React.FC = () => (
  <div className="pt-2 border-t border-slate-200">
    <p className="text-[11px] text-slate-500 leading-relaxed">
      Drag elements from the <strong>Add Elements</strong> panel onto this
      section to fill it. While it's selected you can also just click them.
    </p>
  </div>
);

interface SectionEditorProps {
  element: SectionElement;
  onUpdateElement: (updated: EmailElement) => void;
}

const SectionEditor: React.FC<SectionEditorProps> = ({
  element,
  onUpdateElement,
}) => {
  const hasBg = element.bgColor !== 'transparent';

  const borderWidths: BoxValues = {
    top: element.borderTopWidth,
    right: element.borderRightWidth,
    bottom: element.borderBottomWidth,
    left: element.borderLeftWidth,
  };

  const padding: BoxValues = {
    top: element.paddingTop,
    right: element.paddingRight,
    bottom: element.paddingBottom,
    left: element.paddingLeft,
  };

  const setBorderWidths = (values: BoxValues) =>
    onUpdateElement({
      ...element,
      borderTopWidth: values.top,
      borderRightWidth: values.right,
      borderBottomWidth: values.bottom,
      borderLeftWidth: values.left,
    });

  const applyPreset = (sides: Side[]) => {
    // Reuse whatever weight is already in play so a preset changes which sides
    // show, not how heavy they are.
    const weight = Math.max(1, ...SIDES.map((side) => borderWidths[side]));
    setBorderWidths({
      top: sides.includes('top') ? weight : 0,
      right: sides.includes('right') ? weight : 0,
      bottom: sides.includes('bottom') ? weight : 0,
      left: sides.includes('left') ? weight : 0,
    });
  };

  return (
    <div className="space-y-3">
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs">
        <p className="font-bold mb-1 flex items-center gap-1.5 text-slate-800">
          <Square className="w-3.5 h-3.5 text-red-700" />
          Section Container
        </p>
        <p className="text-[11px] leading-relaxed">
          A box that holds other blocks. Give each side its own border weight —
          set a side to 0 to hide it — and its own padding.
        </p>
      </div>

      <div className="space-y-1">
        <label className="font-semibold text-slate-700">Section Name</label>
        <input
          type="text"
          value={element.label || ''}
          onChange={(e) => onUpdateElement({ ...element, label: e.target.value })}
          placeholder="Section"
          className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 focus:ring-1 focus:ring-red-500 font-semibold"
        />
        <p className="text-[10px] text-slate-500">
          Labels this block on the canvas only — it isn't exported.
        </p>
      </div>

      {/* Which sides show a border */}
      <div className="space-y-1.5">
        <label className="font-semibold text-slate-700 block">Show Borders On</label>
        <div className="grid grid-cols-3 gap-1.5">
          {BORDER_PRESETS.map((preset) => {
            const active = SIDES.every(
              (side) => borderWidths[side] > 0 === preset.sides.includes(side)
            );
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.sides)}
                aria-pressed={active}
                className={`px-2 py-1.5 rounded border text-[11px] font-semibold transition-colors ${
                  active
                    ? 'bg-red-700 border-red-700 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <BoxSideInputs
        label="Border Width (px)"
        hint="0 hides that side entirely."
        values={borderWidths}
        onChange={setBorderWidths}
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="font-semibold text-slate-700">Border Style</label>
          <select
            value={element.borderStyle}
            onChange={(e) =>
              onUpdateElement({
                ...element,
                borderStyle: e.target.value as SectionElement['borderStyle'],
              })
            }
            className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="font-semibold text-slate-700">Corner Radius (px)</label>
          <input
            type="number"
            min={0}
            value={element.borderRadius}
            onChange={(e) =>
              onUpdateElement({
                ...element,
                borderRadius: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="font-semibold text-slate-700 flex justify-between">
          <span>Border Color</span>
          <span className="font-mono text-slate-500">{element.borderColor}</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={element.borderColor}
            onChange={(e) =>
              onUpdateElement({ ...element, borderColor: e.target.value })
            }
            className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
          />
          <button
            type="button"
            onClick={() => onUpdateElement({ ...element, borderColor: '#b22222' })}
            className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-slate-700 font-semibold"
          >
            Gmail Red
          </button>
          <button
            type="button"
            onClick={() => onUpdateElement({ ...element, borderColor: '#cbd5e1' })}
            className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-slate-700 font-semibold"
          >
            Light Grey
          </button>
        </div>
      </div>

      <BoxSideInputs
        label="Padding (px)"
        hint="Space between the border and the blocks inside."
        values={padding}
        onChange={(values) =>
          onUpdateElement({
            ...element,
            paddingTop: values.top,
            paddingRight: values.right,
            paddingBottom: values.bottom,
            paddingLeft: values.left,
          })
        }
      />

      {/* Background fill — a colour input can't express "no fill", so it's a toggle */}
      <div className="space-y-1">
        <label className="font-semibold text-slate-700 flex justify-between items-center">
          <span>Background Fill</span>
          <span className="font-mono text-slate-500">
            {hasBg ? element.bgColor : 'none'}
          </span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            disabled={!hasBg}
            value={hasBg ? element.bgColor : '#f8fafc'}
            onChange={(e) => onUpdateElement({ ...element, bgColor: e.target.value })}
            className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer disabled:opacity-40"
          />
          <button
            type="button"
            onClick={() =>
              onUpdateElement({
                ...element,
                bgColor: hasBg ? 'transparent' : '#f8fafc',
              })
            }
            className={`text-[10px] px-2 py-1 rounded border font-semibold transition-colors ${
              hasBg
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                : 'bg-red-700 border-red-700 text-white'
            }`}
          >
            {hasBg ? 'Remove fill' : 'No fill'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="font-semibold text-slate-700">Space Above (px)</label>
          <input
            type="number"
            min={0}
            value={element.marginTop}
            onChange={(e) =>
              onUpdateElement({
                ...element,
                marginTop: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
          />
        </div>
        <div className="space-y-1">
          <label className="font-semibold text-slate-700">Space Below (px)</label>
          <input
            type="number"
            min={0}
            value={element.marginBottom}
            onChange={(e) =>
              onUpdateElement({
                ...element,
                marginBottom: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
          />
        </div>
      </div>

      <FillSectionHint />
    </div>
  );
};

/** Marker styles that suit each kind of list, in the order they're offered. */
const BULLET_MARKERS: { value: ListMarker; label: string }[] = [
  { value: 'disc', label: '●  Filled' },
  { value: 'circle', label: '○  Hollow' },
  { value: 'square', label: '■  Square' },
  { value: 'none', label: 'No marker' },
];

const NUMBER_MARKERS: { value: ListMarker; label: string }[] = [
  { value: 'decimal', label: '1.  2.  3.' },
  { value: 'lower-alpha', label: 'a.  b.  c.' },
  { value: 'upper-alpha', label: 'A.  B.  C.' },
  { value: 'lower-roman', label: 'i.  ii.  iii.' },
  { value: 'upper-roman', label: 'I.  II.  III.' },
  { value: 'none', label: 'No marker' },
];

interface ListEditorProps {
  element: ListElement;
  onUpdateElement: (updated: EmailElement) => void;
}

/**
 * Controls for a bulleted or numbered list.
 *
 * The item rows hold raw HTML on purpose — an item edited on the canvas can
 * carry `<strong>`, `<em>` or a coloured `<span>`, and this is where that
 * markup can be seen and corrected. Adding and removing items is here as well
 * as on the canvas, because a list that has been emptied down to its last row
 * can't grow itself back from a keystroke.
 */
const ListEditor: React.FC<ListEditorProps> = ({ element, onUpdateElement }) => {
  const items = element.items || [];
  const markers = element.ordered ? NUMBER_MARKERS : BULLET_MARKERS;

  const setItems = (next: string[]) => onUpdateElement({ ...element, items: next });

  const setOrdered = (ordered: boolean) =>
    onUpdateElement({
      ...element,
      ordered,
      // A bullet style means nothing on a numbered list and vice versa, so the
      // marker falls back to that kind's default when it no longer applies.
      marker: (ordered ? NUMBER_MARKERS : BULLET_MARKERS).some(
        (m) => m.value === element.marker
      )
        ? element.marker
        : ordered
        ? 'decimal'
        : 'disc',
    });

  const kindClass = (active: boolean) =>
    `flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border text-[11px] font-semibold transition-colors ${
      active
        ? 'bg-red-700 border-red-700 text-white'
        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-200'
    }`;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={!element.ordered}
          onClick={() => setOrdered(false)}
          className={kindClass(!element.ordered)}
        >
          <List className="w-3.5 h-3.5" />
          Bulleted
        </button>
        <button
          type="button"
          aria-pressed={element.ordered}
          onClick={() => setOrdered(true)}
          className={kindClass(element.ordered)}
        >
          <ListOrdered className="w-3.5 h-3.5" />
          Numbered
        </button>
      </div>

      <div className="space-y-1">
        <label className="font-semibold text-slate-700">Marker Style</label>
        <select
          value={element.marker}
          onChange={(e) =>
            onUpdateElement({ ...element, marker: e.target.value as ListMarker })
          }
          className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
        >
          {markers.map((marker) => (
            <option key={marker.value} value={marker.value}>
              {marker.label}
            </option>
          ))}
        </select>
      </div>

      {/* Items */}
      <div className="space-y-1.5">
        <label className="font-semibold text-slate-700 block">
          Items{' '}
          <span className="font-normal text-slate-400">({items.length})</span>
        </label>

        {items.length === 0 && (
          <p className="text-[11px] text-slate-500">
            This list is empty. Add an item below, or click the list on the
            canvas and start typing.
          </p>
        )}

        <div className="space-y-1.5">
          {items.map((item, index) => (
            <div key={index} className="flex items-start gap-1">
              <span className="w-4 pt-2 text-[10px] font-mono text-slate-400 text-right shrink-0">
                {element.ordered ? index + 1 : '•'}
              </span>
              <input
                type="text"
                value={item}
                onChange={(e) => {
                  const next = [...items];
                  next[index] = e.target.value;
                  setItems(next);
                }}
                placeholder="List item"
                className="flex-1 min-w-0 bg-slate-50 text-slate-800 border border-slate-200 rounded p-1.5 focus:ring-1 focus:ring-red-500"
              />
              <button
                type="button"
                onClick={() => setItems(items.filter((_, i) => i !== index))}
                className="p-1.5 text-slate-400 hover:text-red-700 shrink-0"
                title="Remove this item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setItems([...items, ''])}
          className="w-full flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded p-1.5 font-semibold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-red-700" />
          Add Item
        </button>
        <p className="text-[10px] text-slate-500">
          Items accept HTML. On the canvas, select text to format it — Enter
          starts the next item.
        </p>
      </div>

      <TextStyleToggles
        label="Whole List Style"
        bold={(element.fontWeight ?? 'normal') === 'bold'}
        italic={(element.fontStyle ?? 'normal') === 'italic'}
        onChange={({ bold, italic }) =>
          onUpdateElement({
            ...element,
            fontWeight: bold ? 'bold' : 'normal',
            fontStyle: italic ? 'italic' : 'normal',
          })
        }
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="font-semibold text-slate-700">Font Size (px)</label>
          <input
            type="number"
            value={element.fontSize}
            onChange={(e) =>
              onUpdateElement({ ...element, fontSize: Number(e.target.value) })
            }
            className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
          />
        </div>
        <div className="space-y-1">
          <label className="font-semibold text-slate-700">Line Height</label>
          <input
            type="number"
            step="0.1"
            value={element.lineHeight}
            onChange={(e) =>
              onUpdateElement({ ...element, lineHeight: Number(e.target.value) })
            }
            className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="font-semibold text-slate-700">Indent (px)</label>
          <input
            type="number"
            min={0}
            value={element.indent}
            onChange={(e) =>
              onUpdateElement({
                ...element,
                indent: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
          />
        </div>
        <div className="space-y-1">
          <label className="font-semibold text-slate-700">Item Gap (px)</label>
          <input
            type="number"
            min={0}
            value={element.itemSpacing}
            onChange={(e) =>
              onUpdateElement({
                ...element,
                itemSpacing: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="font-semibold text-slate-700 flex justify-between">
          <span>Text Color</span>
          <span className="font-mono text-slate-500">{element.color}</span>
        </label>
        <input
          type="color"
          value={element.color}
          onChange={(e) => onUpdateElement({ ...element, color: e.target.value })}
          className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="font-semibold text-slate-700">Space Above (px)</label>
          <input
            type="number"
            min={0}
            value={element.marginTop}
            onChange={(e) =>
              onUpdateElement({
                ...element,
                marginTop: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
          />
        </div>
        <div className="space-y-1">
          <label className="font-semibold text-slate-700">Space Below (px)</label>
          <input
            type="number"
            min={0}
            value={element.marginBottom}
            onChange={(e) =>
              onUpdateElement({
                ...element,
                marginBottom: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
          />
        </div>
      </div>
    </div>
  );
};

interface InspectorPanelProps {
  element: EmailElement | null;
  onUpdateElement: (updated: EmailElement) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onClose: () => void;
  /** Font stack used to generate this element's HTML in the HTML tab. */
  fontFamily: string;
  activeTab: InspectorTab;
  onChangeTab: (tab: InspectorTab) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  element,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onMoveUp,
  onMoveDown,
  onClose,
  fontFamily,
  activeTab,
  onChangeTab,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const paragraphRef = useRef<HTMLTextAreaElement | null>(null);
  // Hand-authoring the markup is still possible, just no longer the default —
  // see the paragraph editor below.
  const [showParagraphSource, setShowParagraphSource] = useState(false);

  if (!element) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && element.type === 'image') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          onUpdateElement({
            ...element,
            src: evt.target.result as string,
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * Wraps the text currently selected in the content textarea. With no selection
   * the tags are inserted at the caret so the user can type between them.
   */
  const insertTagToParagraph = (openTag: string, closeTag: string) => {
    if (element.type !== 'paragraph') return;

    const textarea = paragraphRef.current;
    const content = element.content;
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? content.length;
    const selected = content.slice(start, end);

    const inserted = `${openTag}${selected}${closeTag}`;
    onUpdateElement({
      ...element,
      content: content.slice(0, start) + inserted + content.slice(end),
    });

    // Put the caret back inside the new tags after React re-renders.
    const caret = start + openTag.length + selected.length;
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + openTag.length, caret);
    });
  };

  return (
    <div className="w-full lg:w-80 bg-white border-l border-slate-200 flex flex-col h-full text-slate-800 z-30 shadow-md">
      {/* Panel Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Edit Element Properties
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMoveUp(element.id)}
            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors"
            title="Move Up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => onMoveDown(element.id)}
            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors"
            title="Move Down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDuplicateElement(element.id)}
            className="p-1 text-slate-500 hover:text-amber-600 hover:bg-slate-200/60 rounded transition-colors"
            title="Duplicate Block"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeleteElement(element.id)}
            className="p-1 text-slate-500 hover:text-red-600 hover:bg-slate-200/60 rounded transition-colors"
            title="Delete Block"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Design / HTML Tabs */}
      <div className="flex items-stretch border-b border-slate-200 bg-white px-2">
        {(
          [
            { id: 'design' as const, label: 'Design', Icon: SlidersHorizontal },
            { id: 'html' as const, label: 'HTML', Icon: Code2 },
          ]
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChangeTab(id)}
            aria-pressed={activeTab === id}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-wide border-b-2 -mb-px transition-colors ${
              activeTab === id
                ? 'border-red-700 text-red-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'html' ? (
        <ElementHtmlEditor
          key={element.id}
          element={element}
          fontFamily={fontFamily}
          onUpdateElement={onUpdateElement}
          onBackToDesign={() => onChangeTab('design')}
        />
      ) : (
      /* Editor Controls Form */
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Image Editor */}
        {element.type === 'image' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Image Source (URL or File)</label>
              <input
                type="text"
                value={element.src}
                onChange={(e) => onUpdateElement({ ...element, src: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 focus:ring-1 focus:ring-red-500 font-mono text-[11px]"
                placeholder="https://..."
              />
              <div className="pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded p-2 font-semibold cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-red-700" />
                  <span>Upload Image File</span>
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Alt Text</label>
              <input
                type="text"
                value={element.alt}
                onChange={(e) => onUpdateElement({ ...element, alt: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Width (px)</label>
                <input
                  type="number"
                  value={element.width}
                  onChange={(e) =>
                    onUpdateElement({ ...element, width: Number(e.target.value) })
                  }
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Alignment</label>
                <select
                  value={element.alignment}
                  onChange={(e) =>
                    onUpdateElement({
                      ...element,
                      alignment: e.target.value as 'left' | 'center' | 'right',
                    })
                  }
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 focus:ring-1 focus:ring-red-500"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Link URL (Optional)</label>
              <input
                type="text"
                value={element.href || ''}
                onChange={(e) => onUpdateElement({ ...element, href: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 focus:ring-1 focus:ring-red-500 font-mono text-[11px]"
                placeholder="https://..."
              />
            </div>
          </div>
        )}

        {/* Heading Editor */}
        {element.type === 'heading' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Heading Text</label>
              <input
                type="text"
                value={element.text}
                onChange={(e) => onUpdateElement({ ...element, text: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 focus:ring-1 focus:ring-red-500 text-sm font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Tag Level</label>
                <select
                  value={element.level}
                  onChange={(e) =>
                    onUpdateElement({
                      ...element,
                      level: e.target.value as HeadingLevel,
                    })
                  }
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
                >
                  <option value="h1">H1 (Largest)</option>
                  <option value="h2">H2</option>
                  <option value="h3">H3</option>
                  <option value="h4">H4</option>
                  <option value="h5">H5</option>
                  <option value="h6">H6 (Smallest)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Font Size (px)</label>
                <input
                  type="number"
                  value={element.fontSize}
                  onChange={(e) =>
                    onUpdateElement({ ...element, fontSize: Number(e.target.value) })
                  }
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
                />
              </div>
            </div>

            <TextStyleToggles
              bold={(element.fontWeight ?? 'bold') === 'bold'}
              italic={(element.fontStyle ?? 'normal') === 'italic'}
              onChange={({ bold, italic }) =>
                onUpdateElement({
                  ...element,
                  fontWeight: bold ? 'bold' : 'normal',
                  fontStyle: italic ? 'italic' : 'normal',
                })
              }
            />

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Text Transform</label>
              <select
                value={element.transform}
                onChange={(e) =>
                  onUpdateElement({
                    ...element,
                    transform: e.target.value as 'uppercase' | 'capitalize' | 'none',
                  })
                }
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
              >
                <option value="uppercase">UPPERCASE (e.g. HEADLINE TEXT)</option>
                <option value="capitalize">Capitalize Words</option>
                <option value="none">Normal Case</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 flex justify-between">
                <span>Heading Color</span>
                <span className="font-mono text-slate-500">{element.color}</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={element.color}
                  onChange={(e) => onUpdateElement({ ...element, color: e.target.value })}
                  className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => onUpdateElement({ ...element, color: '#1a2b56' })}
                  className="text-[10px] px-2 py-1 bg-slate-100 rounded border border-slate-200 text-slate-700 hover:bg-slate-200 font-semibold"
                >
                  Dark Navy
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateElement({ ...element, color: '#b22222' })}
                  className="text-[10px] px-2 py-1 bg-slate-100 rounded border border-slate-200 text-slate-700 hover:bg-slate-200 font-semibold"
                >
                  Red Accent
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Key-Value Editor */}
        {element.type === 'key-value' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Label Text (e.g. Date & Time:)</label>
              <input
                type="text"
                value={element.label}
                onChange={(e) => onUpdateElement({ ...element, label: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Value Text</label>
              <input
                type="text"
                value={element.value}
                onChange={(e) => onUpdateElement({ ...element, value: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Font Size (px)</label>
              <input
                type="number"
                value={element.fontSize}
                onChange={(e) =>
                  onUpdateElement({ ...element, fontSize: Number(e.target.value) })
                }
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
              />
            </div>

            <TextStyleToggles
              label="Label Style"
              bold={element.boldLabel !== false}
              italic={!!element.italicLabel}
              onChange={({ bold, italic }) =>
                onUpdateElement({ ...element, boldLabel: bold, italicLabel: italic })
              }
            />

            <TextStyleToggles
              label="Value Style"
              bold={!!element.boldValue}
              italic={!!element.italicValue}
              onChange={({ bold, italic }) =>
                onUpdateElement({ ...element, boldValue: bold, italicValue: italic })
              }
            />
          </div>
        )}

        {/* Paragraph Editor */}
        {element.type === 'paragraph' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block mb-1">Content</label>

              {/*
                Keyed on the element id so selecting a different paragraph gets
                a fresh editor rather than one carrying the previous block's
                undo history.
              */}
              <RichTextField
                key={element.id}
                value={element.content}
                onChange={(content) => onUpdateElement({ ...element, content })}
                placeholder="Write your message…"
                textStyle={{
                  fontFamily,
                  fontSize: `${element.fontSize}px`,
                  lineHeight: element.lineHeight,
                  color: element.color,
                  fontWeight: element.fontWeight ?? 'normal',
                  fontStyle: element.fontStyle ?? 'normal',
                }}
              />
              <p className="text-[10px] text-slate-500">
                Select text and use the bar above to style just that phrase.
                Enter starts a new paragraph, Shift+Enter a line break. The same
                editing works on the canvas.
              </p>
            </div>

            {/*
              The hand-authoring path. Kept because arbitrary markup — a link,
              an entity, a style the toolbar doesn't offer — is easier to type
              than to build, and because what's stored has always been HTML.
              Typing here re-seeds the editor above, but never the reverse:
              a half-finished `<stro` would otherwise be parsed and written
              back over itself. See RichTextField.tsx.
            */}
            <div className="border border-slate-200 rounded overflow-hidden">
              <button
                type="button"
                onClick={() => setShowParagraphSource((open) => !open)}
                aria-expanded={showParagraphSource}
                className="w-full flex items-center gap-1 px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-600 transition-colors"
              >
                {showParagraphSource ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                Edit HTML source
              </button>

              {showParagraphSource && (
                <div className="p-2 space-y-1 border-t border-slate-200">
                  <div className="flex gap-1 justify-end">
                    <button
                      type="button"
                      onClick={() => insertTagToParagraph('<strong>', '</strong>')}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-slate-700 border border-slate-200"
                      title="Bold the selected text (<strong>)"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTagToParagraph('<em>', '</em>')}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] italic font-semibold text-slate-700 border border-slate-200"
                      title="Italicize the selected text (<em>)"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        insertTagToParagraph(
                          '<span style="color:#b22222;">',
                          '</span>'
                        )
                      }
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-red-700 border border-slate-200"
                      title="Red Text"
                    >
                      Red
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        insertTagToParagraph('<p style="margin:0 0 1em;">', '</p>')
                      }
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-mono text-slate-700 border border-slate-200"
                      title="Wrap the selection in its own paragraph"
                    >
                      ¶
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTagToParagraph('<br>', '')}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-mono text-slate-700 border border-slate-200"
                      title="Line Break"
                    >
                      br
                    </button>
                  </div>
                  <textarea
                    ref={paragraphRef}
                    rows={6}
                    value={element.content}
                    onChange={(e) =>
                      onUpdateElement({ ...element, content: e.target.value })
                    }
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 font-mono text-[11px] leading-relaxed focus:ring-1 focus:ring-red-500"
                  />
                </div>
              )}
            </div>

            <TextStyleToggles
              label="Whole Block Style"
              bold={(element.fontWeight ?? 'normal') === 'bold'}
              italic={(element.fontStyle ?? 'normal') === 'italic'}
              onChange={({ bold, italic }) =>
                onUpdateElement({
                  ...element,
                  fontWeight: bold ? 'bold' : 'normal',
                  fontStyle: italic ? 'italic' : 'normal',
                })
              }
            />

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Font Size (px)</label>
                <input
                  type="number"
                  value={element.fontSize}
                  onChange={(e) =>
                    onUpdateElement({ ...element, fontSize: Number(e.target.value) })
                  }
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Line Height</label>
                <input
                  type="number"
                  step="0.1"
                  value={element.lineHeight}
                  onChange={(e) =>
                    onUpdateElement({ ...element, lineHeight: Number(e.target.value) })
                  }
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
                />
              </div>
            </div>
          </div>
        )}

        {/* List Editor */}
        {element.type === 'list' && (
          <ListEditor
            key={element.id}
            element={element}
            onUpdateElement={onUpdateElement}
          />
        )}

        {/* Button Editor */}
        {element.type === 'button' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Button Label</label>
              <input
                type="text"
                value={element.text}
                onChange={(e) => onUpdateElement({ ...element, text: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Destination URL</label>
              <input
                type="text"
                value={element.url}
                onChange={(e) => onUpdateElement({ ...element, url: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 font-mono text-[11px]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 flex justify-between">
                <span>Background Color</span>
                <span className="font-mono text-slate-500">{element.bgColor}</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={element.bgColor}
                  onChange={(e) => onUpdateElement({ ...element, bgColor: e.target.value })}
                  className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => onUpdateElement({ ...element, bgColor: '#b22222' })}
                  className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-slate-700 font-semibold"
                >
                  Gmail Red (#b22222)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateElement({ ...element, bgColor: '#1a2b56' })}
                  className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-slate-700 font-semibold"
                >
                  Navy Blue
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Border Radius (px)</label>
                <input
                  type="number"
                  value={element.borderRadius}
                  onChange={(e) =>
                    onUpdateElement({ ...element, borderRadius: Number(e.target.value) })
                  }
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Alignment</label>
                <select
                  value={element.alignment}
                  onChange={(e) =>
                    onUpdateElement({
                      ...element,
                      alignment: e.target.value as 'left' | 'center' | 'right',
                    })
                  }
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Section Container Editor */}
        {element.type === 'section' && (
          <SectionEditor
            key={element.id}
            element={element}
            onUpdateElement={onUpdateElement}
          />
        )}

        {/* Quote Editor */}
        {element.type === 'quote' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Quote</label>
              <textarea
                rows={3}
                value={element.quote}
                onChange={(e) => onUpdateElement({ ...element, quote: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 italic"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Reference / Author</label>
              <input
                type="text"
                value={element.author || ''}
                onChange={(e) => onUpdateElement({ ...element, author: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 font-semibold"
              />
            </div>

            <TextStyleToggles
              bold={(element.fontWeight ?? 'normal') === 'bold'}
              italic={(element.fontStyle ?? 'italic') === 'italic'}
              onChange={({ bold, italic }) =>
                onUpdateElement({
                  ...element,
                  fontWeight: bold ? 'bold' : 'normal',
                  fontStyle: italic ? 'italic' : 'normal',
                })
              }
            />
          </div>
        )}

        {/* HTML Block — the markup itself is edited in the HTML tab */}
        {element.type === 'custom-html' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <p className="font-bold flex items-center gap-1.5 text-slate-800">
                <Code2 className="w-3.5 h-3.5 text-red-700" />
                Raw HTML Block
              </p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                This block has no design controls — its markup is written by
                hand. Edit it in the HTML tab.
              </p>
              <button
                type="button"
                onClick={() => onChangeTab('html')}
                className="w-full flex items-center justify-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded p-2 font-semibold cursor-pointer"
              >
                <Code2 className="w-3.5 h-3.5 text-red-700" />
                Open HTML Editor
              </button>
            </div>

            {element.convertedFrom && (
              <button
                type="button"
                onClick={() => onUpdateElement(element.convertedFrom!)}
                className="w-full flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded p-2 font-semibold cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5 text-red-700" />
                Revert to {typeLabel(element.convertedFrom.type)} Block
              </button>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
};
