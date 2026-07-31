import React, { useState } from 'react';
import { ElementType, EmailSettings } from '../types';
import { isContainerType } from '../utils/elementHelpers';
import {
  Image,
  Type,
  List,
  ListOrdered,
  FileText,
  MousePointerClick,
  Quote,
  Minus,
  Code,
  Plus,
  Settings,
  ChevronDown,
  ChevronUp,
  Palette,
  Square,
  CornerDownRight,
  GripVertical,
} from 'lucide-react';

interface SidebarElementsProps {
  onAddElement: (type: ElementType) => void;
  settings: EmailSettings;
  onUpdateSettings: (newSettings: Partial<EmailSettings>) => void;
  selectedElementCount: number;
  templateName: string;
  onRenameTemplate: (name: string) => void;
  /** Preset picker, sitting above the tabs. */
  activePresetId: string;
  onSelectPreset: (presetId: string) => void;
  /** Name of the project file in play, shown as an option in that picker. */
  openFileName: string | null;
  /**
   * Name of the section a clicked block will drop into, or null when nothing
   * is selected. Set whenever a container — or something inside one — is
   * selected.
   */
  addTargetLabel?: string | null;
  onClearAddTarget?: () => void;
  /** Palette drag lifecycle; the canvas resolves where the block lands. */
  onStartPaletteDrag?: (type: ElementType) => void;
  onEndPaletteDrag?: () => void;
}

export const SidebarElements: React.FC<SidebarElementsProps> = ({
  onAddElement,
  settings,
  onUpdateSettings,
  selectedElementCount,
  templateName,
  onRenameTemplate,
  activePresetId,
  onSelectPreset,
  openFileName,
  addTargetLabel,
  onClearAddTarget,
  onStartPaletteDrag,
  onEndPaletteDrag,
}) => {
  const [activeTab, setActiveTab] = useState<'elements' | 'settings'>('elements');
  const [accentOpen, setAccentOpen] = useState(true);
  const [draggingType, setDraggingType] = useState<ElementType | null>(null);

  const elementCategories = [
    {
      type: 'section' as ElementType,
      title: 'Section',
      desc: 'Box with per-side borders and padding that holds other blocks',
      icon: Square,
      color: 'bg-slate-100 text-slate-700 border-slate-200',
      badge: 'Container',
    },
    {
      type: 'image' as ElementType,
      title: 'Image',
      desc: 'Any image — logo, banner, photo — optionally linked',
      icon: Image,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      type: 'heading' as ElementType,
      title: 'Heading',
      desc: 'Title or subtitle, H1–H6, with letter spacing',
      icon: Type,
      color: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    {
      type: 'key-value' as ElementType,
      title: 'Key-Value Row',
      desc: 'Label & value pair (e.g. Date & Time, Location)',
      icon: ListOrdered,
      color: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    {
      type: 'paragraph' as ElementType,
      title: 'Paragraph / Text',
      desc: 'Formatted body copy with scripture references',
      icon: FileText,
      color: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    {
      type: 'list' as ElementType,
      title: 'List',
      desc: 'Bulleted or numbered list of items',
      icon: List,
      color: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    {
      type: 'button' as ElementType,
      title: 'Button',
      desc: 'Call-to-action button with its own link and colours',
      icon: MousePointerClick,
      color: 'bg-red-50 text-red-700 border-red-200',
    },
    {
      type: 'quote' as ElementType,
      title: 'Quote',
      desc: 'Highlighted quote box with an accent rule',
      icon: Quote,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      type: 'divider' as ElementType,
      title: 'Divider Line',
      desc: 'Clean horizontal rule line',
      icon: Minus,
      color: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    {
      type: 'custom-html' as ElementType,
      title: 'HTML Block',
      desc: 'Paste raw HTML table or custom elements',
      icon: Code,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
  ];

  return (
    <aside className="w-full lg:w-80 bg-white border-r border-slate-200 flex flex-col h-full text-slate-800">
      {/* Preset / open-file picker */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 pt-4 pb-3">
        <label
          htmlFor="template-preset"
          className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5"
        >
          Template
        </label>
        <select
          id="template-preset"
          value={activePresetId}
          onChange={(e) => onSelectPreset(e.target.value)}
          className="w-full bg-white text-xs font-semibold text-slate-700 border border-slate-200 rounded-md px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer shadow-xs hover:border-slate-300"
        >
          {openFileName && (
            <option value="__open-file__">📄 {openFileName}</option>
          )}
          <option value="blank">Blank Canvas</option>
          <option value="announcement">General Announcement</option>
        </select>
      </div>

      {/* Sidebar Header Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 p-1.5">
        <button
          onClick={() => setActiveTab('elements')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
            activeTab === 'elements'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Elements</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Canvas Style</span>
        </button>
      </div>

      {/* Tab 1: Add Elements Palette */}
      {activeTab === 'elements' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Add HTML Elements
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Drag an element onto a section in the canvas. Every block lives
              inside a section — add a <strong>Section</strong> first, then fill
              it.
            </p>
          </div>

          {/* Where a *clicked* block will land. Dragging ignores this. */}
          {addTargetLabel ? (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-900">
              <CornerDownRight className="w-3.5 h-3.5 text-red-700 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold truncate">
                  Adding into “{addTargetLabel}”
                </p>
                <p className="text-[10px] text-red-800/80">
                  Clicking a block below puts it in this section.
                </p>
              </div>
              {onClearAddTarget && (
                <button
                  type="button"
                  onClick={onClearAddTarget}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-200 bg-white/70 hover:bg-white text-red-800 shrink-0 cursor-pointer"
                  title="Deselect this section"
                >
                  Clear
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
              <MousePointerClick className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-[10px] leading-relaxed">
                No section selected. Drag a block onto a section, or select a
                section first to add by clicking.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {elementCategories.map((item) => {
              const Icon = item.icon;
              const isDragging = draggingType === item.type;
              return (
                <button
                  key={item.type}
                  draggable
                  onDragStart={(e) => {
                    // Some payload is required or the drag never starts.
                    e.dataTransfer.setData('text/plain', item.type);
                    e.dataTransfer.effectAllowed = 'copy';
                    setDraggingType(item.type);
                    onStartPaletteDrag?.(item.type);
                  }}
                  onDragEnd={() => {
                    setDraggingType(null);
                    onEndPaletteDrag?.();
                  }}
                  onClick={() => onAddElement(item.type)}
                  title={
                    isContainerType(item.type)
                      ? 'Drag onto the canvas, or click to add'
                      : 'Drag onto a section, or select a section and click'
                  }
                  className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3 group shadow-2xs cursor-grab active:cursor-grabbing ${
                    isDragging
                      ? 'opacity-40 border-red-300 bg-red-50'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100/80'
                  }`}
                >
                  <div
                    className={`p-2 rounded-md border ${item.color} group-hover:scale-105 transition-transform`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-red-700 transition-colors">
                        {item.title}
                      </h4>
                      {item.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                  <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-red-700 self-center shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Canvas & Email Settings */}
      {activeTab === 'settings' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-red-700" />
              Global Email Style
            </h3>
            <p className="text-[11px] text-slate-500 mb-4">
              Configure overall widths, fonts, and background colors for the output HTML.
            </p>
          </div>

          {/* Project name — used for the saved filename and the email's <title> */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700">Newsletter Name</label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => onRenameTemplate(e.target.value)}
              placeholder="Untitled Newsletter"
              className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 focus:ring-1 focus:ring-red-500 font-semibold"
            />
            <p className="text-[10px] text-slate-500">
              Names the saved project file and the exported HTML.
            </p>
          </div>

          {/* Email Container Width */}
          <div className="space-y-1.5">
            <label className="text-slate-700 font-semibold flex justify-between">
              <span>Container Max Width</span>
              <span className="text-slate-500 font-mono">{settings.width}px</span>
            </label>
            <input
              type="range"
              min="500"
              max="700"
              step="10"
              value={settings.width}
              onChange={(e) => onUpdateSettings({ width: Number(e.target.value) })}
              className="w-full accent-red-700 bg-slate-200 rounded cursor-pointer"
            />
            <p className="text-[10px] text-slate-500">600px is standard email width across clients.</p>
          </div>

          {/* Background Outer Color */}
          <div className="space-y-1.5">
            <label className="text-slate-700 font-semibold flex justify-between items-center">
              <span>Outer Background</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.bgColor}
                  onChange={(e) => onUpdateSettings({ bgColor: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="text-slate-500 font-mono">{settings.bgColor}</span>
              </div>
            </label>
          </div>

          {/* Email Card Color */}
          <div className="space-y-1.5">
            <label className="text-slate-700 font-semibold flex justify-between items-center">
              <span>Email Card Background</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.cardBgColor}
                  onChange={(e) => onUpdateSettings({ cardBgColor: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="text-slate-500 font-mono">{settings.cardBgColor}</span>
              </div>
            </label>
          </div>

          {/* Primary Text Color */}
          <div className="space-y-1.5">
            <label className="text-slate-700 font-semibold flex justify-between items-center">
              <span>Primary Text Color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.textColor}
                  onChange={(e) => onUpdateSettings({ textColor: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="text-slate-500 font-mono">{settings.textColor}</span>
              </div>
            </label>
          </div>

          {/* Accent Border Color */}
          <div className="space-y-1.5">
            <label className="text-slate-700 font-semibold flex justify-between items-center">
              <span>Accent Red Color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.accentColor}
                  onChange={(e) => onUpdateSettings({ accentColor: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="text-slate-500 font-mono">{settings.accentColor}</span>
              </div>
            </label>
          </div>

          {/* Font Family */}
          <div className="space-y-1.5">
            <label className="text-slate-700 font-semibold">Font Family</label>
            <select
              value={settings.fontFamily}
              onChange={(e) => onUpdateSettings({ fontFamily: e.target.value })}
              className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
            >
              <option value='"Helvetica Neue", Helvetica, Arial, sans-serif'>
                Helvetica Neue / Arial (Clean Sans)
              </option>

              <option value='Georgia, "Times New Roman", serif'>
                Georgia / Serif
              </option>
              <option value='"Trebuchet MS", "Lucida Grande", sans-serif'>
                Trebuchet MS
              </option>
              <option value='Verdana, Geneva, sans-serif'>Verdana</option>
            </select>
          </div>

          {/* Inner Padding */}
          <div className="space-y-1.5">
            <label className="text-slate-700 font-semibold flex justify-between">
              <span>Card Inner Padding</span>
              <span className="text-slate-500 font-mono">{settings.padding}px</span>
            </label>
            <input
              type="range"
              min="10"
              max="40"
              step="2"
              value={settings.padding}
              onChange={(e) => onUpdateSettings({ padding: Number(e.target.value) })}
              className="w-full accent-red-700 bg-slate-200 rounded cursor-pointer"
            />
          </div>
        </div>
      )}
    </aside>
  );
};
