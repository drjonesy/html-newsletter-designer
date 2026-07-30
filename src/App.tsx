import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  NewsletterTemplate,
  EmailElement,
  ElementType,
  EmailSettings,
} from './types';
import {
  BLANK_CANVAS_TEMPLATE,
  PRESET_TEMPLATES,
} from './utils/defaultTemplate';
import { generateEmailHtml } from './utils/htmlGenerator';
import {
  canSitAtTopLevel,
  createBareSection,
  createNewElement,
  isContainerElement,
  migrateToSections,
} from './utils/elementHelpers';
import {
  parseTemplateFile,
  serializeTemplateFile,
  suggestTemplateFileName,
  TEMPLATE_FILE_EXTENSION,
} from './utils/templateFile';
import { Navbar } from './components/Navbar';
import { SidebarElements } from './components/SidebarElements';
import { VisualCanvas } from './components/VisualCanvas';
import { InspectorPanel, InspectorTab } from './components/InspectorPanel';
import { CodeEditor } from './components/CodeEditor';
import { ViewModeToggle } from './components/ViewModeToggle';
import { ImportHtmlModal } from './components/ImportHtmlModal';
import { ExportModal } from './components/ExportModal';

const LOCAL_STORAGE_KEY = 'gmail_newsletter_designer_template_v1';

/** Preset-dropdown value standing in for "whatever project file is open". */
const OPEN_FILE_PRESET_ID = '__open-file__';

interface Notice {
  tone: 'success' | 'warning' | 'error';
  message: string;
}

/**
 * Restores the auto-saved template, bringing anything saved before blocks were
 * required to live in sections into line with that rule.
 *
 * Runs once, as a lazy `useState` initializer, and reports how much it had to
 * wrap so the user can be told their work was restructured.
 */
function loadInitialTemplate(): {
  template: NewsletterTemplate;
  wrappedInSections: number;
} {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as NewsletterTemplate;
      if (Array.isArray(parsed?.elements)) {
        const migrated = migrateToSections(parsed.elements);
        return {
          template: { ...parsed, elements: migrated.elements },
          wrappedInSections: migrated.wrapped,
        };
      }
    }
  } catch (e) {
    console.error('Failed to parse local storage template', e);
  }
  return { template: BLANK_CANVAS_TEMPLATE, wrappedInSections: 0 };
}

export default function App() {
  // 1. Initial State from LocalStorage or the default Blank Canvas template
  const [restored] = useState(loadInitialTemplate);
  const [template, setTemplate] = useState<NewsletterTemplate>(
    restored.template
  );

  const [activePresetId, setActivePresetId] = useState<string>('blank');
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

  /**
   * The palette item currently being dragged onto the canvas, if any.
   *
   * This lives here rather than in either component because the drag starts in
   * `SidebarElements` and is resolved in `VisualCanvas`, and `dataTransfer`
   * can't be read during `dragover` — the canvas has to know what's coming to
   * decide whether a given block is a legal drop target.
   */
  const [paletteDragType, setPaletteDragType] = useState<ElementType | null>(
    null
  );

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Project files
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [openFileName, setOpenFileName] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Auto Save to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(template));
    } catch (e) {
      console.error('Failed to save template to local storage', e);
    }
  }, [template]);

  // Tell the user if restoring their work restructured it.
  useEffect(() => {
    if (restored.wrappedInSections === 0) return;
    setNotice({
      tone: 'success',
      message: `Blocks now live inside sections. ${restored.wrappedInSections} loose block${
        restored.wrappedInSections === 1 ? '' : 's'
      } in your saved newsletter ${
        restored.wrappedInSections === 1 ? 'was' : 'were'
      } wrapped in a section. The exported HTML is unchanged — the section has no borders or padding until you give it some.`,
    });
  }, [restored.wrappedInSections]);

  // Confirmations fade on their own; problems stay until dismissed.
  useEffect(() => {
    if (notice?.tone !== 'success') return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

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
      if (isContainerElement(el) && el.childElements) {
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

  /**
   * Which container a newly added block should land in: the selected container
   * itself, or the one holding the selected block. Null means top level.
   *
   * This is what makes "build everything inside sections" the natural flow
   * without forcing it — select a section, and the palette fills it.
   */
  const findContainerFor = (
    elements: EmailElement[],
    id: string
  ): EmailElement | null => {
    for (const el of elements) {
      if (!isContainerElement(el)) continue;
      if ((el.childElements || []).some((child) => child.id === id)) return el;
      const nested = findContainerFor(el.childElements || [], id);
      if (nested) return nested;
    }
    return null;
  };

  const addTarget = useMemo(() => {
    if (!selectedElement || !selectedElementId) return null;
    if (isContainerElement(selectedElement)) return selectedElement;
    return findContainerFor(template.elements, selectedElementId);
  }, [template, selectedElement, selectedElementId]);

  // Preset Selector
  const handleSelectPreset = (presetId: string) => {
    const preset = PRESET_TEMPLATES.find((p) => p.id === presetId);
    if (preset) {
      setTemplate(JSON.parse(JSON.stringify(preset)));
      setActivePresetId(presetId);
      setSelectedElementId(null);
      setOpenFileName(null);
    }
  };

  /**
   * Start a brand-new newsletter from the blank canvas. Ids are regenerated so
   * the new project never collides with the one it replaced (an open project
   * file, a duplicated block) — otherwise selection would follow stale ids.
   */
  const handleNewNewsletter = () => {
    if (
      !window.confirm(
        'Start a new newsletter? The one you’re working on will be lost unless you’ve saved it to a file.'
      )
    ) {
      return;
    }

    const blank: NewsletterTemplate = JSON.parse(
      JSON.stringify(BLANK_CANVAS_TEMPLATE)
    );
    const freshId = () =>
      `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const reid = (elements: EmailElement[]): EmailElement[] =>
      elements.map((el) =>
        isContainerElement(el) && el.childElements
          ? { ...el, id: freshId(), childElements: reid(el.childElements) }
          : { ...el, id: freshId() }
      );

    setTemplate({
      ...blank,
      id: `newsletter-${Date.now()}`,
      name: 'Untitled Newsletter',
      elements: reid(blank.elements),
    });
    setActivePresetId('blank');
    setSelectedElementId(null);
    setInspectorTab('design');
    setOpenFileName(null);
    setNotice(null);
  };

  // Add Child Element inside a container (Section)
  const handleAddChildToContainer = (parentId: string, type: ElementType) => {
    const newChild = createNewElement(type);
    setTemplate((prev) => {
      const updateList = (elements: EmailElement[]): EmailElement[] => {
        return elements.map((el) => {
          if (!isContainerElement(el)) return el;
          if (el.id === parentId) {
            return {
              ...el,
              childElements: [...(el.childElements || []), newChild],
            };
          }
          return {
            ...el,
            childElements: updateList(el.childElements || []),
          };
        });
      };
      return {
        ...prev,
        elements: updateList(prev.elements),
      };
    });
    setSelectedElementId(newChild.id);
  };

  /**
   * Add a block from the palette by clicking it.
   *
   * Non-container blocks have to land in a section, so a click needs one to
   * aim at: the selected section, or the section holding the selected block.
   * With nothing selected there's no sensible destination — say so rather than
   * dropping the block loose at the end of the email.
   */
  const handleAddElement = (type: ElementType) => {
    if (addTarget) {
      handleAddChildToContainer(addTarget.id, type);
      return;
    }

    if (!canSitAtTopLevel(type)) {
      setNotice({
        tone: 'warning',
        message:
          'Blocks live inside sections. Drag this onto a section on the canvas, or select a section first and then click it.',
      });
      return;
    }

    const newEl = createNewElement(type);
    setTemplate((prev) => ({
      ...prev,
      elements: [...prev.elements, newEl],
    }));
    setSelectedElementId(newEl.id);
  };

  /**
   * Insert `node` relative to `targetId`. A null target appends to the top
   * level, which is how the first section lands on an empty canvas.
   *
   * Shared by palette drops and by reordering, so both resolve a drop position
   * the same way.
   */
  const insertRelativeTo = (
    elements: EmailElement[],
    targetId: string | null,
    position: 'before' | 'after' | 'inside',
    node: EmailElement
  ): EmailElement[] => {
    if (targetId === null) return [...elements, node];

    const result: EmailElement[] = [];
    for (const el of elements) {
      let next: EmailElement = isContainerElement(el)
        ? {
            ...el,
            childElements: insertRelativeTo(
              el.childElements || [],
              targetId,
              position,
              node
            ),
          }
        : el;
      if (el.id === targetId && position === 'inside' && isContainerElement(next)) {
        next = { ...next, childElements: [...(next.childElements || []), node] };
      }
      if (el.id === targetId && position === 'before') result.push(node);
      result.push(next);
      if (el.id === targetId && position === 'after') result.push(node);
    }
    return result;
  };

  /** Drop of a brand-new block dragged out of the palette. */
  const handleDropNewElement = (
    type: ElementType,
    targetId: string | null,
    position: 'before' | 'after' | 'inside'
  ) => {
    const newEl = createNewElement(type);
    setTemplate((prev) => ({
      ...prev,
      elements: insertRelativeTo(prev.elements, targetId, position, newEl),
    }));
    setSelectedElementId(newEl.id);
    setPaletteDragType(null);
  };

  // Update Element
  const handleUpdateElement = (updatedEl: EmailElement) => {
    setTemplate((prev) => {
      const updateList = (elements: EmailElement[]): EmailElement[] => {
        return elements.map((el) => {
          if (el.id === updatedEl.id) {
            return updatedEl;
          }
          if (isContainerElement(el) && el.childElements) {
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
            if (isContainerElement(el) && el.childElements) {
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
    // Every block in the copy needs a fresh id, children included — duplicate
    // ids in the tree would make selection and updates hit both copies.
    const reidDeep = (el: EmailElement): EmailElement => {
      const fresh = {
        ...el,
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      };
      return isContainerElement(fresh)
        ? { ...fresh, childElements: (fresh.childElements || []).map(reidDeep) }
        : fresh;
    };

    setTemplate((prev) => {
      const duplicateInList = (elements: EmailElement[]): EmailElement[] => {
        const result: EmailElement[] = [];
        for (const el of elements) {
          if (el.id !== id && isContainerElement(el) && el.childElements) {
            result.push({
              ...el,
              childElements: duplicateInList(el.childElements),
            });
            continue;
          }
          result.push(el);
          if (el.id === id) {
            result.push(reidDeep(JSON.parse(JSON.stringify(el))));
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
          if (isContainerElement(el) && el.childElements) {
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
          if (isContainerElement(el) && el.childElements) {
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

  /**
   * Drag-and-drop reorder: pull `dragId` out of wherever it lives and drop it
   * before/after `targetId`, or — with `position: 'inside'` — append it as the
   * last child of `targetId`. Because the target may sit in a different list
   * than the source, this doubles as "move in/out of a section"; the only guard
   * is that a container can't be dropped inside its own subtree, which would
   * detach it from the tree entirely.
   */
  const handleReorderElement = (
    dragId: string,
    targetId: string,
    position: 'before' | 'after' | 'inside'
  ) => {
    if (dragId === targetId) return;

    setTemplate((prev) => {
      const dragged = findElementById(prev.elements, dragId);
      const target = findElementById(prev.elements, targetId);
      if (!dragged || !target) return prev;
      if (findElementById([dragged], targetId)) return prev;

      // Dropping "inside" something that can't hold children lands after it.
      const resolved =
        position === 'inside' && !isContainerElement(target) ? 'after' : position;

      // Landing beside a top-level block means landing at the top level, which
      // only containers may do. The canvas doesn't offer such a drop; this is
      // the backstop.
      if (
        resolved !== 'inside' &&
        !canSitAtTopLevel(dragged.type) &&
        !findContainerFor(prev.elements, targetId)
      ) {
        return prev;
      }

      const removeFromList = (elements: EmailElement[]): EmailElement[] =>
        elements
          .filter((el) => el.id !== dragId)
          .map((el) =>
            isContainerElement(el) && el.childElements
              ? { ...el, childElements: removeFromList(el.childElements) }
              : el
          );

      return {
        ...prev,
        elements: insertRelativeTo(
          removeFromList(prev.elements),
          targetId,
          resolved,
          dragged
        ),
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

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download HTML file
  const handleDownloadHtml = () => {
    const slug =
      template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') ||
      'newsletter';
    downloadBlob(new Blob([emailHtml], { type: 'text/html;charset=utf-8' }), `${slug}.html`);
  };

  // Save the editable project to a local .newsletter.json file
  const handleSaveTemplateFile = () => {
    const filename = openFileName ?? suggestTemplateFileName(template);
    downloadBlob(
      new Blob([serializeTemplateFile(template)], {
        type: 'application/json;charset=utf-8',
      }),
      filename
    );
    setOpenFileName(filename);
    setActivePresetId(OPEN_FILE_PRESET_ID);
    setNotice({
      tone: 'success',
      message: `Saved ${filename} to your downloads folder. Open it again with the Open button.`,
    });
  };

  // Load a project file the user picks from disk
  const handleOpenTemplateFile = async (file: File) => {
    let text: string;
    try {
      text = await file.text();
    } catch {
      setNotice({ tone: 'error', message: `Could not read ${file.name}.` });
      return;
    }

    const result = parseTemplateFile(text);
    if (result.status === 'error') {
      setNotice({ tone: 'error', message: result.error });
      return;
    }

    const confirmed = window.confirm(
      `Open "${result.template.name}" from ${file.name}?\n\nThis replaces the newsletter you're working on. Anything you haven't saved to a file will be lost.`
    );
    if (!confirmed) return;

    setTemplate(result.template);
    setOpenFileName(file.name);
    setActivePresetId(OPEN_FILE_PRESET_ID);
    setSelectedElementId(null);
    setInspectorTab('design');
    // Wrapping loose blocks isn't a failure — report it separately from
    // anything that genuinely couldn't be read.
    const migrationNote =
      result.wrappedInSections > 0
        ? ` ${result.wrappedInSections} loose block${
            result.wrappedInSections === 1 ? '' : 's'
          } ${
            result.wrappedInSections === 1 ? 'was' : 'were'
          } wrapped in a section, since blocks now live inside sections. The exported HTML is unchanged.`
        : '';

    setNotice(
      result.warnings.length > 0
        ? {
            tone: 'warning',
            message: `Opened ${file.name}, but some of it couldn't be read: ${result.warnings.join(
              ' '
            )}${migrationNote}`,
          }
        : {
            tone: 'success',
            message: `Opened ${file.name}.${migrationNote}`,
          }
    );
  };

  const handleTemplateFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear the input so re-picking the same file still fires a change event.
    e.target.value = '';
    if (file) void handleOpenTemplateFile(file);
  };

  // Rename the project (drives the saved filename and the email's <title>)
  const handleRenameTemplate = (name: string) => {
    setTemplate((prev) => ({ ...prev, name }));
  };

  /**
   * Import Raw HTML as a `custom-html` block. That isn't a container, so it
   * can't go at the top level — it lands in the selected section, or in a new
   * bare section of its own when there isn't one.
   */
  const handleImportRawHtml = (rawHtml: string) => {
    const newEl = createNewElement('custom-html');
    if (newEl.type === 'custom-html') {
      newEl.html = rawHtml;
    }

    if (addTarget) {
      setTemplate((prev) => ({
        ...prev,
        elements: insertRelativeTo(prev.elements, addTarget.id, 'inside', newEl),
      }));
    } else {
      const wrapper = createBareSection(
        `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        [newEl]
      );
      setTemplate((prev) => ({
        ...prev,
        elements: [...prev.elements, wrapper],
      }));
    }
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
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onExportHtml={() => setIsExportModalOpen(true)}
        onCopyHtml={handleCopyHtml}
        copied={copied}
        onNewNewsletter={handleNewNewsletter}
        onSaveTemplateFile={handleSaveTemplateFile}
        onOpenTemplateFile={() => fileInputRef.current?.click()}
      />

      {/* Project file picker, opened from the Navbar */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleTemplateFileInput}
        accept={`${TEMPLATE_FILE_EXTENSION},.json,application/json`}
        className="hidden"
      />

      {/* Save / open result banner */}
      {notice && (
        <div
          role="status"
          className={`flex items-start gap-2 px-4 py-2 text-xs font-semibold border-b ${
            notice.tone === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : notice.tone === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span className="flex-1 leading-relaxed">{notice.message}</span>
          <button
            onClick={() => setNotice(null)}
            className="shrink-0 opacity-60 hover:opacity-100 font-bold px-1 cursor-pointer"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Studio Workbench Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Element Library & Palette */}
        {viewMode !== 'code' && (
          <SidebarElements
            onAddElement={handleAddElement}
            settings={template.settings}
            onUpdateSettings={handleUpdateSettings}
            selectedElementCount={template.elements.length}
            templateName={template.name}
            onRenameTemplate={handleRenameTemplate}
            activePresetId={activePresetId}
            onSelectPreset={handleSelectPreset}
            openFileName={openFileName}
            addTargetLabel={addTarget ? addTarget.label || 'Section' : null}
            onClearAddTarget={() => handleSelectElement(null)}
            onStartPaletteDrag={setPaletteDragType}
            onEndPaletteDrag={() => setPaletteDragType(null)}
          />
        )}

        {/*
          Center column: the view switch sits in its own strip above the
          preview. It has to live out here rather than inside `VisualCanvas`,
          because code view swaps that component out for `CodeEditor` and the
          way back to Desktop is in the switch.
        */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="bg-slate-100 px-4 pt-3 pb-1 flex items-center justify-center shrink-0">
            <ViewModeToggle
              viewMode={viewMode}
              setViewMode={setViewMode}
              onOpenNewTab={handleOpenNewTab}
            />
          </div>

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
              onReorderElement={handleReorderElement}
              viewMode={viewMode}
              onViewElementHtml={handleViewElementHtml}
              paletteDragType={paletteDragType}
              onDropNewElement={handleDropNewElement}
            />
          )}
        </div>

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
            fontFamily={template.settings.fontFamily}
            activeTab={inspectorTab}
            onChangeTab={setInspectorTab}
          />
        )}
      </div>

      {/* Modals */}
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
