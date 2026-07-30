import React from 'react';
import {
  Mail,
  Copy,
  Download,
  Upload,
  Check,
  Save,
  FolderOpen,
  FilePlus2,
} from 'lucide-react';

interface NavbarProps {
  onOpenImportModal: () => void;
  onExportHtml: () => void;
  onCopyHtml: () => void;
  copied: boolean;
  /** Discard the current design and start a fresh blank newsletter. */
  onNewNewsletter: () => void;
  /** Save the editable project (blocks + settings) to a local file. */
  onSaveTemplateFile: () => void;
  /** Open the file picker to load a saved project file. */
  onOpenTemplateFile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenImportModal,
  onExportHtml,
  onCopyHtml,
  copied,
  onNewNewsletter,
  onSaveTemplateFile,
  onOpenTemplateFile,
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

        {/* Action Buttons — `ml-auto` pins them to the right edge of the header */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Project file: start fresh, save the editable design, reopen it later */}
          <div className="flex items-center gap-1 pr-2 border-r border-slate-200">
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
