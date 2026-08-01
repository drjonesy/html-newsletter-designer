import React from 'react';
import { Puzzle } from 'lucide-react';
import { PanelBody, PanelHeader } from './PanelHeader';

/**
 * Placeholder.
 *
 * The intent is optional extras that bolt onto the designer without changing
 * the core — pre-send checks, reusable block libraries, hand-offs to whatever
 * actually sends the email. Anything that lands here still has to run entirely
 * in the browser: the app has no backend and makes no network calls, and an
 * add-on isn't a reason to grow one.
 */
export const AddonsPanel: React.FC = () => (
  <>
    <PanelHeader
      title="Add-ons"
      subtitle="Extras and integrations that plug into the designer."
    />
    <PanelBody>
      <div className="mx-5 rounded-lg border border-dashed border-slate-300 px-5 py-10 text-center">
        <Puzzle className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm font-semibold text-slate-700">Not built yet</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Add-ons and integrations will live here: pre-send checks, reusable
          block libraries, hand-offs to the tool you actually send from.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Got one you'd like to see? Reach out.
        </p>
      </div>
    </PanelBody>
  </>
);
