import React, { useState } from 'react';
import { ElementType, EmailSettings } from '../types';
import {
  Image,
  Type,
  ListOrdered,
  FileText,
  MousePointerClick,
  Quote,
  Minus,
  Code,
  Layout,
  Plus,
  Settings,
  ChevronDown,
  ChevronUp,
  Palette,
} from 'lucide-react';

interface SidebarElementsProps {
  onAddElement: (type: ElementType) => void;
  settings: EmailSettings;
  onUpdateSettings: (newSettings: Partial<EmailSettings>) => void;
  selectedElementCount: number;
}

export const SidebarElements: React.FC<SidebarElementsProps> = ({
  onAddElement,
  settings,
  onUpdateSettings,
  selectedElementCount,
}) => {
  const [activeTab, setActiveTab] = useState<'elements' | 'settings'>('elements');
  const [accentOpen, setAccentOpen] = useState(true);

  const elementCategories = [
    {
      type: 'accent-section' as ElementType,
      title: 'Red Accent Block',
      desc: 'Container with left colored border (Gmail study style)',
      icon: Layout,
      color: 'bg-red-50 text-red-700 border-red-200',
      badge: 'Popular',
    },
    {
      type: 'header-image' as ElementType,
      title: 'Header Logo / Banner',
      desc: 'Top brand image or banner (e.g. JH Outback San Diego)',
      icon: Image,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      type: 'heading' as ElementType,
      title: 'Section Heading',
      desc: 'Large title or subtitle with letter spacing',
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
      type: 'button' as ElementType,
      title: 'CTA Button',
      desc: 'Red call-to-action button (PDF read & print link)',
      icon: MousePointerClick,
      color: 'bg-red-50 text-red-700 border-red-200',
    },
    {
      type: 'quote' as ElementType,
      title: 'Quote / Scripture Box',
      desc: 'Highlighted quote or scripture reference box',
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
      title: 'Custom HTML Block',
      desc: 'Paste raw HTML table or custom elements',
      icon: Code,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
  ];

  return (
    <aside className="w-full lg:w-80 bg-white border-r border-slate-200 flex flex-col h-full text-slate-800">
      {/* Sidebar Header Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 p-1.5">
        <button
          onClick={() => setActiveTab('elements')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
            activeTab === 'elements'
              ? 'bg-red-700 text-white shadow-xs'
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
              ? 'bg-red-700 text-white shadow-xs'
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
              Click any element below to insert it into your newsletter template.
            </p>
          </div>

          <div className="space-y-2">
            {elementCategories.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  onClick={() => onAddElement(item.type)}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100/80 transition-all flex items-start gap-3 group cursor-pointer shadow-2xs"
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
                  <Plus className="w-4 h-4 text-slate-400 group-hover:text-red-700 self-center" />
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
