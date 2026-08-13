import React from 'react';
import { ClipboardPaste } from 'lucide-react';
import { BlockRecipe } from '../../utils/elementHelpers';
import { useDesigner } from '../../state/DesignerContext';
import { HelpLink } from '../controls';
import { BLOCK_ICONS, BlockIcon, COLUMN_ICONS } from './blockIcons';
import { PanelBody, PanelHeader } from './PanelHeader';

interface PaletteItem {
  recipe: BlockRecipe;
  label: string;
  icon: BlockIcon;
}

/**
 * The structural blocks — the ones that hold other blocks.
 *
 * All three are the same `row` type in different shapes, which is why the
 * palette's payload is a `BlockRecipe` rather than an `ElementType`. "1 Column"
 * is the general-purpose box: it holds blocks full-width, takes a border, fill
 * and padding on its column, and becomes a two- or three-column layout by
 * raising the count on its Styles tab.
 *
 * There is no separate Section item. The `section` type is still what the
 * Sections outline manages at the top level, but as a palette block it was a
 * second box that did the same job under a different name.
 */
const SECTION_BLOCKS: PaletteItem[] = [
  { recipe: 'columns-1', label: '1 Column', icon: COLUMN_ICONS[1] },
  { recipe: 'columns-2', label: '2 Columns', icon: COLUMN_ICONS[2] },
  { recipe: 'columns-3', label: '3 Columns', icon: COLUMN_ICONS[3] },
];

const CONTENT_BLOCKS: PaletteItem[] = [
  { recipe: 'image', label: 'Image', icon: BLOCK_ICONS.image },
  { recipe: 'heading', label: 'Heading', icon: BLOCK_ICONS.heading },
  { recipe: 'paragraph', label: 'Text', icon: BLOCK_ICONS.paragraph },
  { recipe: 'button', label: 'Button', icon: BLOCK_ICONS.button },
  { recipe: 'divider', label: 'Divider', icon: BLOCK_ICONS.divider },
  { recipe: 'spacer', label: 'Spacer', icon: BLOCK_ICONS.spacer },
  { recipe: 'list', label: 'List', icon: BLOCK_ICONS.list },
  { recipe: 'quote', label: 'Quote', icon: BLOCK_ICONS.quote },
  { recipe: 'custom-html', label: 'Code', icon: BLOCK_ICONS['custom-html'] },
];

/**
 * The palette.
 *
 * Cards are both click targets and drag sources. Clicking adds into whatever
 * section is selected; dragging lets you aim at a specific spot. Both routes
 * enforce the same rules — only containers may sit at the top level, and a row
 * holds only columns — so a click with nothing selected is refused with a
 * notice rather than dropping the block loose at the end of the email.
 */
export const BlocksPanel: React.FC = () => {
  const { addElement, addTarget, ui, setNotice } = useDesigner();

  const grid = (items: PaletteItem[]) => (
    <div className="grid grid-cols-3 gap-3 px-5 pb-5">
      {items.map(({ recipe, label, icon: Icon }) => (
        <button
          key={recipe}
          type="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', recipe);
            ui.setPaletteDrag(recipe);
          }}
          onDragEnd={() => ui.setPaletteDrag(null)}
          onClick={() => addElement(recipe)}
          className="flex aspect-4/3 cursor-grab flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:border-accent-400 hover:text-accent-700 active:cursor-grabbing"
        >
          <Icon className="h-5 w-5" />
          <span className="text-sm">{label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <PanelHeader
        title="Section blocks"
        subtitle="Drag onto the canvas, or select a section and click to add."
      >
        <div className="mb-4">
          <HelpLink
            onClick={() =>
              setNotice({
                tone: 'success',
                message:
                  'Blocks live inside sections. Pick a section in the Sections panel (or click one on the canvas), then click a block to drop it in — or drag a block straight onto the section you want. A 1 Column block is a plain full-width box; 2 and 3 put blocks side by side, and each column takes its own blocks. You can change the count on any of them from its Styles tab.',
              })
            }
          >
            How to use this builder
          </HelpLink>
        </div>
      </PanelHeader>

      <PanelBody>
        {grid(SECTION_BLOCKS)}

        {/*
          Matches `PanelHeader`'s title rather than reusing it: that component
          is the panel's opening block, and a second one would re-state the
          help link and the subtitle.
        */}
        <h2 className="px-5 pb-4 text-2xl font-bold text-slate-900">
          Content blocks
        </h2>
        {grid(CONTENT_BLOCKS)}

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={() => ui.setImportOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:border-accent-400 hover:text-accent-700"
          >
            <ClipboardPaste className="h-4 w-4" />
            Paste HTML…
          </button>
        </div>

        <p className="px-5 pb-5 text-xs leading-relaxed text-slate-500">
          {addTarget
            ? `Clicking a block adds it to “${addTarget.label || 'Section'}”.`
            : 'Select a section first, or drag a block onto one — blocks live inside sections.'}
        </p>
      </PanelBody>
    </>
  );
};
