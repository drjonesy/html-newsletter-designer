import React, { useState } from 'react';
import { Columns3, Copy, Plus, Rows3, Trash2 } from 'lucide-react';
import { EmailElement } from '../../types';
import { blockName, isContainerElement } from '../../utils/elementHelpers';
import { useDesigner } from '../../state/DesignerContext';
import { InlineRename } from '../controls';
import { PanelBody, PanelHeader } from './PanelHeader';

/**
 * The email's structure, one row per top-level section.
 *
 * Deliberately only the top level. This is the document outline — Header, Body,
 * Footer — not a tree view of every block; the canvas is where you work inside
 * a section. It's also the most reliable way to select a section that's full of
 * children, which is otherwise almost entirely covered by them.
 */
export const SectionsPanel: React.FC = () => {
  const {
    template,
    selectedElementId,
    select,
    updateElement,
    duplicateElement,
    deleteElement,
    reorderElement,
    addBlankSection,
  } = useDesigner();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<{
    id: string;
    after: boolean;
  } | null>(null);

  const sections = template.elements.filter(isContainerElement);

  const rename = (el: EmailElement, name: string) =>
    updateElement({ ...el, label: name });

  return (
    <>
      <PanelHeader
        title="Email Sections"
        subtitle="Create and edit your email structure."
      />

      <PanelBody>
        <div className="px-5 pb-5">
          {sections.length === 0 && (
            <p className="mb-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-xs text-slate-500">
              No sections yet. Add one — every block lives inside a section.
            </p>
          )}

          {/*
            The dashed rule joining the rows, from the design. Purely decorative,
            so it's a border on the list rather than an element per row.
          */}
          <ul className="ml-3 border-l border-dashed border-slate-300">
            {sections.map((section) => {
              const active = selectedElementId === section.id;
              const drop = dropId?.id === section.id ? dropId : null;
              // A row of columns can sit at the top level too, and the outline
              // is the reliable way to select one — but it isn't a section, so
              // it shouldn't wear a section's icon.
              const Icon = section.type === 'row' ? Columns3 : Rows3;

              return (
                <li
                  key={section.id}
                  draggable={renamingId !== section.id}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    setDragId(section.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDropId(null);
                  }}
                  onDragOver={(e) => {
                    if (!dragId || dragId === section.id) return;
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const after = e.clientY - rect.top > rect.height / 2;
                    setDropId((prev) =>
                      prev?.id === section.id && prev.after === after
                        ? prev
                        : { id: section.id, after }
                    );
                  }}
                  onDrop={(e) => {
                    if (!dragId || dragId === section.id) return;
                    e.preventDefault();
                    reorderElement(
                      dragId,
                      section.id,
                      drop?.after ? 'after' : 'before'
                    );
                    setDragId(null);
                    setDropId(null);
                  }}
                  className={`relative -ml-px border-l border-dashed border-transparent ${
                    dragId === section.id ? 'opacity-40' : ''
                  }`}
                >
                  {drop && (
                    <span
                      className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-accent-500 ${
                        drop.after ? 'bottom-0' : 'top-0'
                      }`}
                    />
                  )}

                  {/* The horizontal tick joining this row to the rule. */}
                  <span className="absolute left-0 top-1/2 h-px w-3 border-t border-dashed border-slate-300" />

                  <div
                    className={`group ml-3 flex items-center gap-2 rounded-lg py-1.5 pl-1 pr-1 ${
                      active ? 'bg-accent-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => select(section.id)}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
                        active
                          ? 'border-accent-300 bg-white text-accent-600'
                          : 'border-slate-200 bg-white text-slate-500'
                      }`}
                      aria-label={`Select ${blockName(section)}`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>

                    <InlineRename
                      value={blockName(section)}
                      onChange={(name) => rename(section, name)}
                      editing={renamingId === section.id}
                      onEditingChange={(editing) =>
                        setRenamingId(editing ? section.id : null)
                      }
                      className={`min-w-0 flex-1 truncate rounded px-1 py-1 text-left text-base ${
                        active ? 'font-semibold text-accent-800' : 'text-slate-800'
                      }`}
                      inputClassName="min-w-0 flex-1 rounded border border-accent-500 px-1 py-1 text-base text-slate-900 outline-none"
                    />

                    <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        title="Duplicate section"
                        onClick={() => duplicateElement(section.id)}
                        className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-slate-800"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Delete section"
                        onClick={() => deleteElement(section.id)}
                        className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={addBlankSection}
            className="mt-2 flex items-center gap-3 rounded-lg py-1.5 pl-1 pr-3 text-base text-slate-800 hover:bg-slate-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-600">
              <Plus className="h-5 w-5" />
            </span>
            Add blank section
          </button>
        </div>
      </PanelBody>
    </>
  );
};
