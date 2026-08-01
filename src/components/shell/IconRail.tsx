import React from 'react';
import { Grid3x3, Layers, LifeBuoy, PaintBucket, Puzzle } from 'lucide-react';
import { RailTab, useDesigner } from '../../state/DesignerContext';

type Tab = {
  id: RailTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TABS: Tab[] = [
  { id: 'blocks', label: 'Blocks', icon: Grid3x3 },
  { id: 'sections', label: 'Sections', icon: Layers },
  { id: 'theme', label: 'Theme', icon: PaintBucket },
  { id: 'addons', label: 'Add-ons', icon: Puzzle },
];

/**
 * Pinned to the foot of the rail rather than appended to `TABS`.
 *
 * The four above are steps in composing a newsletter and read as a sequence;
 * Help isn't one of them, and the gap between the group and the bottom edge is
 * what says so. It's the same button in every other respect, including the
 * active tab treatment.
 */
const FOOTER_TABS: Tab[] = [{ id: 'help', label: 'Help', icon: LifeBuoy }];

/**
 * The narrow rail down the left edge.
 *
 * The active item is drawn as a white tab continuous with the panel beside it —
 * its right border is removed so the two read as one surface, which is what
 * makes the rail feel like it's *switching* the panel rather than sitting next
 * to it.
 *
 * Choosing a rail tab is the way out of the block inspector — they share one
 * slot. It does *not* clear the selection: the selected section is where a
 * clicked palette block goes, so dropping it here would break click-to-add.
 */
export const IconRail: React.FC = () => {
  const { ui } = useDesigner();

  const renderTab = ({ id, label, icon: Icon }: Tab) => {
    // Nothing in the rail is current while the inspector has the panel —
    // highlighting a tab you aren't looking at is just wrong.
    const active = ui.panelMode === 'rail' && ui.railTab === id;
    return (
      <button
        key={id}
        type="button"
        aria-current={active ? 'page' : undefined}
        onClick={() => ui.setRailTab(id)}
        className={`relative mx-1 flex flex-col items-center gap-1.5 rounded-lg px-1 py-3 text-[11px] font-medium transition-colors ${
          active
            ? 'bg-white text-accent-600 shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <Icon className="h-6 w-6" />
        {label}
      </button>
    );
  };

  return (
    <nav
      className="flex w-18.5 shrink-0 flex-col gap-1 border-r border-slate-200 bg-slate-50 py-2"
      aria-label="Panels"
    >
      {TABS.map(renderTab)}
      {/* `mt-auto` on the group, not the button, so a second footer item lands
          under Help instead of pushing it back up into the run above. */}
      <div className="mt-auto flex flex-col gap-1">
        {FOOTER_TABS.map(renderTab)}
      </div>
    </nav>
  );
};
