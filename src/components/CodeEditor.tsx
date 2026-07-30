import React, { useState } from 'react';
import { Copy, Download, Check, Sparkles, Code } from 'lucide-react';

interface CodeEditorProps {
  htmlCode: string;
  onUpdateCode?: (newCode: string) => void;
  onCopy: () => void;
  copied: boolean;
  onDownload: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  htmlCode,
  onUpdateCode,
  onCopy,
  copied,
  onDownload,
}) => {
  const [code, setCode] = useState(htmlCode);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCode(val);
    if (onUpdateCode) {
      onUpdateCode(val);
    }
  };

  return (
    <div className="flex-1 min-h-0 bg-slate-100 flex flex-col overflow-hidden text-slate-800">
      {/* Code Header Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-red-700" />
          <h2 className="text-xs font-bold text-slate-900">
            Generated Production Email HTML
          </h2>
          <span className="text-[10px] text-slate-500 font-mono font-semibold">
            ({htmlCode.length.toLocaleString()} chars)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCopy}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-600" />
                <span>Copy HTML</span>
              </>
            )}
          </button>

          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-3 py-1.5 rounded-md transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .html</span>
          </button>
        </div>
      </div>

      {/* Code Editor Container */}
      <div className="flex-1 relative p-4 bg-slate-100">
        <textarea
          value={code !== htmlCode ? htmlCode : code}
          onChange={handleTextChange}
          spellCheck={false}
          className="w-full h-full bg-white text-slate-800 font-mono text-xs p-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-red-500 leading-relaxed resize-none shadow-xs selection:bg-red-100 selection:text-red-900"
        />
      </div>
    </div>
  );
};
