import React from 'react';
import { useDesigner } from '../../state/DesignerContext';
import { useUndoRedoShortcuts } from '../../state/useTemplateHistory';
import { TopBar } from './TopBar';
import { NoticeBar } from './NoticeBar';
import { IconRail } from './IconRail';
import { LeftPanel } from './LeftPanel';
import { CanvasToolbar } from './CanvasToolbar';
import { Canvas } from '../canvas/Canvas';
import { PreviewOverlay } from '../PreviewOverlay';
import { ExportModal } from '../ExportModal';
import { ImportHtmlModal } from '../ImportHtmlModal';

/**
 * The v2 layout: top bar across, then rail + contextual panel + canvas.
 *
 * `overflow-hidden` on the frame and `min-h-0` on the flex children is what
 * keeps scrolling inside the panel and the canvas rather than on the page —
 * without it a tall email scrolls the whole app and the toolbars slide away.
 */
export const AppShell: React.FC = () => {
  const { history } = useDesigner();
  useUndoRedoShortcuts(history);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100 font-sans text-slate-800">
      <TopBar />
      <NoticeBar />

      <div className="flex min-h-0 flex-1">
        <IconRail />
        <LeftPanel />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <CanvasToolbar />
          <Canvas />
        </main>
      </div>

      <PreviewOverlay />
      <ExportModal />
      <ImportHtmlModal />
    </div>
  );
};
