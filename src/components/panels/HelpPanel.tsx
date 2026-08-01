import React from 'react';
import { LifeBuoy } from 'lucide-react';
import { PanelBody, PanelHeader } from './PanelHeader';

/**
 * Placeholder.
 *
 * The intent is everything that explains the app to someone using it — how
 * blocks and sections fit together, what survives Outlook, keyboard shortcuts,
 * where a project file goes. It sits at the *bottom* of the rail rather than in
 * the run of panels above because it isn't part of composing a newsletter: the
 * four above are steps in the work, this one is what you reach for when the
 * work stalls.
 */
export const HelpPanel: React.FC = () => (
  <>
    <PanelHeader
      title="Help"
      subtitle="Guides, shortcuts, and answers about building the email."
    />
    <PanelBody>
      <div className="mx-5 rounded-lg border border-dashed border-slate-300 px-5 py-10 text-center">
        <LifeBuoy className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm font-semibold text-slate-700">Not built yet</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Help will live here: how sections and blocks fit together, what each
          block exports, keyboard shortcuts, and what email clients do to your
          markup.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Stuck on something? Reach out.
        </p>
      </div>
    </PanelBody>
  </>
);
