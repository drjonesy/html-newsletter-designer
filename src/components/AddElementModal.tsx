import React from 'react';
import { ElementType } from '../types';
import {
  X,
  Layout,
  Image,
  Type,
  ListOrdered,
  FileText,
  MousePointerClick,
  Quote,
  Minus,
  Code,
  Plus,
  Square,
} from 'lucide-react';

interface AddElementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: ElementType) => void;
}

export const AddElementModal: React.FC<AddElementModalProps> = ({
  isOpen,
  onClose,
  onSelectType,
}) => {
  if (!isOpen) return null;

  const elements = [
    {
      type: 'section' as ElementType,
      title: 'Section',
      desc: 'Box with per-side borders and padding — drop other blocks inside it',
      icon: Square,
      color: 'bg-slate-100 text-slate-700 border-slate-200',
      tag: 'Container',
    },
    {
      type: 'accent-section' as ElementType,
      title: 'Red Accent Block',
      desc: 'Container with left colored border for highlighting a section',
      icon: Layout,
      color: 'bg-red-50 text-red-700 border-red-200',
      tag: 'Gmail Template Style',
    },
    {
      type: 'header-image' as ElementType,
      title: 'Header Banner / Logo',
      desc: 'Top image banner with logo (e.g. JH Outback San Diego)',
      icon: Image,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      type: 'heading' as ElementType,
      title: 'Section Heading',
      desc: 'Title text with custom level, color, and uppercase styling',
      icon: Type,
      color: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    {
      type: 'key-value' as ElementType,
      title: 'Date & Location Pair',
      desc: 'Key-value info (e.g. Date & Time, Location: Above the Offices)',
      icon: ListOrdered,
      color: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    {
      type: 'paragraph' as ElementType,
      title: 'Paragraph Text',
      desc: 'Formatted copy with rich text, scripture citations, and links',
      icon: FileText,
      color: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    {
      type: 'button' as ElementType,
      title: 'CTA Button',
      desc: 'Red link button (e.g. Week 1 - Read & Print out)',
      icon: MousePointerClick,
      color: 'bg-red-50 text-red-700 border-red-200',
    },
    {
      type: 'quote' as ElementType,
      title: 'Quote / Scripture Box',
      desc: 'Highlighted scripture box or quote block',
      icon: Quote,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      type: 'divider' as ElementType,
      title: 'Divider Line',
      desc: 'Horizontal rule line separator',
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
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col text-slate-800 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Add New Email Element</h2>
            <p className="text-xs text-slate-500">Select a block to add to your newsletter canvas</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Elements */}
        <div className="p-4 overflow-y-auto space-y-2.5">
          {elements.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                onClick={() => {
                  onSelectType(item.type);
                  onClose();
                }}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-red-300 bg-slate-50 hover:bg-slate-100 transition-all flex items-start gap-3 group cursor-pointer shadow-2xs"
              >
                <div className={`p-2.5 rounded-lg border ${item.color} group-hover:scale-105 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 group-hover:text-red-700 transition-colors">
                      {item.title}
                    </h3>
                    {item.tag && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                        {item.tag}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                </div>
                <Plus className="w-4 h-4 text-slate-400 group-hover:text-red-700 self-center" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
