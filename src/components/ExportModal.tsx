import React from 'react';
import { X, Copy, Download, Mail, Check, Sparkles, HelpCircle, ExternalLink } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  htmlCode: string;
  onCopy: () => void;
  copied: boolean;
  onDownload: () => void;
  onOpenNewTab?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  htmlCode,
  onCopy,
  copied,
  onDownload,
  onOpenNewTab,
}) => {
  if (!isOpen) return null;

  const handleSendTestMail = () => {
    const subject = encodeURIComponent('Wednesday Study Newsletter Test');
    const body = encodeURIComponent(
      'Here is your rendered newsletter HTML:\n\n' + htmlCode.slice(0, 1500) + '...'
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-100 text-red-700 border border-red-200">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Export Email Newsletter HTML
              </h2>
              <p className="text-xs text-slate-500">
                Ready to send via Gmail, Mailchimp, ConvertKit, or SendGrid
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

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={onCopy}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl font-bold transition-all shadow-xs cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-red-700 hover:bg-red-800 text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>HTML Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Clean HTML</span>
                </>
              )}
            </button>

            <button
              onClick={onDownload}
              className="flex items-center justify-center gap-2 p-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl font-bold transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-red-700" />
              <span>Download newsletter.html</span>
            </button>
          </div>

          {/* Mailto & New Tab Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {onOpenNewTab && (
              <button
                onClick={onOpenNewTab}
                className="flex items-center justify-center gap-2 p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl font-bold transition-colors cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 text-red-700" />
                <span>Preview in New Tab</span>
              </button>
            )}
            <button
              onClick={handleSendTestMail}
              className="flex items-center justify-center gap-2 p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold transition-colors cursor-pointer"
            >
              <Mail className="w-4 h-4 text-slate-500" />
              <span>Draft in Email Client</span>
            </button>
          </div>

          {/* Quick Guide */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <HelpCircle className="w-3.5 h-3.5 text-red-700" />
              How to send using Gmail or Email Providers:
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed font-medium">
              <li>
                <strong className="text-slate-800">Gmail:</strong> Open a new compose window, paste the HTML using a Chrome extension like "Gmail Insert HTML" or copy rendered preview.
              </li>
              <li>
                <strong className="text-slate-800">Mailchimp / ConvertKit:</strong> Choose "Custom Code / Paste HTML" block and paste the copied code.
              </li>
              <li>
                <strong className="text-slate-800">Offline Backups:</strong> Click "Download newsletter.html" to keep a local archive of your study newsletters.
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors border border-slate-200 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
