import React from 'react';
import {
  Mail,
  Monitor,
  Smartphone,
  Code2,
  Copy,
  Download,
  Upload,
  Plus,
  Check,
  ExternalLink,
  Save,
  FolderOpen,
  FilePlus2,
} from 'lucide-react';

interface NavbarProps {
  viewMode: 'desktop' | 'mobile' | 'code';
  setViewMode: (mode: 'desktop' | 'mobile' | 'code') => void;
  activePresetId: string;
  onSelectPreset: (presetId: string) => void;
  onOpenAddModal: () => void;
  onOpenImportModal: () => void;
  onExportHtml: () => void;
  onCopyHtml: () => void;
  onOpenNewTab: () => void;
  copied: boolean;
  /** Discard the current design and start a fresh blank newsletter. */
  onNewNewsletter: () => void;
  /** Save the editable project (blocks + settings) to a local file. */
  onSaveTemplateFile: () => void;
  /** Open the file picker to load a saved project file. */
  onOpenTemplateFile: () => void;
  /** Name of the project file in play, shown in the template dropdown. */
  openFileName: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  viewMode,
  setViewMode,
  activePresetId,
  onSelectPreset,
  onOpenAddModal,
  onOpenImportModal,
  onExportHtml,
  onCopyHtml,
  onOpenNewTab,
  copied,
  onNewNewsletter,
  onSaveTemplateFile,
  onOpenTemplateFile,
  openFileName,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 text-slate-800 px-4 py-3 sticky top-0 z-40 shadow-xs">
      <div className="w-full flex flex-wrap items-center justify-start gap-3">
        {/* App Title & Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-700 text-white flex items-center justify-center font-bold shadow-sm">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight text-slate-900 flex items-center gap-2">
              Email Newsletter Designer
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                Light Mode
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Gmail Template Editor & HTML Builder
            </p>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 hidden sm:inline">
            Template:
          </label>
          <select
            value={activePresetId}
            onChange={(e) => onSelectPreset(e.target.value)}
            className="bg-slate-50 text-xs font-semibold text-slate-700 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer shadow-xs hover:border-slate-300"
          >
            {openFileName && (
              <option value="__open-file__">📄 {openFileName}</option>
            )}
            <option value="blank">Blank Canvas</option>
            <option value="announcement">General Announcement</option>
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setViewMode('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'desktop'
                ? 'bg-red-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            title="Desktop View (600px)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Desktop</span>
          </button>
          <button
            onClick={() => setViewMode('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'mobile'
                ? 'bg-red-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            title="Mobile View (375px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Mobile</span>
          </button>
          <button
            onClick={() => setViewMode('code')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'code'
                ? 'bg-red-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            title="HTML Source Code"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">HTML Code</span>
          </button>
          <div className="w-px h-4 bg-slate-200 my-auto mx-0.5"></div>
          <button
            onClick={onOpenNewTab}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-slate-700 hover:text-red-700 hover:bg-slate-200/60 transition-all cursor-pointer"
            title="Open Email Preview in New Tab"
          >
            <ExternalLink className="w-3.5 h-3.5 text-red-700" />
            <span className="hidden lg:inline">New Tab</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-3 py-1.5 rounded-md transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Element</span>
          </button>

          {/* Project file: start fresh, save the editable design, reopen it later */}
          <div className="flex items-center gap-1 pl-1 pr-2 border-r border-slate-200">
            <button
              onClick={onNewNewsletter}
              className="flex items-center gap-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
              title="Start a new blank newsletter"
            >
              <FilePlus2 className="w-3.5 h-3.5 text-red-700" />
              <span className="hidden lg:inline">New</span>
            </button>
            <button
              onClick={onSaveTemplateFile}
              className="flex items-center gap-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
              title="Save this newsletter as a project file you can reopen later"
            >
              <Save className="w-3.5 h-3.5 text-red-700" />
              <span className="hidden lg:inline">Save</span>
            </button>
            <button
              onClick={onOpenTemplateFile}
              className="flex items-center gap-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
              title="Open a saved .newsletter.json project file"
            >
              <FolderOpen className="w-3.5 h-3.5 text-red-700" />
              <span className="hidden lg:inline">Open</span>
            </button>
          </div>

          <button
            onClick={onOpenImportModal}
            className="flex items-center gap-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
            title="Import Raw Gmail HTML"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Import HTML</span>
          </button>

          <button
            onClick={onCopyHtml}
            className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Copy HTML</span>
              </>
            )}
          </button>

          <button
            onClick={onExportHtml}
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
            title="Export & Download HTML"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden md:inline">Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};
