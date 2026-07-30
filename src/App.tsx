import React, { useState, useEffect, useMemo } from 'react';
import {
  NewsletterTemplate,
  EmailElement,
  ElementType,
  EmailSettings,
  AccentSectionElement,
} from './types';
import {
  WEDNESDAY_STUDY_TEMPLATE,
  PRESET_TEMPLATES,
} from './utils/defaultTemplate';
import { generateEmailHtml } from './utils/htmlGenerator';
import { createNewElement } from './utils/elementHelpers';
import { Navbar } from './components/Navbar';
import { SidebarElements } from './components/SidebarElements';
import { VisualCanvas } from './components/VisualCanvas';
import { InspectorPanel, InspectorTab } from './components/InspectorPanel';
import { CodeEditor } from './components/CodeEditor';
import { AddElementModal } from './components/AddElementModal';
import { ImportHtmlModal } from './components/ImportHtmlModal';
import { ExportModal } from './components/ExportModal';

const LOCAL_STORAGE_KEY = 'gmail_newsletter_designer_template_v1';

export default function App() {
  // 1. Initial State from LocalStorage or Default Wednesday Study Template
  const [template, setTemplate] = useState<NewsletterTemplate>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse local storage template', e);
    }
    return WEDNESDAY_STUDY_TEMPLATE;
  });

  const [activePresetId, setActivePresetId] = useState<string>('wednesday-study');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('design');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile' | 'code'>('desktop');

  /**
   * Selecting a different block lands on Design; the canvas `</>` badge opts
   * into HTML. Re-selecting the block already open keeps the current tab so an
   * in-progress HTML draft survives a stray click on the canvas.
   */
  const handleSelectElement = (id: string | null) => {
    if (id !== selectedElementId) setInspectorTab('design');
    setSelectedElementId(id);
  };

  const handleViewElementHtml = (id: string) => {
    setSelectedElementId(id);
    setInspectorTab('html');
  };

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto Save to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(template));
    } catch (e) {
      console.error('Failed to save template to local storage', e);
    }
  }, [template]);

  // Generate Email HTML
  const emailHtml = useMemo(() => {
    return generateEmailHtml(template);
  }, [template]);

  // Helper to search element by ID across top-level and nested children
  const findElementById = (
    elements: EmailElement[],
    id: string
  ): EmailElement | null => {
    for (const el of elements) {
      if (el.id === id) return el;
      if (el.type === 'accent-section' && el.childElements) {
        const foundChild = findElementById(el.childElements, id);
        if (foundChild) return foundChild;
      }
    }
    return null;
  };

  const selectedElement = useMemo(() => {
    if (!selectedElementId) return null;
    return findElementById(template.elements, selectedElementId);
  }, [template, selectedElementId]);

  // Preset Selector
  const handleSelectPreset = (presetId: string) => {
    const preset = PRESET_TEMPLATES.find((p) => p.id === presetId);
    if (preset) {
      setTemplate(JSON.parse(JSON.stringify(preset)));
      setActivePresetId(presetId);
      setSelectedElementId(null);
    }
  };

  // Reset to Original Wednesday Study
  const handleReset = () => {
    if (
      window.confirm(
        'Reset newsletter template back to the original Wednesday Study email?'
      )
    ) {
      setTemplate(JSON.parse(JSON.stringify(WEDNESDAY_STUDY_TEMPLATE)));
      setActivePresetId('wednesday-study');
      setSelectedElementId(null);
    }
  };

  // Add Element
  const handleAddElement = (type: ElementType) => {
    const newEl = createNewElement(type);
    setTemplate((prev) => ({
      ...prev,
      elements: [...prev.elements, newEl],
    }));
    setSelectedElementId(newEl.id);
  };

  // Add Child Element inside Accent Section
  const handleAddChildToAccent = (parentId: string, type: ElementType) => {
    const newChild = createNewElement(type);
    setTemplate((prev) => {
      const updateList = (elements: EmailElement[]): EmailElement[] => {
        return elements.map((el) => {
          if (el.id === parentId && el.type === 'accent-section') {
            return {
              ...el,
              childElements: [...(el.childElements || []), newChild],
            };
          }
          if (el.type === 'accent-section' && el.childElements) {
            return {
              ...el,
              childElements: updateList(el.childElements),
            };
          }
          return el;
        });
      };
      return {
        ...prev,
        elements: updateList(prev.elements),
      };
    });
    setSelectedElementId(newChild.id);
  };

  // Update Element
  const handleUpdateElement = (updatedEl: EmailElement) => {
    setTemplate((prev) => {
      const updateList = (elements: EmailElement[]): EmailElement[] => {
        return elements.map((el) => {
          if (el.id === updatedEl.id) {
            return updatedEl;
          }
          if (el.type === 'accent-section' && el.childElements) {
            return {
              ...el,
              childElements: updateList(el.childElements),
            };
          }
          return el;
        });
      };
      return {
        ...prev,
        elements: updateList(prev.elements),
      };
    });
  };

  // Delete Element
  const handleDeleteElement = (id: string) => {
    setTemplate((prev) => {
      const deleteFromList = (elements: EmailElement[]): EmailElement[] => {
        return elements
          .filter((el) => el.id !== id)
          .map((el) => {
            if (el.type === 'accent-section' && el.childElements) {
              return {
                ...el,
                childElements: deleteFromList(el.childElements),
              };
            }
            return el;
          });
      };
      return {
        ...prev,
        elements: deleteFromList(prev.elements),
      };
    });
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
  };

  // Duplicate Element
  const handleDuplicateElement = (id: string) => {
    setTemplate((prev) => {
      const duplicateInList = (elements: EmailElement[]): EmailElement[] => {
        const result: EmailElement[] = [];
        for (const el of elements) {
          result.push(el);
          if (el.id === id) {
            const cloned = JSON.parse(JSON.stringify(el));
            cloned.id = `el-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            result.push(cloned);
          } else if (el.type === 'accent-section' && el.childElements) {
            el.childElements = duplicateInList(el.childElements);
          }
        }
        return result;
      };
      return {
        ...prev,
        elements: duplicateInList(prev.elements),
      };
    });
  };

  // Move Up
  const handleMoveUp = (id: string) => {
    setTemplate((prev) => {
      const moveInList = (elements: EmailElement[]): EmailElement[] => {
        const idx = elements.findIndex((e) => e.id === id);
        if (idx > 0) {
          const newArr = [...elements];
          const temp = newArr[idx - 1];
          newArr[idx - 1] = newArr[idx];
          newArr[idx] = temp;
          return newArr;
        }
        return elements.map((el) => {
          if (el.type === 'accent-section' && el.childElements) {
            return {
              ...el,
              childElements: moveInList(el.childElements),
            };
          }
          return el;
        });
      };
      return {
        ...prev,
        elements: moveInList(prev.elements),
      };
    });
  };

  // Move Down
  const handleMoveDown = (id: string) => {
    setTemplate((prev) => {
      const moveInList = (elements: EmailElement[]): EmailElement[] => {
        const idx = elements.findIndex((e) => e.id === id);
        if (idx >= 0 && idx < elements.length - 1) {
          const newArr = [...elements];
          const temp = newArr[idx + 1];
          newArr[idx + 1] = newArr[idx];
          newArr[idx] = temp;
          return newArr;
        }
        return elements.map((el) => {
          if (el.type === 'accent-section' && el.childElements) {
            return {
              ...el,
              childElements: moveInList(el.childElements),
            };
          }
          return el;
        });
      };
      return {
        ...prev,
        elements: moveInList(prev.elements),
      };
    });
  };

  // Update Settings
  const handleUpdateSettings = (newSettings: Partial<EmailSettings>) => {
    setTemplate((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...newSettings,
      },
    }));
  };

  // Copy HTML
  const handleCopyHtml = () => {
    navigator.clipboard.writeText(emailHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download HTML file
  const handleDownloadHtml = () => {
    const blob = new Blob([emailHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.toLowerCase().replace(/[^a-z0-0]/g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import Raw HTML
  const handleImportRawHtml = (rawHtml: string) => {
    const newEl = createNewElement('custom-html');
    if (newEl.type === 'custom-html') {
      newEl.html = rawHtml;
    }
    setTemplate((prev) => ({
      ...prev,
      elements: [...prev.elements, newEl],
    }));
    setSelectedElementId(newEl.id);
  };

  // Open Preview in New Tab
  const handleOpenNewTab = () => {
    const blob = new Blob([emailHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-800">
      {/* Top Navbar */}
      <Navbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        activePresetId={activePresetId}
        onSelectPreset={handleSelectPreset}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onExportHtml={() => setIsExportModalOpen(true)}
        onCopyHtml={handleCopyHtml}
        onOpenNewTab={handleOpenNewTab}
        copied={copied}
        onReset={handleReset}
      />

      {/* Main Studio Workbench Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Element Library & Palette */}
        {viewMode !== 'code' && (
          <SidebarElements
            onAddElement={handleAddElement}
            settings={template.settings}
            onUpdateSettings={handleUpdateSettings}
            selectedElementCount={template.elements.length}
          />
        )}

        {/* Center Canvas / Code View */}
        {viewMode === 'code' ? (
          <CodeEditor
            htmlCode={emailHtml}
            onCopy={handleCopyHtml}
            copied={copied}
            onDownload={handleDownloadHtml}
          />
        ) : (
          <VisualCanvas
            template={template}
            selectedElementId={selectedElementId}
            onSelectElement={handleSelectElement}
            onUpdateElement={handleUpdateElement}
            onDeleteElement={handleDeleteElement}
            onDuplicateElement={handleDuplicateElement}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            viewMode={viewMode}
            onOpenNewTab={handleOpenNewTab}
            onViewElementHtml={handleViewElementHtml}
          />
        )}

        {/* Right Sidebar: Element Inspector Panel */}
        {viewMode !== 'code' && selectedElement && (
          <InspectorPanel
            element={selectedElement}
            onUpdateElement={handleUpdateElement}
            onDeleteElement={handleDeleteElement}
            onDuplicateElement={handleDuplicateElement}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onClose={() => handleSelectElement(null)}
            onAddChildToAccent={handleAddChildToAccent}
            fontFamily={template.settings.fontFamily}
            activeTab={inspectorTab}
            onChangeTab={setInspectorTab}
          />
        )}
      </div>

      {/* Modals */}
      <AddElementModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSelectType={handleAddElement}
      />

      <ImportHtmlModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportHtml={handleImportRawHtml}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        htmlCode={emailHtml}
        onCopy={handleCopyHtml}
        copied={copied}
        onDownload={handleDownloadHtml}
        onOpenNewTab={handleOpenNewTab}
      />
    </div>
  );
}
