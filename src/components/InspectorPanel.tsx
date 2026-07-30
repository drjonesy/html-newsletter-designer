import React, { useRef } from 'react';
import { EmailElement, ElementType } from '../types';
import {
  X,
  ChevronUp,
  ChevronDown,
  Trash2,
  Copy,
  Plus,
  Image,
  Type,
  MousePointerClick,
  FileText,
  Palette,
  Link,
  Upload,
  Bold,
  Italic,
} from 'lucide-react';

interface TextStyleTogglesProps {
  bold: boolean;
  italic: boolean;
  onChange: (next: { bold: boolean; italic: boolean }) => void;
  label?: string;
}

/** Shared Bold (<strong>) / Italic (<em>) toggle pair used by every text block. */
const TextStyleToggles: React.FC<TextStyleTogglesProps> = ({
  bold,
  italic,
  onChange,
  label = 'Text Style',
}) => {
  const baseClass =
    'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border text-[11px] transition-colors';
  const activeClass = 'bg-red-700 border-red-700 text-white';
  const idleClass =
    'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-200';

  return (
    <div className="space-y-1">
      <label className="font-semibold text-slate-700">{label}</label>
      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={bold}
          onClick={() => onChange({ bold: !bold, italic })}
          className={`${baseClass} ${bold ? activeClass : idleClass}`}
          title="Bold / Strong"
        >
          <Bold className="w-3.5 h-3.5" />
          <span className="font-bold">Bold</span>
        </button>
        <button
          type="button"
          aria-pressed={italic}
          onClick={() => onChange({ bold, italic: !italic })}
          className={`${baseClass} ${italic ? activeClass : idleClass}`}
          title="Italic / Emphasis"
        >
          <Italic className="w-3.5 h-3.5" />
          <span className="italic font-semibold">Italic</span>
        </button>
      </div>
    </div>
  );
};

interface InspectorPanelProps {
  element: EmailElement | null;
  onUpdateElement: (updated: EmailElement) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onClose: () => void;
  onAddChildToAccent?: (parentId: string, type: ElementType) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  element,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onMoveUp,
  onMoveDown,
  onClose,
  onAddChildToAccent,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const paragraphRef = useRef<HTMLTextAreaElement | null>(null);

  if (!element) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && element.type === 'header-image') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          onUpdateElement({
            ...element,
            src: evt.target.result as string,
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * Wraps the text currently selected in the content textarea. With no selection
   * the tags are inserted at the caret so the user can type between them.
   */
  const insertTagToParagraph = (openTag: string, closeTag: string) => {
    if (element.type !== 'paragraph') return;

    const textarea = paragraphRef.current;
    const content = element.content;
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? content.length;
    const selected = content.slice(start, end);

    const inserted = `${openTag}${selected}${closeTag}`;
    onUpdateElement({
      ...element,
      content: content.slice(0, start) + inserted + content.slice(end),
    });

    // Put the caret back inside the new tags after React re-renders.
    const caret = start + openTag.length + selected.length;
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + openTag.length, caret);
    });
  };

  return (
    <div className="w-full lg:w-80 bg-white border-l border-slate-200 flex flex-col h-full text-slate-800 z-30 shadow-md">
      {/* Panel Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Edit Element Properties
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMoveUp(element.id)}
            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors"
            title="Move Up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => onMoveDown(element.id)}
            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors"
            title="Move Down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDuplicateElement(element.id)}
            className="p-1 text-slate-500 hover:text-amber-600 hover:bg-slate-200/60 rounded transition-colors"
            title="Duplicate Block"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeleteElement(element.id)}
            className="p-1 text-slate-500 hover:text-red-600 hover:bg-slate-200/60 rounded transition-colors"
            title="Delete Block"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor Controls Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Header Image Editor */}
        {element.type === 'header-image' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Image Source (URL or File)</label>
              <input
                type="text"
                value={element.src}
                onChange={(e) => onUpdateElement({ ...element, src: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 focus:ring-1 focus:ring-red-500 font-mono text-[11px]"
                placeholder="https://..."
              />
              <div className="pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded p-2 font-semibold cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-red-700" />
                  <span>Upload Image File</span>
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Alt Text</label>
              <input
                type="text"
                value={element.alt}
                onChange={(e) => onUpdateElement({ ...element, alt: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Width (px)</label>
                <input
                  type="number"
                  value={element.width}
                  onChange={(e) =>
                    onUpdateElement({ ...element, width: Number(e.target.value) })
                  }
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Alignment</label>
                <select
                  value={element.alignment}
                  onChange={(e) =>
                    onUpdateElement({
                      ...element,
                      alignment: e.target.value as 'left' | 'center' | 'right',
                    })
                  }
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 focus:ring-1 focus:ring-red-500"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Link URL (Optional)</label>
              <input
                type="text"
                value={element.href || ''}
                onChange={(e) => onUpdateElement({ ...element, href: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 focus:ring-1 focus:ring-red-500 font-mono text-[11px]"
                placeholder="https://..."
              />
            </div>
          </div>
        )}

        {/* Heading Editor */}
        {element.type === 'heading' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Heading Text</label>
              <input
                type="text"
                value={element.text}
                onChange={(e) => onUpdateElement({ ...element, text: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 focus:ring-1 focus:ring-red-500 text-sm font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Tag Level</label>
                <select
                  value={element.level}
                  onChange={(e) =>
                    onUpdateElement({
                      ...element,
                      level: e.target.value as 'h1' | 'h2' | 'h3',
                    })
                  }
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
                >
                  <option value="h1">H1 (Large)</option>
                  <option value="h2">H2 (Medium)</option>
                  <option value="h3">H3 (Subhead)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Font Size (px)</label>
                <input
                  type="number"
                  value={element.fontSize}
                  onChange={(e) =>
                    onUpdateElement({ ...element, fontSize: Number(e.target.value) })
                  }
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
                />
              </div>
            </div>

            <TextStyleToggles
              bold={(element.fontWeight ?? 'bold') === 'bold'}
              italic={(element.fontStyle ?? 'normal') === 'italic'}
              onChange={({ bold, italic }) =>
                onUpdateElement({
                  ...element,
                  fontWeight: bold ? 'bold' : 'normal',
                  fontStyle: italic ? 'italic' : 'normal',
                })
              }
            />

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Text Transform</label>
              <select
                value={element.transform}
                onChange={(e) =>
                  onUpdateElement({
                    ...element,
                    transform: e.target.value as 'uppercase' | 'capitalize' | 'none',
                  })
                }
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
              >
                <option value="uppercase">UPPERCASE (e.g. WEDNESDAY STUDY)</option>
                <option value="capitalize">Capitalize Words</option>
                <option value="none">Normal Case</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 flex justify-between">
                <span>Heading Color</span>
                <span className="font-mono text-slate-500">{element.color}</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={element.color}
                  onChange={(e) => onUpdateElement({ ...element, color: e.target.value })}
                  className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => onUpdateElement({ ...element, color: '#1a2b56' })}
                  className="text-[10px] px-2 py-1 bg-slate-100 rounded border border-slate-200 text-slate-700 hover:bg-slate-200 font-semibold"
                >
                  Dark Navy
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateElement({ ...element, color: '#b22222' })}
                  className="text-[10px] px-2 py-1 bg-slate-100 rounded border border-slate-200 text-slate-700 hover:bg-slate-200 font-semibold"
                >
                  Red Accent
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Key-Value Editor */}
        {element.type === 'key-value' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Label Text (e.g. Date & Time:)</label>
              <input
                type="text"
                value={element.label}
                onChange={(e) => onUpdateElement({ ...element, label: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Value Text</label>
              <input
                type="text"
                value={element.value}
                onChange={(e) => onUpdateElement({ ...element, value: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Font Size (px)</label>
              <input
                type="number"
                value={element.fontSize}
                onChange={(e) =>
                  onUpdateElement({ ...element, fontSize: Number(e.target.value) })
                }
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
              />
            </div>

            <TextStyleToggles
              label="Label Style"
              bold={element.boldLabel !== false}
              italic={!!element.italicLabel}
              onChange={({ bold, italic }) =>
                onUpdateElement({ ...element, boldLabel: bold, italicLabel: italic })
              }
            />

            <TextStyleToggles
              label="Value Style"
              bold={!!element.boldValue}
              italic={!!element.italicValue}
              onChange={({ bold, italic }) =>
                onUpdateElement({ ...element, boldValue: bold, italicValue: italic })
              }
            />
          </div>
        )}

        {/* Paragraph Editor */}
        {element.type === 'paragraph' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">Content (HTML / Rich Text)</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => insertTagToParagraph('<strong>', '</strong>')}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-slate-700 border border-slate-200"
                    title="Bold the selected text (<strong>)"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTagToParagraph('<em>', '</em>')}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] italic font-semibold text-slate-700 border border-slate-200"
                    title="Italicize the selected text (<em>)"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      insertTagToParagraph('<font color="#990000">', '</font>')
                    }
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-red-700 border border-slate-200"
                    title="Red Text"
                  >
                    Red
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTagToParagraph('<br>', '')}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-mono text-slate-700 border border-slate-200"
                    title="Line Break"
                  >
                    br
                  </button>
                </div>
              </div>
              <textarea
                ref={paragraphRef}
                rows={6}
                value={element.content}
                onChange={(e) => onUpdateElement({ ...element, content: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 font-sans text-xs leading-relaxed focus:ring-1 focus:ring-red-500"
              />
              <p className="text-[10px] text-slate-500">
                Select text above, then press B or I to style just that phrase.
              </p>
            </div>

            <TextStyleToggles
              label="Whole Block Style"
              bold={(element.fontWeight ?? 'normal') === 'bold'}
              italic={(element.fontStyle ?? 'normal') === 'italic'}
              onChange={({ bold, italic }) =>
                onUpdateElement({
                  ...element,
                  fontWeight: bold ? 'bold' : 'normal',
                  fontStyle: italic ? 'italic' : 'normal',
                })
              }
            />

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Font Size (px)</label>
                <input
                  type="number"
                  value={element.fontSize}
                  onChange={(e) =>
                    onUpdateElement({ ...element, fontSize: Number(e.target.value) })
                  }
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Line Height</label>
                <input
                  type="number"
                  step="0.1"
                  value={element.lineHeight}
                  onChange={(e) =>
                    onUpdateElement({ ...element, lineHeight: Number(e.target.value) })
                  }
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
                />
              </div>
            </div>
          </div>
        )}

        {/* CTA Button Editor */}
        {element.type === 'button' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Button Label</label>
              <input
                type="text"
                value={element.text}
                onChange={(e) => onUpdateElement({ ...element, text: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Destination URL</label>
              <input
                type="text"
                value={element.url}
                onChange={(e) => onUpdateElement({ ...element, url: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 font-mono text-[11px]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 flex justify-between">
                <span>Background Color</span>
                <span className="font-mono text-slate-500">{element.bgColor}</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={element.bgColor}
                  onChange={(e) => onUpdateElement({ ...element, bgColor: e.target.value })}
                  className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => onUpdateElement({ ...element, bgColor: '#b22222' })}
                  className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-slate-700 font-semibold"
                >
                  Gmail Red (#b22222)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateElement({ ...element, bgColor: '#1a2b56' })}
                  className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-slate-700 font-semibold"
                >
                  Navy Blue
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Border Radius (px)</label>
                <input
                  type="number"
                  value={element.borderRadius}
                  onChange={(e) =>
                    onUpdateElement({ ...element, borderRadius: Number(e.target.value) })
                  }
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Alignment</label>
                <select
                  value={element.alignment}
                  onChange={(e) =>
                    onUpdateElement({
                      ...element,
                      alignment: e.target.value as 'left' | 'center' | 'right',
                    })
                  }
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Accent Section Wrapper Editor */}
        {element.type === 'accent-section' && (
          <div className="space-y-3">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-900 text-xs">
              <p className="font-bold mb-1 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-red-700" />
                Red Accent Line Section
              </p>
              <p className="text-[11px] text-red-800">
                This block wraps child elements inside a clean vertical accent border on the left side, matching your Gmail email screenshot.
              </p>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 flex justify-between">
                <span>Left Border Color</span>
                <span className="font-mono text-slate-500">{element.borderColor}</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={element.borderColor}
                  onChange={(e) =>
                    onUpdateElement({ ...element, borderColor: e.target.value })
                  }
                  className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => onUpdateElement({ ...element, borderColor: '#b22222' })}
                  className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-slate-700 font-semibold"
                >
                  Gmail Red (#b22222)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Border Width (px)</label>
                <input
                  type="number"
                  value={element.borderWidth}
                  onChange={(e) =>
                    onUpdateElement({
                      ...element,
                      borderWidth: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Padding Left (px)</label>
                <input
                  type="number"
                  value={element.paddingLeft}
                  onChange={(e) =>
                    onUpdateElement({
                      ...element,
                      paddingLeft: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2"
                />
              </div>
            </div>

            {/* Quick Add nested element into this section */}
            {onAddChildToAccent && (
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <label className="font-semibold text-slate-700 block">
                  Add Item Inside Accent Line:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onAddChildToAccent(element.id, 'heading')}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-[11px] text-slate-800 font-semibold text-left"
                  >
                    + Heading
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddChildToAccent(element.id, 'key-value')}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-[11px] text-slate-800 font-semibold text-left"
                  >
                    + Date / Info
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddChildToAccent(element.id, 'paragraph')}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-[11px] text-slate-800 font-semibold text-left"
                  >
                    + Text Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddChildToAccent(element.id, 'button')}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-[11px] text-slate-800 font-semibold text-left"
                  >
                    + CTA Button
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quote / Scripture Editor */}
        {element.type === 'quote' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Quote / Scripture</label>
              <textarea
                rows={3}
                value={element.quote}
                onChange={(e) => onUpdateElement({ ...element, quote: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 italic"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Reference / Author</label>
              <input
                type="text"
                value={element.author || ''}
                onChange={(e) => onUpdateElement({ ...element, author: e.target.value })}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded p-2 font-semibold"
              />
            </div>

            <TextStyleToggles
              bold={(element.fontWeight ?? 'normal') === 'bold'}
              italic={(element.fontStyle ?? 'italic') === 'italic'}
              onChange={({ bold, italic }) =>
                onUpdateElement({
                  ...element,
                  fontWeight: bold ? 'bold' : 'normal',
                  fontStyle: italic ? 'italic' : 'normal',
                })
              }
            />
          </div>
        )}

        {/* Custom HTML Editor */}
        {element.type === 'custom-html' && (
          <div className="space-y-2">
            <label className="font-semibold text-slate-700">Raw HTML Code</label>
            <textarea
              rows={8}
              value={element.html}
              onChange={(e) => onUpdateElement({ ...element, html: e.target.value })}
              className="w-full bg-slate-900 font-mono text-[11px] text-slate-100 border border-slate-800 rounded p-2 focus:ring-1 focus:ring-red-500"
            />
          </div>
        )}
      </div>
    </div>
  );
};
