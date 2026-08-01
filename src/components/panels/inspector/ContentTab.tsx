import React, { useRef, useState } from 'react';
import { GripVertical, Plus, Trash2, Upload } from 'lucide-react';
import {
  ButtonElement,
  EmailElement,
  ImageElement,
  ListElement,
  ListMarker,
  ParagraphElement,
  SpacerElement,
} from '../../../types';
import { useDesigner } from '../../../state/DesignerContext';
import { RichTextField } from '../../RichTextField';
import {
  FieldGroup,
  NumberStepper,
  SegmentedControl,
  SelectField,
  TextField,
} from '../../controls';

type Update = (el: EmailElement) => void;

/* -------------------------------------------------------------------------- */

/**
 * Image sizing, expressed the way the design puts it.
 *
 * - **Original** — the image's own pixel width, whatever that is.
 * - **Fill** — the full width of the section it sits in.
 * - **Scale** — a width the author sets.
 *
 * All three come out as an explicit `width` on the `<img>`, because email needs
 * one; they differ only in where the number comes from. "Fill" uses the email's
 * configured width, since a percentage width on an image is unreliable in
 * Outlook.
 */
type SizeMode = 'original' | 'fill' | 'scale';

const ImageEditor: React.FC<{ element: ImageElement; update: Update }> = ({
  element,
  update,
}) => {
  const { settings } = useDesigner();
  const fileInput = useRef<HTMLInputElement>(null);

  const mode: SizeMode =
    element.width === settings.width
      ? 'fill'
      : typeof element.width === 'number'
        ? 'scale'
        : 'original';

  const upload = (file: File) => {
    // Read as a data URI so a project file stays self-contained — there is no
    // server to upload to, and a blob: URL wouldn't survive a reload.
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        update({ ...element, src: evt.target.result as string });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <FieldGroup>
        <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center">
          {element.src ? (
            <img
              src={element.src}
              alt=""
              className="mx-auto mb-3 max-h-28 max-w-full rounded object-contain"
            />
          ) : (
            <>
              <p className="text-base font-bold text-slate-900">Add image</p>
              <p className="mx-auto mt-1 max-w-64 text-xs text-slate-500">
                Anything the browser can read. It's embedded in the project
                file, so keep it small — the whole email has a size budget.
              </p>
            </>
          )}
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" />
            {element.src ? 'Replace' : 'Add'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) upload(file);
            }}
          />
        </div>

        <div className="mt-3">
          <TextField
            label="Or paste an image URL"
            value={element.src.startsWith('data:') ? '' : element.src}
            placeholder="https://example.com/banner.png"
            onChange={(src) => update({ ...element, src })}
          />
          {element.src.startsWith('data:') && (
            <p className="mt-1 text-xs text-slate-500">
              Currently using an uploaded image.
            </p>
          )}
        </div>
      </FieldGroup>

      <FieldGroup label="Size">
        <SegmentedControl<SizeMode>
          value={mode}
          segments={[
            { value: 'original', label: 'Original' },
            { value: 'fill', label: 'Fill' },
            { value: 'scale', label: 'Scale' },
          ]}
          onChange={(next) => {
            if (next === 'fill') update({ ...element, width: settings.width });
            else if (next === 'original') update({ ...element, width: 'auto' });
            else update({ ...element, width: Math.round(settings.width / 2) });
          }}
        />
        {mode === 'scale' && (
          <div className="mt-3">
            <NumberStepper
              label="Width"
              suffix="px"
              min={1}
              max={settings.width}
              value={Number(element.width) || 100}
              onChange={(width) => update({ ...element, width })}
            />
          </div>
        )}
      </FieldGroup>

      <FieldGroup label="Link">
        <TextField
          value={element.href ?? ''}
          placeholder="https://example.com"
          onChange={(href) => update({ ...element, href: href || undefined })}
        />
      </FieldGroup>

      <FieldGroup label="Alt text">
        <TextField
          value={element.alt}
          placeholder="Describe the image"
          info="Shown when images are blocked, which many clients do by default. Worth writing."
          onChange={(alt) => update({ ...element, alt })}
        />
      </FieldGroup>
    </>
  );
};

/* -------------------------------------------------------------------------- */

const ButtonEditor: React.FC<{ element: ButtonElement; update: Update }> = ({
  element,
  update,
}) => (
  <>
    <FieldGroup label="Label">
      <TextField
        value={element.text}
        onChange={(text) => update({ ...element, text })}
      />
      <p className="mt-2 text-xs text-slate-500">
        You can also type straight onto the button on the canvas.
      </p>
    </FieldGroup>

    <FieldGroup label="Link">
      <TextField
        value={element.url}
        placeholder="https://example.com"
        onChange={(url) => update({ ...element, url })}
      />
    </FieldGroup>
  </>
);

/* -------------------------------------------------------------------------- */

const SpacerEditor: React.FC<{ element: SpacerElement; update: Update }> = ({
  element,
  update,
}) => (
  <FieldGroup label="Height">
    <NumberStepper
      value={element.height}
      min={1}
      max={400}
      suffix="px"
      onChange={(height) => update({ ...element, height })}
    />
    <p className="mt-2 text-xs text-slate-500">
      A real table cell with a stated height. Margins collapse unpredictably
      across clients; this doesn't.
    </p>
  </FieldGroup>
);

/* -------------------------------------------------------------------------- */

const BULLET_MARKERS: { value: ListMarker; label: string }[] = [
  { value: 'disc', label: 'Filled circle' },
  { value: 'circle', label: 'Hollow circle' },
  { value: 'square', label: 'Square' },
  { value: 'none', label: 'No marker' },
];

const NUMBER_MARKERS: { value: ListMarker; label: string }[] = [
  { value: 'decimal', label: '1, 2, 3' },
  { value: 'lower-alpha', label: 'a, b, c' },
  { value: 'upper-alpha', label: 'A, B, C' },
  { value: 'lower-roman', label: 'i, ii, iii' },
  { value: 'upper-roman', label: 'I, II, III' },
  { value: 'none', label: 'No marker' },
];

const ListEditor: React.FC<{ element: ListElement; update: Update }> = ({
  element,
  update,
}) => {
  const items = element.items ?? [];

  const setItems = (next: string[]) => update({ ...element, items: next });

  return (
    <>
      <FieldGroup label="List type">
        <SegmentedControl
          value={element.ordered ? 'ordered' : 'bulleted'}
          segments={[
            { value: 'bulleted', label: 'Bulleted' },
            { value: 'ordered', label: 'Numbered' },
          ]}
          onChange={(value) => {
            const ordered = value === 'ordered';
            // The marker sets are disjoint apart from `none`, so switching kind
            // has to pick a marker that means something for the new kind.
            const markers = ordered ? NUMBER_MARKERS : BULLET_MARKERS;
            const marker = markers.some((m) => m.value === element.marker)
              ? element.marker
              : markers[0].value;
            update({ ...element, ordered, marker });
          }}
        />
        <div className="mt-3">
          <SelectField
            label="Marker"
            value={element.marker}
            options={element.ordered ? NUMBER_MARKERS : BULLET_MARKERS}
            onChange={(marker) => update({ ...element, marker })}
          />
        </div>
      </FieldGroup>

      <FieldGroup label="Items">
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />
              {/*
                Plain text in, HTML out: an item holds rich markup, but this
                field is a fallback for reordering and quick fixes. Formatting
                happens on the canvas, where the toolbar is.
              */}
              <input
                value={item}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = e.target.value;
                  setItems(next);
                }}
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
              />
              <button
                type="button"
                title="Remove item"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setItems([...items, ''])}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          Add item
        </button>
      </FieldGroup>
    </>
  );
};

/* -------------------------------------------------------------------------- */

const ParagraphEditor: React.FC<{
  element: ParagraphElement;
  update: Update;
}> = ({ element, update }) => {
  const { settings } = useDesigner();
  const [showSource, setShowSource] = useState(false);

  return (
    <>
      <FieldGroup label="Content">
        {/*
          Keyed on the element id so selecting a different paragraph gets a
          fresh editor rather than one carrying the previous block's undo
          history.
        */}
        <RichTextField
          key={element.id}
          value={element.content}
          onChange={(content) => update({ ...element, content })}
          textStyle={{
            color: element.color,
            fontSize: `${element.fontSize}px`,
            lineHeight: element.lineHeight,
            fontFamily: settings.fontFamily,
            fontWeight: element.fontWeight,
            fontStyle: element.fontStyle,
          }}
        />
        <p className="mt-2 text-xs text-slate-500">
          Longer copy is easier here; short edits are quicker on the canvas.
          Both write the same field.
        </p>
      </FieldGroup>

      <FieldGroup>
        <button
          type="button"
          onClick={() => setShowSource((v) => !v)}
          className="text-sm font-semibold text-accent-600 hover:underline"
        >
          {showSource ? 'Hide' : 'Edit'} HTML source
        </button>

        {showSource && (
          <div className="mt-3">
            {/*
              The deliberate unsanitized path: a link, an entity, a style the
              toolbar doesn't offer. Rewriting what someone types here *while*
              they type it would be unusable, so nothing sanitizes on the way
              in — only on the way out of the editors above.
            */}
            <TextField
              multiline
              mono
              rows={8}
              value={element.content}
              onChange={(content) => update({ ...element, content })}
            />
            <p className="mt-2 text-xs text-slate-500">
              Kept as typed. Only tags email clients agree on survive when the
              same text is edited through an editor:{' '}
              <code className="rounded bg-slate-100 px-1">
                p br strong em u s span a
              </code>
              .
            </p>
          </div>
        )}
      </FieldGroup>
    </>
  );
};

/* -------------------------------------------------------------------------- */

/** True when this block type has content the Inspector needs to edit. */
export function hasContentTab(el: EmailElement): boolean {
  return (
    el.type === 'image' ||
    el.type === 'button' ||
    el.type === 'spacer' ||
    el.type === 'list' ||
    el.type === 'paragraph'
  );
}

/**
 * What a block *is*, as opposed to how it looks.
 *
 * Text blocks have no Content tab: their content is typed straight onto the
 * canvas, and a textarea saying the same thing twice is a second place for the
 * two to disagree.
 */
export const ContentTab: React.FC<{ element: EmailElement }> = ({ element }) => {
  const { updateElement } = useDesigner();
  const update: Update = (el) => updateElement(el);

  switch (element.type) {
    case 'image':
      return <ImageEditor element={element} update={update} />;
    case 'button':
      return <ButtonEditor element={element} update={update} />;
    case 'spacer':
      return <SpacerEditor element={element} update={update} />;
    case 'list':
      return <ListEditor element={element} update={update} />;
    case 'paragraph':
      return <ParagraphEditor element={element} update={update} />;
    default:
      return null;
  }
};

/** Re-exported so the styles tab can offer the same marker lists. */
export { BULLET_MARKERS, NUMBER_MARKERS };
