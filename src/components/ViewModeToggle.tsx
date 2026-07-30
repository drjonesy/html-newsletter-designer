import React from 'react';
import { Monitor, Smartphone, Code2, ExternalLink } from 'lucide-react';

interface ViewModeToggleProps {
  viewMode: 'desktop' | 'mobile' | 'code';
  setViewMode: (mode: 'desktop' | 'mobile' | 'code') => void;
  onOpenNewTab: () => void;
}

/**
 * Desktop / Mobile / HTML Code switch, plus open-in-new-tab.
 *
 * Sits in the strip above the preview rather than in the Navbar, so it reads as
 * a control on the canvas. It has to be rendered outside `VisualCanvas` — code
 * view swaps that component out for `CodeEditor`, and the switch back to
 * Desktop lives here.
 */
export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  viewMode,
  setViewMode,
  onOpenNewTab,
}) => {
  const tabClass = (mode: 'desktop' | 'mobile' | 'code') =>
    `flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
      viewMode === mode
        ? 'bg-red-700 text-white shadow-xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200 shadow-xs">
      <button
        onClick={() => setViewMode('desktop')}
        className={tabClass('desktop')}
        title="Desktop View (600px)"
      >
        <Monitor className="w-3.5 h-3.5" />
        <span>Desktop</span>
      </button>
      <button
        onClick={() => setViewMode('mobile')}
        className={tabClass('mobile')}
        title="Mobile View (375px)"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>Mobile</span>
      </button>
      <button
        onClick={() => setViewMode('code')}
        className={tabClass('code')}
        title="HTML Source Code"
      >
        <Code2 className="w-3.5 h-3.5" />
        <span>HTML Code</span>
      </button>
      <div className="w-px h-4 bg-slate-200 my-auto mx-0.5"></div>
      <button
        onClick={onOpenNewTab}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-slate-700 hover:text-red-700 hover:bg-slate-200/60 transition-all cursor-pointer"
        title="Open Email Preview in New Tab"
      >
        <ExternalLink className="w-3.5 h-3.5 text-red-700" />
        <span>New Tab</span>
      </button>
    </div>
  );
};
