import React, { useState } from 'react';
import { NewsletterTemplate, EmailElement } from '../types';
import { renderElementToHtml } from '../utils/htmlGenerator';
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Copy,
  Edit3,
  Plus,
  Move,
  Check,
  ExternalLink,
} from 'lucide-react';

interface VisualCanvasProps {
  template: NewsletterTemplate;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (updated: EmailElement) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  viewMode: 'desktop' | 'mobile';
  onOpenNewTab?: () => void;
}

export const VisualCanvas: React.FC<VisualCanvasProps> = ({
  template,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onMoveUp,
  onMoveDown,
  viewMode,
  onOpenNewTab,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const containerWidth = viewMode === 'mobile' ? 375 : template.settings.width;

  const renderSingleInteractiveElement = (
    el: EmailElement,
    isChild = false
  ) => {
    const isSelected = selectedElementId === el.id;
    const isHovered = hoveredId === el.id;

    if (el.type === 'accent-section') {
      return (
        <div
          key={el.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelectElement(el.id);
          }}
          onMouseEnter={(e) => {
            e.stopPropagation();
            setHoveredId(el.id);
          }}
          onMouseLeave={() => setHoveredId(null)}
          className={`relative group rounded transition-all cursor-pointer ${
            isSelected
              ? 'ring-2 ring-red-600 ring-offset-2'
              : isHovered
              ? 'ring-1 ring-red-400/80 ring-offset-1'
              : ''
          }`}
          style={{
            borderLeft: `${el.borderWidth}px solid ${el.borderColor}`,
            paddingLeft: `${el.paddingLeft}px`,
            marginBottom: `${el.marginBottom}px`,
          }}
        >
          {/* Quick Hover Control Badge */}
          {(isSelected || isHovered) && (
            <div className="absolute -top-3 left-2 z-20 flex items-center gap-1 bg-white text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border border-slate-200">
              <span className="text-red-700 font-bold">Red Accent Block</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUp(el.id);
                }}
                className="hover:text-red-700 p-0.5 text-slate-600"
                title="Move Up"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveDown(el.id);
                }}
                className="hover:text-red-700 p-0.5 text-slate-600"
                title="Move Down"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateElement(el.id);
                }}
                className="hover:text-amber-600 p-0.5 text-slate-600"
                title="Duplicate"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteElement(el.id);
                }}
                className="hover:text-red-700 p-0.5 text-slate-600"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Render Child Elements inside accent section */}
          <div className="space-y-1">
            {(el.childElements || []).map((child) =>
              renderSingleInteractiveElement(child, true)
            )}
          </div>
        </div>
      );
    }

    const htmlContent = renderElementToHtml(el, template.settings.fontFamily);

    return (
      <div
        key={el.id}
        onClick={(e) => {
          e.stopPropagation();
          onSelectElement(el.id);
        }}
        onMouseEnter={(e) => {
          e.stopPropagation();
          setHoveredId(el.id);
        }}
        onMouseLeave={() => setHoveredId(null)}
        className={`relative transition-all cursor-pointer rounded ${
          isSelected
            ? 'ring-2 ring-red-600 ring-offset-2 z-10'
            : isHovered
            ? 'ring-1 ring-red-400/80 ring-offset-1 z-10'
            : ''
        }`}
      >
        {/* Hover/Selection Control Overlay Badge */}
        {(isSelected || isHovered) && (
          <div className="absolute -top-3 left-2 z-20 flex items-center gap-1 bg-white text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border border-slate-200">
            <span className="text-red-700 capitalize font-bold">{el.type.replace('-', ' ')}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp(el.id);
              }}
              className="hover:text-red-700 p-0.5 text-slate-600"
              title="Move Up"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown(el.id);
              }}
              className="hover:text-red-700 p-0.5 text-slate-600"
              title="Move Down"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicateElement(el.id);
              }}
              className="hover:text-amber-600 p-0.5 text-slate-600"
              title="Duplicate"
            >
              <Copy className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteElement(el.id);
              }}
              className="hover:text-red-700 p-0.5 text-slate-600"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* HTML Render Container */}
        <div
          dangerouslySetInnerHTML={{ __html: htmlContent }}
          className="pointer-events-none select-none"
        />
      </div>
    );
  };

  return (
    <div
      className="flex-1 bg-slate-100 overflow-y-auto p-4 sm:p-8 flex flex-col items-center justify-start min-h-full"
      onClick={() => onSelectElement(null)}
    >
      {/* Device Frame Wrapper */}
      <div
        className="transition-all duration-300 shadow-lg rounded-xl overflow-hidden border border-slate-200 my-auto"
        style={{
          width: `${containerWidth}px`,
          maxWidth: '100%',
          backgroundColor: template.settings.bgColor,
        }}
      >
        {/* Email Header Bar Simulation (Gmail style) */}
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
            <span className="font-bold text-slate-700">Gmail Preview</span>
          </div>
          <div className="flex items-center gap-3">
            {onOpenNewTab && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenNewTab();
                }}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-red-700 transition-colors cursor-pointer bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs hover:bg-slate-100"
                title="Open Email Preview in New Tab"
              >
                <ExternalLink className="w-3 h-3 text-red-700" />
                <span>Open in New Tab</span>
              </button>
            )}
            <span className="font-mono text-[10px] text-slate-500 font-semibold">
              Width: {containerWidth}px {viewMode === 'mobile' ? '(Mobile)' : ''}
            </span>
          </div>
        </div>

        {/* Inner Email Card */}
        <div
          className="mx-auto transition-all"
          style={{
            width: '100%',
            backgroundColor: template.settings.cardBgColor,
            color: template.settings.textColor,
            fontFamily: template.settings.fontFamily,
            padding: `${template.settings.padding}px`,
          }}
        >
          {template.elements.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-400 border-2 border-dashed border-slate-300 rounded-lg">
              <p className="font-semibold text-sm mb-1">Canvas is empty</p>
              <p className="text-xs text-slate-500">
                Click elements in the left sidebar to start building your email newsletter.
              </p>
            </div>
          ) : (
            template.elements.map((el) => renderSingleInteractiveElement(el))
          )}
        </div>
      </div>
    </div>
  );
};
