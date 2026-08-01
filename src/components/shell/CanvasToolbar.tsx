import React from 'react';
import { Monitor, Redo2, Smartphone, Undo2 } from 'lucide-react';
import { useDesigner } from '../../state/DesignerContext';
import { useEditingSession } from '../../state/EditingSession';
import { SegmentedControl } from '../controls';
import { TextToolbar } from '../canvas/TextToolbar';

/**
 * The strip above the canvas.
 *
 * It has two states. Normally it holds the device switch, undo/redo and
 * Preview. The moment a rich text field is opened it becomes the formatting
 * bar — one strip, not two, so the canvas never shifts down when editing
 * starts and the controls always appear in the same place.
 *
 * A `plain` field (a heading, a button's label) keeps the normal bar: there is
 * no formatting to apply to one line of unstyled text, and swapping the bar out
 * for a row of disabled buttons would say otherwise.
 */
export const CanvasToolbar: React.FC = () => {
  const { ui, history } = useDesigner();
  const { mode } = useEditingSession();

  if (mode === 'rich' || mode === 'item') return <TextToolbar />;

  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
      <div className="mx-auto">
        <SegmentedControl
          value={ui.viewMode}
          block={false}
          onChange={ui.setViewMode}
          segments={[
            {
              value: 'desktop',
              icon: <Monitor className="h-4 w-4" />,
              title: 'Desktop',
            },
            {
              value: 'mobile',
              icon: <Smartphone className="h-4 w-4" />,
              title: 'Mobile',
            },
          ]}
        />
      </div>

      <button
        type="button"
        title="Undo (⌘Z)"
        aria-label="Undo"
        disabled={!history.canUndo}
        onClick={history.undo}
        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Undo2 className="h-5 w-5" />
      </button>
      <button
        type="button"
        title="Redo (⇧⌘Z)"
        aria-label="Redo"
        disabled={!history.canRedo}
        onClick={history.redo}
        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Redo2 className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => ui.setPreviewOpen(true)}
        className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200"
      >
        Preview
      </button>
    </div>
  );
};
