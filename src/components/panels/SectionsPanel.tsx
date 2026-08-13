import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
import { EmailElement } from '../../types';
import {
  blockName,
  canNest,
  canSitAtTopLevel,
  isContainerElement,
} from '../../utils/elementHelpers';
import { DropPosition, useDesigner } from '../../state/DesignerContext';
import { InlineRename } from '../controls';
import { blockIcon } from './blockIcons';
import { PanelBody, PanelHeader } from './PanelHeader';

/** Where a dragged row would land, as the outline is currently showing it. */
interface DropTarget {
  id: string;
  position: DropPosition;
}

const childrenOf = (el: EmailElement): EmailElement[] =>
  isContainerElement(el) ? el.childElements || [] : [];

/**
 * The email's structure, as a tree: every section, and every block inside it,
 * however deep — Header ▸ 2 Columns ▸ Column ▸ Heading, Button.
 *
 * The canvas is still where you *work* inside a section; this is the document
 * outline, and it earns its place by being the one view that can reach a block
 * the canvas can't easily hit — a section almost entirely covered by its
 * children, or a column whose padding is a few pixels wide.
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
  const [drop, setDrop] = useState<DropTarget | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const sections = template.elements.filter(isContainerElement);

  /**
   * Every block's parent, so a drop can be judged before it happens.
   *
   * `reorderElement` refuses an illegal move anyway, but a refusal is silent —
   * the outline has to know *while dragging* whether to draw the line, or a
   * paragraph would appear to be droppable straight into a row.
   */
  const parents = useMemo(() => {
    const map = new Map<string, EmailElement | null>();
    const walk = (list: EmailElement[], parent: EmailElement | null) => {
      for (const el of list) {
        map.set(el.id, parent);
        walk(childrenOf(el), el);
      }
    };
    walk(template.elements, null);
    return map;
  }, [template.elements]);

  const ancestorsOf = (id: string): EmailElement[] => {
    const out: EmailElement[] = [];
    for (let p = parents.get(id); p; p = parents.get(p.id)) out.push(p);
    return out;
  };

  /*
    A block selected on the canvas has to be visible here, or the outline
    disagrees with the canvas about where you are. Collapsing is an explicit
    act, so re-opening a branch the user closed is the lesser surprise.
  */
  useEffect(() => {
    if (!selectedElementId) return;
    const path = ancestorsOf(selectedElementId).map((el) => el.id);
    setCollapsed((prev) => {
      if (!path.some((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      path.forEach((id) => next.delete(id));
      return next;
    });
  }, [selectedElementId, parents]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const dragged = dragId ? findInTree(template.elements, dragId) : null;

  /**
   * May `dragged` land there? The same two rules every placement path asks —
   * only containers sit at the top level, and `canNest` for everything else —
   * applied to whichever list the drop would put the block in.
   */
  const legalDrop = (target: EmailElement, position: DropPosition): boolean => {
    if (!dragged || dragged.id === target.id) return false;
    // A container dropped into its own subtree would detach from the tree.
    if (ancestorsOf(target.id).some((el) => el.id === dragged.id)) return false;

    const parent =
      position === 'inside' ? target : parents.get(target.id) ?? null;
    return parent
      ? canNest(dragged.type, parent.type)
      : canSitAtTopLevel(dragged.type);
  };

  /**
   * Containers reserve a band at each edge for before/after and take the middle
   * as "inside", the same bargain the canvas strikes. A plain block only ever
   * splits in half — there is no inside to aim at.
   */
  const positionFor = (
    e: React.DragEvent,
    el: EmailElement
  ): DropPosition | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offset = (e.clientY - rect.top) / (rect.height || 1);
    const candidates: DropPosition[] = isContainerElement(el)
      ? [offset < 0.3 ? 'before' : offset > 0.7 ? 'after' : 'inside']
      : [offset > 0.5 ? 'after' : 'before'];
    // When the obvious position is illegal, the other legal one still beats
    // a dead row: dropping onto a row's heading means "into the row".
    const order = candidates.concat(
      (['inside', 'before', 'after'] as DropPosition[]).filter(
        (p) => !candidates.includes(p)
      )
    );
    return order.find((p) => legalDrop(el, p)) ?? null;
  };

  const rename = (el: EmailElement, name: string) =>
    updateElement({ ...el, label: name });

  /*
    A plain recursive function rather than a nested component: a component
    declared inside this one is a new type on every render, which would remount
    the subtree and take the focus out of the rename input mid-word.
  */
  const renderNode = (el: EmailElement, depth: number): React.ReactNode => {
    const active = selectedElementId === el.id;
    const kids = childrenOf(el);
    const container = isContainerElement(el);
    const open = container && !collapsed.has(el.id);
    const here = drop?.id === el.id ? drop : null;
    const Icon = blockIcon(el);
    const top = depth === 0;

    return (
      <li key={el.id} className="relative">
        <div
          draggable={renamingId !== el.id}
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = 'move';
            setDragId(el.id);
          }}
          onDragEnd={() => {
            setDragId(null);
            setDrop(null);
          }}
          onDragOver={(e) => {
            if (!dragged) return;
            const position = positionFor(e, el);
            if (!position) return;
            // Only a legal target claims the event — an illegal row lets it
            // bubble to its parent, which may well accept the block.
            e.preventDefault();
            e.stopPropagation();
            setDrop((prev) =>
              prev?.id === el.id && prev.position === position
                ? prev
                : { id: el.id, position }
            );
          }}
          onDragLeave={(e) => {
            // Ignore the leave that fires when the cursor crosses onto a child
            // of this row — the row is still under the pointer.
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDrop((prev) => (prev?.id === el.id ? null : prev));
          }}
          onDrop={(e) => {
            if (!dragId || !here) return;
            e.preventDefault();
            e.stopPropagation();
            reorderElement(dragId, el.id, here.position);
            setDragId(null);
            setDrop(null);
          }}
          className={`group relative ml-3 flex items-center gap-1 rounded-lg pr-1 ${
            top ? 'py-1.5' : 'py-1'
          } ${dragId === el.id ? 'opacity-40' : ''} ${
            here?.position === 'inside' ? 'ring-2 ring-accent-400' : ''
          } ${active ? 'bg-accent-50' : 'hover:bg-slate-50'}`}
        >
          {here && here.position !== 'inside' && (
            <span
              className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-accent-500 ${
                here.position === 'after' ? '-bottom-px' : '-top-px'
              }`}
            />
          )}

          {/* The horizontal tick joining this row to its branch's rule. */}
          <span className="pointer-events-none absolute -left-3 top-1/2 h-px w-3 border-t border-dashed border-slate-300" />

          {container && kids.length > 0 ? (
            <button
              type="button"
              onClick={() => toggle(el.id)}
              className="flex h-5 w-4 shrink-0 items-center justify-center rounded text-slate-400 hover:text-slate-700"
              aria-label={`${open ? 'Collapse' : 'Expand'} ${blockName(el)}`}
              aria-expanded={open}
            >
              {open ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="h-5 w-4 shrink-0" />
          )}

          <button
            type="button"
            onClick={() => select(el.id)}
            className={`flex shrink-0 items-center justify-center rounded-md border ${
              top ? 'h-9 w-9' : 'h-7 w-7'
            } ${
              active
                ? 'border-accent-300 bg-white text-accent-600'
                : 'border-slate-200 bg-white text-slate-500'
            }`}
            aria-label={`Select ${blockName(el)}`}
          >
            <Icon className={top ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
          </button>

          <InlineRename
            value={blockName(el)}
            onChange={(name) => rename(el, name)}
            editing={renamingId === el.id}
            onEditingChange={(editing) =>
              setRenamingId(editing ? el.id : null)
            }
            className={`min-w-0 flex-1 truncate rounded px-1 py-1 text-left ${
              top ? 'text-base' : 'text-sm'
            } ${active ? 'font-semibold text-accent-800' : 'text-slate-800'}`}
            inputClassName={`min-w-0 flex-1 rounded border border-accent-500 px-1 py-1 text-slate-900 outline-none ${
              top ? 'text-base' : 'text-sm'
            }`}
          />

          <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              title={`Duplicate ${blockName(el)}`}
              onClick={() => duplicateElement(el.id)}
              className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-slate-800"
            >
              <Copy className={top ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
            </button>
            <button
              type="button"
              title={`Delete ${blockName(el)}`}
              onClick={() => deleteElement(el.id)}
              className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-red-600"
            >
              <Trash2 className={top ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
            </button>
          </div>
        </div>

        {open && (
          <ul className="ml-7 border-l border-dashed border-slate-300">
            {kids.length > 0 ? (
              kids.map((child) => renderNode(child, depth + 1))
            ) : (
              <li className="relative">
                <span className="pointer-events-none absolute left-0 top-1/2 h-px w-3 border-t border-dashed border-slate-300" />
                <p className="ml-3 py-1 pl-5 text-xs italic text-slate-400">
                  Empty
                </p>
              </li>
            )}
          </ul>
        )}
      </li>
    );
  };

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
            so it's a border on each list rather than an element per row.
          */}
          <ul className="ml-3 border-l border-dashed border-slate-300">
            {sections.map((section) => renderNode(section, 0))}
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

/** The dragged block itself, wherever it lives in the tree. */
function findInTree(list: EmailElement[], id: string): EmailElement | null {
  for (const el of list) {
    if (el.id === id) return el;
    const found = findInTree(childrenOf(el), id);
    if (found) return found;
  }
  return null;
}
