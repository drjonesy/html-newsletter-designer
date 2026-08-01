import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { EmailElement } from '../../../types';
import { blockName, isContainerElement } from '../../../utils/elementHelpers';
import { InspectorTab, useDesigner } from '../../../state/DesignerContext';
import { InlineRename } from '../../controls';
import { ContentTab, hasContentTab } from './ContentTab';
import { StylesTab } from './StylesTab';
import { VisibilityTab } from './VisibilityTab';
import { CodeTab } from './CodeTab';

const LABELS: Record<InspectorTab, string> = {
  content: 'Content',
  styles: 'Styles',
  visibility: 'Visibility',
  code: 'Code',
};

/**
 * Which tabs a block gets.
 *
 * Per type, not fixed: a text block has no Content tab because its content is
 * typed on the canvas, and a raw HTML block has nothing to style. Every type
 * gets Visibility and Code — Code both shows what the block emits and is the
 * escape hatch when the controls don't go far enough.
 */
export function tabsFor(el: EmailElement): InspectorTab[] {
  if (el.type === 'custom-html') return ['code', 'visibility'];
  /*
    A column gets Styles and nothing else.

    Visibility, because hiding it would leave its `<td>` in the table still
    holding its share of the width — an empty gap rather than the other columns
    widening, which is not what the control promises. Hide the whole row
    instead, or take the column out.

    Code, because saving hand-edited markup converts a block to `custom-html`,
    and a row that held one of those would no longer hold only columns. A
    column has no markup of its own anyway — the `<td>` belongs to the row —
    so the tab would show its children's HTML, which each child already offers.
  */
  if (el.type === 'column') return ['styles'];

  const tabs: InspectorTab[] = [];
  if (hasContentTab(el)) tabs.push('content');
  tabs.push('styles', 'visibility', 'code');
  return tabs;
}

/**
 * The block editor. Takes over the left panel while something is selected —
 * same slot as the rail panels, which is why it opens with a back arrow.
 */
export const BlockInspector: React.FC<{ element: EmailElement }> = ({
  element,
}) => {
  const { updateElement, ui } = useDesigner();
  const [renaming, setRenaming] = useState(false);

  const tabs = tabsFor(element);
  // The open tab may not exist on this type — selecting a different block picks
  // a sensible default, but a type conversion (Text -> HTML on the Code tab)
  // can strand it. Fall back rather than render an empty panel.
  const active = tabs.includes(ui.inspectorTab) ? ui.inspectorTab : tabs[0];

  return (
    <>
      <div className="flex items-center gap-2 px-3 pb-2 pt-4">
        <button
          type="button"
          // Keeps the selection: backing out to the palette is how you add a
          // block *into* the section you were just looking at.
          onClick={ui.showRailPanel}
          title="Back"
          aria-label="Back to panels"
          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/*
          Renaming matters most for sections — the outline and the canvas tab
          both show this — but every block can carry a name, and naming a block
          you keep coming back to is cheap to allow.
        */}
        <InlineRename
          value={blockName(element)}
          onChange={(label) => updateElement({ ...element, label })}
          editing={renaming}
          onEditingChange={setRenaming}
          className="mx-auto max-w-full truncate rounded px-2 py-0.5 text-lg font-bold text-slate-900 hover:bg-slate-100"
          inputClassName="mx-auto w-full rounded border border-accent-500 px-2 py-0.5 text-center text-lg font-bold text-slate-900 outline-none"
        />

        {/* Balances the back arrow so the title stays optically centred. */}
        <span className="h-8 w-8 shrink-0" aria-hidden />
      </div>

      <div
        role="tablist"
        className="flex shrink-0 border-b border-slate-200 px-1"
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active === tab}
            onClick={() => ui.setInspectorTab(tab)}
            className={`flex-1 border-b-2 px-1 pb-2.5 pt-1 text-sm transition-colors ${
              active === tab
                ? 'border-accent-500 font-semibold text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {LABELS[tab]}
          </button>
        ))}
      </div>

      {/*
        Code owns its own scrolling — its editor fills the panel — so it sits
        outside the shared scroll container the other tabs use.
      */}
      {active === 'code' ? (
        <CodeTab key={element.id} element={element} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {active === 'content' && <ContentTab element={element} />}
          {active === 'styles' && <StylesTab element={element} />}
          {active === 'visibility' && <VisibilityTab element={element} />}
        </div>
      )}

      {isContainerElement(element) &&
        (element.type === 'row' ? (
          <p className="shrink-0 border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
            {(element.childElements || []).length} column
            {(element.childElements || []).length === 1 ? '' : 's'}. Select one
            to put blocks in it.
          </p>
        ) : (
          <p className="shrink-0 border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
            {(element.childElements || []).length} block
            {(element.childElements || []).length === 1 ? '' : 's'} inside. Drag
            more in from the Blocks panel.
          </p>
        ))}
    </>
  );
};
