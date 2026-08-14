import React from 'react';
import { PlayCircle, ShieldCheck, Smartphone } from 'lucide-react';
import { PanelBody, PanelHeader } from './PanelHeader';

/**
 * What the app is, plus a link out to the how-to video. This panel deliberately
 * stops after the introduction rather than half-documenting the workflow in
 * text that would then have to agree with the recordings.
 *
 * The one exception is what a Gmail paste does to the mobile layout. That isn't
 * a how-to — it's a constraint that decides what someone should design in the
 * first place, and finding out afterwards means rebuilding the newsletter. It
 * also answers the question this app gets asked most: why the Mobile view
 * doesn't stack columns the way every other email tool's does.
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

      <div className="mx-5 mt-4 flex items-start gap-3 rounded-lg border border-slate-200 px-4 py-4">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-accent-500" />
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Pasting into Gmail flattens the phone layout
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            An email carries its "switch to a phone layout" instructions in a
            block of CSS at the very top of the file. Gmail's compose window
            deletes that block when you paste — it keeps only the styling
            written onto each block itself.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            So a pasted newsletter has <strong>one layout everywhere</strong>.
            Two columns stay two columns on a phone, just narrower. That's why
            the Mobile view here doesn't stack them — it shows what a phone
            really gets, rather than a reflow your reader won't see.
          </p>

          <p className="mt-3 text-xs font-semibold text-slate-700">
            Designing something you'll paste into Gmail?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Keep it to a single column and let buttons run full width. One
            column reads well at any size, so there's nothing to reflow.
          </p>

          <p className="mt-3 text-xs font-semibold text-slate-700">
            Need columns that stack on a phone?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Use <strong>Export HTML → For sending</strong> and send that file
            through something that mails HTML for you — Mailchimp, Brevo, or
            your own script. Nothing is stripped there, so columns stack to full
            width on phones and per-device hiding works too.
          </p>
        </div>
      </div>

      {/* Absolute, and `noreferrer` like the privacy link: this one leaves the
          app entirely, and an extension page has no origin YouTube would
          resolve a relative href against. */}
      <a
        href="https://www.youtube.com/watch?v=SxKcKL66lkQ"
        target="_blank"
        rel="noreferrer"
        className="mx-5 mt-4 flex items-start gap-3 rounded-lg border border-slate-200 px-4 py-4 hover:border-accent-300 hover:bg-accent-50"
      >
        <PlayCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent-500" />
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Watch the how-to video
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            A walkthrough on YouTube: building the email, and getting it into
            Gmail. More recordings will be added here as they're made.
          </p>
        </div>
      </a>

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
