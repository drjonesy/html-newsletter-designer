import React from 'react';
import { useDesigner } from '../../state/DesignerContext';
import { BlocksPanel } from '../panels/BlocksPanel';
import { SectionsPanel } from '../panels/SectionsPanel';
import { ThemePanel } from '../panels/ThemePanel';
import { AddonsPanel } from '../panels/AddonsPanel';
import { BlockInspector } from '../panels/inspector/BlockInspector';

/**
 * The one contextual panel beside the rail.
 *
 * Selecting a block replaces whichever rail panel was open with that block's
 * inspector — the same slot, which is why the inspector opens with a back
 * arrow. One panel rather than two means the canvas keeps the same width
 * whatever you're doing, so nothing shifts under the cursor.
 *
 * Which of the two is showing is `ui.panelMode`, **not** "is something
 * selected". Going back to the palette keeps the block selected, because the
 * selected section is where a clicked palette block lands — deriving the panel
 * from the selection would hide the palette the moment you chose a destination
 * for it, and click-to-add could never work.
 */
export const LeftPanel: React.FC = () => {
  const { selectedElement, ui } = useDesigner();

  return (
    <aside className="flex w-95 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white">
      {ui.panelMode === 'inspector' && selectedElement ? (
        <BlockInspector element={selectedElement} />
      ) : ui.railTab === 'blocks' ? (
        <BlocksPanel />
      ) : ui.railTab === 'sections' ? (
        <SectionsPanel />
      ) : ui.railTab === 'theme' ? (
        <ThemePanel />
      ) : (
        <AddonsPanel />
      )}
    </aside>
  );
};
