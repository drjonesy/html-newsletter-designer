import React from 'react';
import { PlayCircle, ShieldCheck } from 'lucide-react';
import { PanelBody, PanelHeader } from './PanelHeader';

/**
 * What the app is. The how-to is coming as video, so this panel deliberately
 * stops after the introduction rather than half-documenting the workflow in
 * text that would then have to agree with the recordings.
 *
 * It sits at the *bottom* of the rail rather than in the run of panels above
 * because it isn't part of composing a newsletter: the four above are steps in
 * the work, this one is what you reach for when the work stalls.
 *
 * It opens by saying the tool is free and has no account, because that is the
 * first question someone has about a designer that never asked them to sign in
 * — and because it explains everything else: there is no server to sync to, so
 * the browser is where the work lives and a project file is how it travels.
 */
export const HelpPanel: React.FC = () => (
  <>
    <PanelHeader title="Help" subtitle="What this is, and where it's going." />
    <PanelBody>
      <div className="mx-5 rounded-lg border border-accent-200 bg-accent-50 px-4 py-4">
        <p className="text-sm font-semibold text-slate-900">
          A free tool. No account, no sign-in.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          It was built to do one thing: design an email visually, then copy the
          result into Gmail so what you send actually looks designed instead of
          like a plain-text note.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          Everything runs in this browser tab. There is no server, no account
          and no upload — nothing you type or paste in here leaves your machine.
        </p>
      </div>

      <div className="mx-5 mt-4 flex items-start gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-4">
        <PlayCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Walkthrough videos coming
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Building the email, and getting it into Gmail, will be covered here
            as short recordings.
          </p>
        </div>
      </div>

      {/* An `<a>`, not a `HelpLink` — that control is a button precisely
          because there was nowhere offline to point it. `public/privacy.html`
          is a real page, and the href is *relative* so the one link resolves
          in both builds: `/privacy.html` on the hosted site, and
          `app/privacy.html` inside the extension, where the app is nested. */}
      <a
        href="privacy.html"
        target="_blank"
        rel="noreferrer"
        className="mx-5 mt-4 flex items-start gap-3 rounded-lg border border-slate-200 px-4 py-4 hover:border-accent-300 hover:bg-accent-50"
      >
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-500" />
        <div>
          <p className="text-sm font-semibold text-slate-700">Privacy policy</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            What the Chrome extension does and doesn't touch. The short version:
            nothing is collected, and nothing is sent anywhere.
          </p>
        </div>
      </a>
    </PanelBody>
  </>
);
