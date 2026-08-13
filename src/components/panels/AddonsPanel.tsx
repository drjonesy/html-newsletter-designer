import React, { useEffect, useId, useState } from 'react';
import {
  Chrome,
  ChevronDown,
  CircleCheck,
  Puzzle,
  TriangleAlert,
} from 'lucide-react';
import { PanelBody, PanelHeader } from './PanelHeader';
import { FieldGroup } from '../controls';
import {
  describeExtension,
  type ExtensionPresence,
} from '../../utils/extensionHost';

const code = 'rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]';

/**
 * What the extension reports about itself, or `null` until it has answered.
 *
 * Async because the install type has to come from the service worker — see
 * `describeExtension`. The null state renders no chips at all rather than
 * "Not installed": the panel opens long after that resolves, so the flash is
 * theoretical, but showing a wrong answer while waiting for the right one is
 * the specific failure this whole change exists to remove.
 */
function useExtension(): ExtensionPresence | null {
  const [presence, setPresence] = useState<ExtensionPresence | null>(null);

  useEffect(() => {
    let live = true;
    void describeExtension().then((next) => {
      if (live) setPresence(next);
    });
    return () => {
      live = false;
    };
  }, []);

  return presence;
}

/**
 * One add-on, collapsed to a summary until asked to open.
 *
 * What stays visible while collapsed is the design decision here. The title
 * and a one-line description are the obvious part; the status chips are the
 * rest, and they carry the two facts that decide whether someone wants to read
 * further at all — whether it's installed, and whether it can be. Burying
 * "developer mode only" behind the arrow would mean discovering it after
 * following four install steps.
 */
const AddonCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  summary: React.ReactNode;
  chips?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, title, summary, chips, children }) => {
  const [open, setOpen] = useState(false);
  const detailsId = useId();

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={detailsId}
        className="flex w-full items-start gap-3 rounded-lg p-4 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-accent-500"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-50 text-accent-600">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
            {chips}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            {summary}
          </p>
        </div>

        <ChevronDown
          className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div id={detailsId} className="border-t border-slate-200 p-4">
          {children}
        </div>
      )}
    </div>
  );
};

/** The pill next to the title. Colour carries the same message as the words. */
const Chip: React.FC<{
  tone: 'good' | 'warn' | 'neutral';
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ tone, icon, children }) => (
  <span
    className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
      tone === 'good'
        ? 'bg-emerald-50 text-emerald-700'
        : tone === 'warn'
          ? 'bg-amber-50 text-amber-700'
          : 'bg-slate-100 text-slate-600'
    }`}
  >
    {icon}
    {children}
  </span>
);

/**
 * Optional extras that bolt onto the designer without changing the core.
 *
 * One is real — the Chrome extension, which hosts this same build inside Gmail.
 * Anything that lands here has to keep the app's bargain: it runs entirely in
 * the browser, and an add-on isn't a reason to grow a backend. The extension
 * qualifies because `chrome.runtime` messaging is local to the browser; nothing
 * about it touches the network.
 *
 * The card has three states, and the middle one is the reason this isn't a
 * boolean: **installed but not hosting this page**. Someone on the dev server
 * with the extension in their toolbar is in it, and telling them to go and
 * install what they already have is worse than saying nothing.
 */
export const AddonsPanel: React.FC = () => {
  const ext = useExtension();

  return (
    <>
      <PanelHeader
        title="Add-ons"
        subtitle="Extras and integrations that plug into the designer."
      />
      <PanelBody>
        <FieldGroup>
          <AddonCard
            icon={<Chrome className="h-5 w-5" />}
            title="Gmail (Chrome extension)"
            chips={
              /*
                Nothing at all until detection answers. A wrong chip that
                corrects itself a frame later is the exact failure this
                replaced — better to show one fewer thing for one frame.
              */
              ext && (
                <>
                  {ext.hosted ? (
                    <Chip tone="good" icon={<CircleCheck className="h-3 w-3" />}>
                      Active
                    </Chip>
                  ) : ext.installed ? (
                    <Chip tone="good" icon={<CircleCheck className="h-3 w-3" />}>
                      Installed
                    </Chip>
                  ) : (
                    <Chip tone="neutral">Not installed</Chip>
                  )}

                  {/*
                    Two different facts share this slot. For an install we can
                    see, it reports how *that copy* got here. With nothing
                    installed it states what installing will take — still true,
                    since there's no Web Store listing to offer instead.
                    Unknown shows nothing: absent means unknown, and inferring
                    "developer mode" from silence would be a guess.
                  */}
                  {ext.installType === 'normal' ? (
                    <Chip tone="neutral">Chrome Web Store</Chip>
                  ) : ext.installType === 'development' || !ext.installed ? (
                    <Chip tone="warn" icon={<TriangleAlert className="h-3 w-3" />}>
                      Developer mode
                    </Chip>
                  ) : null}

                  {ext.version && <Chip tone="neutral">v{ext.version}</Chip>}
                </>
              )
            }
            summary={
              <>
                Adds a <strong>Design newsletter</strong> button to Gmail's
                compose window, and drops the finished email into your draft.
              </>
            }
          >
            {/* The full caveat, only while it actually applies. */}
            {ext?.installType !== 'normal' && (
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
                <div className="text-xs leading-relaxed text-amber-900">
                  <p className="font-semibold">Developer mode only</p>
                  <p className="mt-1">
                    This isn't on the Chrome Web Store, so it has to be loaded
                    unpacked with developer mode switched on. Chrome shows a
                    "disable developer mode extensions" warning on startup, and
                    the extension is removed if you turn developer mode off.
                  </p>
                </div>
              </div>
            )}

            {ext?.hosted ? (
              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                You're using it now — this designer is running inside the
                extension. Open Gmail, hit Compose, then{' '}
                <strong>Design newsletter</strong> to pair this tab with a draft.
              </p>
            ) : ext?.installed ? (
              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                Installed, but this tab is the web version — so{' '}
                <strong>Insert into Gmail</strong> isn't available here. Open
                Gmail, hit Compose, then <strong>Design newsletter</strong> to
                get a designer tab that's paired with a draft.
              </p>
            ) : (
              <>
                <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-slate-600 marker:text-slate-400">
                  <li>
                    Run <code className={code}>pnpm ext:build</code> in the
                    project
                  </li>
                  <li>
                    Open <code className={code}>chrome://extensions</code>
                  </li>
                  <li>Turn on Developer mode, top right</li>
                  <li>
                    <strong>Load unpacked</strong>, and pick the{' '}
                    <code className={code}>extension/</code> folder
                  </li>
                </ol>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  Already installed and still seeing this? The extension only
                  announces itself on origins it has permission for — add this
                  one to <code className={code}>detect.js</code>'s matches in{' '}
                  <code className={code}>manifest.json</code>.
                </p>
              </>
            )}

            {/*
              Stated in the app rather than only in the extension's README: it
              changes what someone designs, and the panel offering the add-on
              is where they'd find out in time for that to matter.
            */}
            <p className="mt-3 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-500">
              Sending from Gmail can't carry{' '}
              <code className={code}>&lt;head&gt;</code> CSS, so{' '}
              <strong>stack on mobile</strong> and{' '}
              <strong>per-device visibility</strong> won't apply — columns stay
              side by side on phones. That's true of copy-and-paste too. Use{' '}
              <strong>Export HTML</strong> and a proper sending tool when those
              matter.
            </p>
          </AddonCard>
        </FieldGroup>

        <FieldGroup>
          <div className="rounded-lg border border-dashed border-slate-300 px-5 py-8 text-center">
            <Puzzle className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">More to come</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Pre-send checks, reusable block libraries, hand-offs to the tool
              you actually send from.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Got one you'd like to see? Reach out.
            </p>
          </div>
        </FieldGroup>
      </PanelBody>
    </>
  );
};
