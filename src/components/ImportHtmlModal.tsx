import React, { useState } from 'react';
import { X, Upload, Sparkles, AlertCircle } from 'lucide-react';

interface ImportHtmlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportHtml: (rawHtml: string) => void;
}

export const ImportHtmlModal: React.FC<ImportHtmlModalProps> = ({
  isOpen,
  onClose,
  onImportHtml,
}) => {
  const [rawHtml, setRawHtml] = useState('');

  if (!isOpen) return null;

  const handleImport = () => {
    if (!rawHtml.trim()) return;
    onImportHtml(rawHtml);
    setRawHtml('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col text-slate-800">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-100 text-red-700 border border-red-200">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Import Raw Gmail / Email HTML
              </h2>
              <p className="text-xs text-slate-500">
                Paste any email HTML snippet to import into the editor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-3">
          <div className="p-3 bg-red-50/70 border border-red-200/70 rounded-xl text-xs text-slate-800 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-slate-700">
              Paste the HTML code copied from Gmail or your email client. The designer will convert it into an editable block inside your template canvas so you can add elements, change text, and export fresh newsletters!
            </p>
          </div>

          <textarea
            rows={10}
            value={rawHtml}
            onChange={(e) => setRawHtml(e.target.value)}
            placeholder='Paste HTML here (e.g. <table width="100%">...</table>)...'
            className="w-full bg-slate-900 text-slate-100 font-mono text-xs p-3 rounded-xl border border-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500 leading-relaxed"
          />
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors border border-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!rawHtml.trim()}
            className="px-4 py-2 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Import to Canvas</span>
          </button>
        </div>
      </div>
    </div>
  );
};
