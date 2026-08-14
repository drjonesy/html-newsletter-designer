import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ElementType,
  EmailElement,
  EmailSettings,
  NewsletterTemplate,
} from '../types';
import {
  BLANK_CANVAS_TEMPLATE,
  PRESET_TEMPLATES,
} from '../utils/defaultTemplate';
import { generateEmailHtml } from '../utils/htmlGenerator';
import {
  BlockRecipe,
  canNest,
  canSitAtTopLevel,
  createBareSection,
  createFromRecipe,
  createNewElement,
  evenWidths,
  isContainerElement,
  migrateToSections,
  recipeType,
} from '../utils/elementHelpers';
import {
  parseTemplateFile,
  serializeTemplateFile,
  suggestTemplateFileName,
} from '../utils/templateFile';
import {
  CommitOptions,
  TemplateUpdate,
  useTemplateHistory,
} from './useTemplateHistory';

const LOCAL_STORAGE_KEY = 'gmail_newsletter_designer_template_v1';

/** How long "Saving…" stays up. Purely so the state is legible. */
const SAVE_FLASH_MS = 500;

export type RailTab = 'blocks' | 'sections' | 'theme' | 'addons' | 'help';
export type InspectorTab = 'content' | 'styles' | 'visibility' | 'code';
export type ViewMode = 'desktop' | 'mobile';
export type PanelMode = 'rail' | 'inspector';
export type SaveStatus = 'saved' | 'saving';
export type DropPosition = 'before' | 'after' | 'inside';

export interface Notice {
  tone: 'success' | 'warning' | 'error';
  message: string;
}

export interface DesignerValue {
  template: NewsletterTemplate;
  settings: EmailSettings;
  /** The whole email as sendable HTML. Memoised on `template`. */
  emailHtml: string;

  selectedElementId: string | null;
  selectedElement: EmailElement | null;
  /** The container a palette click would add into, or null. */
  addTarget: EmailElement | null;
  select: (id: string | null) => void;

  // Mutations. Nothing outside this module writes to the template.
  addElement: (recipe: BlockRecipe) => void;
  dropNewElement: (
    recipe: BlockRecipe,
    targetId: string | null,
    position: DropPosition
  ) => void;
  updateElement: (element: EmailElement, opts?: CommitOptions) => void;
  deleteElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  moveUp: (id: string) => void;
  moveDown: (id: string) => void;
  reorderElement: (
    dragId: string,
    targetId: string,
    position: DropPosition
  ) => void;
  updateSettings: (patch: Partial<EmailSettings>, opts?: CommitOptions) => void;
  renameTemplate: (name: string) => void;
  addBlankSection: () => void;

  // Project lifecycle
  newNewsletter: () => void;
  applyPreset: (presetId: string) => void;
  saveTemplateFile: () => void;
  openTemplateFile: (file: File) => Promise<void>;
  importRawHtml: (html: string) => void;
  /** Both default to the ordinary export — pass markup to save or preview another build. */
  downloadHtml: (html?: string) => void;
  openInNewTab: (html?: string) => void;
  openFileName: string | null;
  saveStatus: SaveStatus;

  history: {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
  };

  ui: {
    railTab: RailTab;
    setRailTab: (tab: RailTab) => void;
    /**
     * Which of the two things the single left panel is showing.
     *
     * Separate from `selectedElementId` on purpose: a section stays selected
     * while you browse the palette, because it's the section a clicked block
     * lands in. Deriving the panel from "is something selected" instead would
     * hide the palette the moment you picked a destination for it.
     */
    panelMode: PanelMode;
    /** Back out of the inspector without dropping the selection. */
    showRailPanel: () => void;
    inspectorTab: InspectorTab;
    setInspectorTab: (tab: InspectorTab) => void;
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    previewOpen: boolean;
    setPreviewOpen: (open: boolean) => void;
    exportOpen: boolean;
    setExportOpen: (open: boolean) => void;
    importOpen: boolean;
    setImportOpen: (open: boolean) => void;
    /**
     * The palette item being dragged, as a recipe rather than a type: the
     * canvas has to know what's coming to decide whether a block is a legal
     * target, and `dataTransfer` can't be read during `dragover`.
     */
    paletteDrag: BlockRecipe | null;
    setPaletteDrag: (recipe: BlockRecipe | null) => void;
  };

  notice: Notice | null;
  setNotice: (notice: Notice | null) => void;
}

const DesignerContext = createContext<DesignerValue | null>(null);

const freshId = (prefix = 'el') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/* ---------------------------------------------------------------------------
   Tree helpers.

   Every one of these recurses through `isContainerElement` rather than testing
   `type === 'section'`, so the row/column containers coming in phase 2 only
   have to join the `ContainerElement` union — not be chased through each walk.
   --------------------------------------------------------------------------- */

function findElementById(
  elements: EmailElement[],
  id: string
): EmailElement | null {
  for (const el of elements) {
    if (el.id === id) return el;
    if (isContainerElement(el)) {
      const found = findElementById(el.childElements || [], id);
      if (found) return found;
    }
  }
  return null;
}

/** The container holding `id`, or null when it sits at the top level. */
function findContainerFor(
  elements: EmailElement[],
  id: string
): EmailElement | null {
  for (const el of elements) {
    if (!isContainerElement(el)) continue;
    if ((el.childElements || []).some((child) => child.id === id)) return el;
    const nested = findContainerFor(el.childElements || [], id);
    if (nested) return nested;
  }
  return null;
}

function mapTree(
  elements: EmailElement[],
  fn: (el: EmailElement) => EmailElement
): EmailElement[] {
  return elements.map((el) => {
    const next = fn(el);
    return isContainerElement(next)
      ? { ...next, childElements: mapTree(next.childElements || [], fn) }
      : next;
  });
}

function removeFromTree(elements: EmailElement[], id: string): EmailElement[] {
  return elements
    .filter((el) => el.id !== id)
    .map((el) =>
      isContainerElement(el)
        ? { ...el, childElements: removeFromTree(el.childElements || [], id) }
        : el
    );
}

/**
 * Inserts `node` relative to `targetId`. A null target appends to the top
 * level, which is how the first section lands on an empty canvas.
 */
function insertRelativeTo(
  elements: EmailElement[],
  targetId: string | null,
  position: DropPosition,
  node: EmailElement
): EmailElement[] {
  if (targetId === null) return [...elements, node];

  const out: EmailElement[] = [];
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
    if (el.id === targetId && position === 'before') out.push(node);
    out.push(next);
    if (el.id === targetId && position === 'after') out.push(node);
  }
  return out;
}

/**
 * Swaps `id` with its neighbour in whichever list it lives in.
 *
 * Recurses only when the id isn't in the current list, so a block never moves
 * in a parent list because a same-named child existed deeper down.
 */
function moveWithinList(
  elements: EmailElement[],
  id: string,
  delta: -1 | 1
): EmailElement[] {
  const index = elements.findIndex((el) => el.id === id);
  if (index >= 0) {
    const target = index + delta;
    if (target < 0 || target >= elements.length) return elements;
    const next = [...elements];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  }

  return elements.map((el) =>
    isContainerElement(el)
      ? { ...el, childElements: moveWithinList(el.childElements || [], id, delta) }
      : el
  );
}

/**
 * Re-evens the columns of one row.
 *
 * Called after a column is added or removed, because the old split no longer
 * adds up: deleting one of two 50% columns would otherwise leave the row half
 * empty, and duplicating one would total 150%. Only the row that changed is
 * touched, so a deliberate custom split elsewhere survives.
 */
function evenRowWidths(
  elements: EmailElement[],
  rowId: string
): EmailElement[] {
  return mapTree(elements, (el) => {
    if (el.type !== 'row' || el.id !== rowId) return el;
    const children = el.childElements || [];
    const widths = evenWidths(children.length);
    return {
      ...el,
      childElements: children.map((child, i) =>
        child.type === 'column' ? { ...child, width: widths[i] } : child
      ),
    };
  });
}

/** Deep copy with every id regenerated — duplicate ids break selection. */
function reidDeep(el: EmailElement): EmailElement {
  const fresh = { ...el, id: freshId() };
  return isContainerElement(fresh)
    ? { ...fresh, childElements: (fresh.childElements || []).map(reidDeep) }
    : fresh;
}

/**
 * Restores the auto-saved template, bringing anything saved before blocks had
 * to live in sections into line with that rule.
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

/**
 * The single owner of application state.
 *
 * v1 kept this in `App.tsx` and drilled it down as props, which worked while
 * the tree was three components wide. v2 nests four deep — shell, panel,
 * inspector, tab, field — so the same state is published through one context
 * instead. Ownership hasn't moved: nothing below here mutates the template, it
 * calls one of these handlers, and every handler goes through `commit` so
 * undo/redo sees everything.
 */
export const DesignerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [restored] = useState(loadInitialTemplate);
  const { template, commit, reset, undo, redo, canUndo, canRedo } =
    useTemplateHistory(restored.template);

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [railTab, setRailTabRaw] = useState<RailTab>('blocks');
  const [panelMode, setPanelMode] = useState<PanelMode>('rail');
  const [inspectorTab, setInspectorTabRaw] = useState<InspectorTab>('styles');
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [paletteDrag, setPaletteDrag] = useState<BlockRecipe | null>(null);
  const [openFileName, setOpenFileName] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  /* --- Autosave ---------------------------------------------------------- */

  const firstSave = useRef(true);
  useEffect(() => {
    // The mount pass isn't a change — flashing "Saving…" before the user has
    // touched anything reads as though the app did something on its own.
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }

    setSaveStatus('saving');
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(template));
    } catch (e) {
      console.error('Failed to save template to local storage', e);
    }
    const timer = setTimeout(() => setSaveStatus('saved'), SAVE_FLASH_MS);
    return () => clearTimeout(timer);
  }, [template]);

  /* --- Notices ----------------------------------------------------------- */

  useEffect(() => {
    if (restored.wrappedInSections === 0) return;
    const n = restored.wrappedInSections;
    setNotice({
      tone: 'success',
      message: `Blocks now live inside sections. ${n} loose block${
        n === 1 ? '' : 's'
      } in your saved newsletter ${
        n === 1 ? 'was' : 'were'
      } wrapped in a section. The exported HTML is unchanged — the section has no borders or padding until you give it some.`,
    });
  }, [restored.wrappedInSections]);

  // Confirmations fade on their own; problems stay until dismissed.
  useEffect(() => {
    if (notice?.tone !== 'success') return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  /* --- Derived ----------------------------------------------------------- */

  const emailHtml = useMemo(() => generateEmailHtml(template), [template]);

  const selectedElement = useMemo(
    () =>
      selectedElementId
        ? findElementById(template.elements, selectedElementId)
        : null,
    [template, selectedElementId]
  );

  /**
   * Which container a newly added block lands in: the selected container
   * itself, or the one holding the selected block.
   */
  const addTarget = useMemo(() => {
    if (!selectedElement || !selectedElementId) return null;
    if (isContainerElement(selectedElement)) return selectedElement;
    return findContainerFor(template.elements, selectedElementId);
  }, [template, selectedElement, selectedElementId]);

  /* --- Selection --------------------------------------------------------- */

  /**
   * The Inspector's tab set is per block type, so the tab that was open on the
   * last block may not exist on this one. Landing on a tab a type doesn't have
   * would render an empty panel — resolved here rather than in the Inspector,
   * which would have to guess whether the user chose the tab or inherited it.
   */
  const defaultTabFor = (el: EmailElement | null): InspectorTab => {
    if (!el) return 'styles';
    if (el.type === 'custom-html') return 'code';
    return el.type === 'image' || el.type === 'button' || el.type === 'spacer'
      ? 'content'
      : 'styles';
  };

  /*
    `select` is called immediately after the insert that created a block, when
    the `template` in scope is still the previous render's — so looking the new
    block up there would miss it and default its tab wrongly. A ref always holds
    the freshest committed template, and keeps `select` stable across edits.
  */
  const templateRef = useRef(template);
  templateRef.current = template;

  const select = useCallback((id: string | null) => {
    // Selecting always brings the inspector up, including re-selecting the
    // block you're already on — that's the way back from the palette.
    setPanelMode(id ? 'inspector' : 'rail');
    setSelectedElementId((current) => {
      if (current === id) return current;
      setInspectorTabRaw(
        defaultTabFor(id ? findElementById(templateRef.current.elements, id) : null)
      );
      return id;
    });
  }, []);

  /**
   * Switching rail tabs shows that panel but **keeps the selection**, so the
   * section you picked is still the one a clicked palette block lands in.
   */
  const setRailTab = useCallback((tab: RailTab) => {
    setRailTabRaw(tab);
    setPanelMode('rail');
  }, []);

  const showRailPanel = useCallback(() => setPanelMode('rail'), []);

  const setInspectorTab = useCallback((tab: InspectorTab) => {
    setInspectorTabRaw(tab);
  }, []);

  /* --- Mutations --------------------------------------------------------- */

  const commitElements = useCallback(
    (
      fn: (elements: EmailElement[]) => EmailElement[],
      opts?: CommitOptions
    ) => {
      commit(
        (prev) => ({ ...prev, elements: fn(prev.elements) }),
        opts
      );
    },
    [commit]
  );

  const updateElement = useCallback(
    (updated: EmailElement, opts?: CommitOptions) => {
      commitElements(
        (elements) =>
          mapTree(elements, (el) => (el.id === updated.id ? updated : el)),
        opts
      );
    },
    [commitElements]
  );

  const deleteElement = useCallback(
    (id: string) => {
      commitElements((elements) => {
        const parent = findContainerFor(elements, id);
        const next = removeFromTree(elements, id);
        return parent?.type === 'row' ? evenRowWidths(next, parent.id) : next;
      });
      setSelectedElementId((current) => (current === id ? null : current));
    },
    [commitElements]
  );

  const duplicateElement = useCallback(
    (id: string) => {
      commitElements((elements) => {
        const source = findElementById(elements, id);
        if (!source) return elements;
        const parent = findContainerFor(elements, id);
        const copy = reidDeep(JSON.parse(JSON.stringify(source)));
        const next = insertRelativeTo(elements, id, 'after', copy);
        return parent?.type === 'row' ? evenRowWidths(next, parent.id) : next;
      });
    },
    [commitElements]
  );

  const moveUp = useCallback(
    (id: string) => commitElements((els) => moveWithinList(els, id, -1)),
    [commitElements]
  );

  const moveDown = useCallback(
    (id: string) => commitElements((els) => moveWithinList(els, id, 1)),
    [commitElements]
  );

  const addChildTo = useCallback(
    (parentId: string, recipe: BlockRecipe) => {
      const child = createFromRecipe(recipe);
      commitElements((elements) =>
        insertRelativeTo(elements, parentId, 'inside', child)
      );
      select(child.id);
    },
    [commitElements, select]
  );

  /**
   * Which container a block of `type` would actually land in, given what's
   * selected — or null when there's nowhere legal.
   *
   * Normally that's just `addTarget`. The exception is a selected row: a row
   * holds only columns, so clicking "Text" while one is selected means the
   * first column of it, which is the only reading that isn't a refusal.
   */
  const resolveAddParent = useCallback(
    (type: ElementType): EmailElement | null => {
      if (!addTarget) return null;
      if (canNest(type, addTarget.type)) return addTarget;

      if (addTarget.type === 'row') {
        const column = (addTarget.childElements || []).find(
          (child) => child.type === 'column'
        );
        if (column && canNest(type, column.type)) return column;
      }
      return null;
    },
    [addTarget]
  );

  const dropNewElement = useCallback(
    (recipe: BlockRecipe, targetId: string | null, position: DropPosition) => {
      const created = createFromRecipe(recipe);

      /*
        A block that can't sit at the top level brings its own section when it
        lands there — the same bare wrapper `migrateToSections` puts around
        loose blocks. Only the empty-canvas drop zone passes a null target, and
        it is only rendered when the email has no blocks at all, so this is the
        first block of a new newsletter and there is no section to aim at yet.

        The selection is the block, not the wrapper: the wrapper is structure
        the author didn't ask for, and selecting it would open the Inspector on
        a section when they just placed a paragraph.
      */
      const placed =
        targetId === null && !canSitAtTopLevel(created.type)
          ? createBareSection(freshId('sec'), [created])
          : created;

      commitElements((elements) =>
        insertRelativeTo(elements, targetId, position, placed)
      );
      select(created.id);
      setPaletteDrag(null);
    },
    [commitElements, select]
  );

  /**
   * Add a block by clicking it in the palette.
   *
   * Non-container blocks have to land in a section, so a click needs one to aim
   * at. With nothing selected there's no sensible destination — say so, rather
   * than dropping the block loose at the end of the email.
   *
   * Unless the newsletter is *empty*, where there is no section to select and
   * the notice would be a dead end: the first block brings its own, which is
   * what lets New hand back a blank document.
   */
  const addElement = useCallback(
    (recipe: BlockRecipe) => {
      const type = recipeType(recipe);
      const parent = resolveAddParent(type);
      if (parent) {
        addChildTo(parent.id, recipe);
        return;
      }

      if (!canSitAtTopLevel(type)) {
        if (template.elements.length === 0) {
          dropNewElement(recipe, null, 'after');
          return;
        }
        setNotice({
          tone: 'warning',
          message:
            'Blocks live inside sections. Drag this onto a section on the canvas, or select a section first and then click it.',
        });
        return;
      }

      const created = createFromRecipe(recipe);
      commitElements((elements) => [...elements, created]);
      select(created.id);
    },
    [
      resolveAddParent,
      addChildTo,
      commitElements,
      select,
      dropNewElement,
      template.elements.length,
    ]
  );


  /**
   * Pull `dragId` out of wherever it lives and drop it before/after `targetId`,
   * or — with `'inside'` — append it as that container's last child. Source and
   * target can be in different lists, so this also moves blocks in and out of
   * sections.
   */
  const reorderElement = useCallback(
    (dragId: string, targetId: string, position: DropPosition) => {
      if (dragId === targetId) return;

      commitElements((elements) => {
        const dragged = findElementById(elements, dragId);
        const target = findElementById(elements, targetId);
        if (!dragged || !target) return elements;
        // A container dropped into its own subtree would detach from the tree.
        if (findElementById([dragged], targetId)) return elements;

        const resolved =
          position === 'inside' && !isContainerElement(target)
            ? 'after'
            : position;

        /*
          Where the block would end up: inside the target, or in whatever holds
          the target — landing *beside* a block means landing where that block
          lives. Only containers may sit at the top level, and only columns may
          go in a row. The canvas doesn't offer an illegal drop; this is the
          backstop, and the Sections outline's simpler drag leans on it.
        */
        const parent =
          resolved === 'inside' ? target : findContainerFor(elements, targetId);
        const legal = parent
          ? canNest(dragged.type, parent.type)
          : canSitAtTopLevel(dragged.type);
        if (!legal) return elements;

        const from = findContainerFor(elements, dragId);
        const next = insertRelativeTo(
          removeFromTree(elements, dragId),
          targetId,
          resolved,
          dragged
        );

        /*
          A column that changed rows leaves both splits stale. Reordering
          *within* one row doesn't — the same columns are still there — and
          re-evening then would throw away a split the author chose.
        */
        if (dragged.type !== 'column' || from?.id === parent?.id) return next;
        return [from, parent]
          .filter((row) => row?.type === 'row')
          .reduce((tree, row) => evenRowWidths(tree, row!.id), next);
      });
    },
    [commitElements]
  );

  const updateSettings = useCallback(
    (patch: Partial<EmailSettings>, opts?: CommitOptions) => {
      commit(
        (prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }),
        opts
      );
    },
    [commit]
  );

  const renameTemplate = useCallback(
    (name: string) => {
      commit((prev) => ({ ...prev, name }), { coalesceKey: 'template-name' });
    },
    [commit]
  );

  /**
   * Appends an empty section to the end of the email — the "+ Add blank
   * section" row in the Sections outline.
   *
   * Bare, not `createNewElement('section')`: a section the author hasn't styled
   * yet emits nothing of its own, so adding one leaves the exported email
   * byte-identical until they give it a border, padding or a fill.
   */
  const addBlankSection = useCallback(() => {
    const section = createBareSection(freshId('sec'), []);
    commitElements((elements) => [...elements, section]);
    select(section.id);
  }, [commitElements, select]);

  /* --- Project lifecycle -------------------------------------------------- */

  const newNewsletter = useCallback(() => {
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
    reset({
      ...blank,
      id: `newsletter-${Date.now()}`,
      name: 'Untitled Newsletter',
      // Fresh ids so the new project never collides with the one it replaced.
      elements: blank.elements.map(reidDeep),
    });
    setSelectedElementId(null);
    setRailTab('blocks');
    setOpenFileName(null);
    setNotice(null);
  }, [reset]);

  /**
   * Replaces the whole newsletter with a preset — blocks *and* settings.
   *
   * Destructive enough to confirm, and ids are regenerated so the new document
   * never shares one with the project it replaced (which would make selection
   * follow a stale id into the wrong block).
   */
  const applyPreset = useCallback(
    (presetId: string) => {
      const preset = PRESET_TEMPLATES.find((p) => p.id === presetId);
      if (!preset) return;
      if (
        !window.confirm(
          `Start from "${preset.name}"? This replaces the newsletter you're working on. Anything you haven't saved to a file will be lost.`
        )
      ) {
        return;
      }

      const copy: NewsletterTemplate = JSON.parse(JSON.stringify(preset));
      reset({
        ...copy,
        id: `newsletter-${Date.now()}`,
        elements: copy.elements.map(reidDeep),
      });
      setSelectedElementId(null);
      setOpenFileName(null);
    },
    [reset]
  );

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

  const saveTemplateFile = useCallback(() => {
    const filename = openFileName ?? suggestTemplateFileName(template);
    downloadBlob(
      new Blob([serializeTemplateFile(template)], {
        type: 'application/json;charset=utf-8',
      }),
      filename
    );
    setOpenFileName(filename);
    setNotice({
      tone: 'success',
      message: `Saved ${filename} to your downloads folder. Open it again with Import.`,
    });
  }, [openFileName, template]);

  const openTemplateFile = useCallback(
    async (file: File) => {
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

      reset(result.template);
      setOpenFileName(file.name);
      setSelectedElementId(null);

      // Wrapping loose blocks isn't a failure — report it separately from
      // anything that genuinely couldn't be read.
      const n = result.wrappedInSections;
      const migrationNote =
        n > 0
          ? ` ${n} loose block${n === 1 ? '' : 's'} ${
              n === 1 ? 'was' : 'were'
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
          : { tone: 'success', message: `Opened ${file.name}.${migrationNote}` }
      );
    },
    [reset]
  );

  /**
   * Import raw HTML as a `custom-html` block. That isn't a container, so it
   * can't sit at the top level — it lands in the selected section, or in a bare
   * section of its own.
   */
  const importRawHtml = useCallback(
    (rawHtml: string) => {
      const created = createNewElement('custom-html');
      if (created.type === 'custom-html') created.html = rawHtml;

      const parent = resolveAddParent('custom-html');
      if (parent) {
        const parentId = parent.id;
        commitElements((elements) =>
          insertRelativeTo(elements, parentId, 'inside', created)
        );
      } else {
        const wrapper = createBareSection(freshId('sec'), [created]);
        commitElements((elements) => [...elements, wrapper]);
      }
      select(created.id);
    },
    [resolveAddParent, commitElements, select]
  );

  /*
    Both take the markup rather than reading `emailHtml` themselves, so the
    Export modal can hand them whichever build it is showing — the ordinary one
    or the paste-safe one. Defaulted, because every other caller wants the
    ordinary export and shouldn't have to say so.
  */
  const downloadHtml = useCallback(
    (html: string = emailHtml) => {
      const slug =
        template.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'newsletter';
      downloadBlob(
        new Blob([html], { type: 'text/html;charset=utf-8' }),
        `${slug}.html`
      );
    },
    [emailHtml, template.name]
  );

  const openInNewTab = useCallback((html: string = emailHtml) => {
    const url = URL.createObjectURL(
      new Blob([html], { type: 'text/html;charset=utf-8' })
    );
    const win = window.open(url, '_blank');
    if (!win) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    }
  }, [emailHtml]);

  const value = useMemo<DesignerValue>(
    () => ({
      template,
      settings: template.settings,
      emailHtml,
      selectedElementId,
      selectedElement,
      addTarget,
      select,
      addElement,
      dropNewElement,
      updateElement,
      deleteElement,
      duplicateElement,
      moveUp,
      moveDown,
      reorderElement,
      updateSettings,
      renameTemplate,
      addBlankSection,
      newNewsletter,
      applyPreset,
      saveTemplateFile,
      openTemplateFile,
      importRawHtml,
      downloadHtml,
      openInNewTab,
      openFileName,
      saveStatus,
      history: { undo, redo, canUndo, canRedo },
      ui: {
        railTab,
        setRailTab,
        panelMode,
        showRailPanel,
        inspectorTab,
        setInspectorTab,
        viewMode,
        setViewMode,
        previewOpen,
        setPreviewOpen,
        exportOpen,
        setExportOpen,
        importOpen,
        setImportOpen,
        paletteDrag,
        setPaletteDrag,
      },
      notice,
      setNotice,
    }),
    [
      template,
      emailHtml,
      selectedElementId,
      selectedElement,
      addTarget,
      select,
      addElement,
      dropNewElement,
      updateElement,
      deleteElement,
      duplicateElement,
      moveUp,
      moveDown,
      reorderElement,
      updateSettings,
      renameTemplate,
      addBlankSection,
      newNewsletter,
      applyPreset,
      saveTemplateFile,
      openTemplateFile,
      importRawHtml,
      downloadHtml,
      openInNewTab,
      openFileName,
      saveStatus,
      undo,
      redo,
      canUndo,
      canRedo,
      railTab,
      setRailTab,
      panelMode,
      showRailPanel,
      inspectorTab,
      setInspectorTab,
      viewMode,
      previewOpen,
      exportOpen,
      importOpen,
      paletteDrag,
      notice,
    ]
  );

  return (
    <DesignerContext.Provider value={value}>{children}</DesignerContext.Provider>
  );
};

export function useDesigner(): DesignerValue {
  const value = useContext(DesignerContext);
  if (!value) {
    throw new Error('useDesigner must be used inside DesignerProvider');
  }
  return value;
}

/** Re-exported so callers don't have to import from two places. */
export type { CommitOptions, TemplateUpdate };
