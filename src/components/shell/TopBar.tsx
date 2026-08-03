import React, { useRef, useState } from 'react';
import { Check, FilePlus2, Loader2, Mail, MailPlus } from 'lucide-react';
import { useDesigner } from '../../state/DesignerContext';
import { InlineRename } from '../controls';
import { TEMPLATE_FILE_EXTENSION } from '../../utils/templateFile';
import { generateEmailHtml } from '../../utils/htmlGenerator';
import { insertIntoGmail, isExtensionHost } from '../../utils/extensionHost';

/*
  Whether this build is a page inside the Chrome extension. Fixed for the life
  of the document — the protocol can't change under us — so it's read once
  rather than on every render, and the hosted app never renders the button.
*/
const IN_EXTENSION = isExtensionHost();

/**
 * The application bar: brand, newsletter name, save state, and the two actions
 * that move a project in and out of the app.
 *
 * "Save" writes the editable `.newsletter.json` project, not the email — the
 * email leaves through Export. Keeping those on separate buttons is deliberate:
 * conflating "save my work" with "give me the HTML" is how people lose a
 * newsletter they can no longer edit.
 */
export const TopBar: React.FC = () => {
  const {
    template,
    renameTemplate,
    newNewsletter,
    saveTemplateFile,
    openTemplateFile,
    saveStatus,
    ui,
  } = useDesigner();

  const [renaming, setRenaming] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  /* Only ever non-idle inside the extension — see `IN_EXTENSION`. */
  const [inserting, setInserting] = useState(false);
  const [insertNote, setInsertNote] = useState<string | null>(null);

  async function handleInsert() {
    setInserting(true);
    setInsertNote(null);
    const outcome = await insertIntoGmail(generateEmailHtml(template));
    setInserting(false);
    setInsertNote(
      outcome.status === 'ok'
        ? outcome.method === 'paste'
          ? 'Inserted into your draft.'
          : // Worth naming rather than reporting a plain success: this is the
            // path that ships `data:` images as-is, and Gmail drops those.
            'Inserted, but Gmail refused the paste — uploaded images may not survive.'
        : outcome.error
    );
    window.setTimeout(() => setInsertNote(null), 6000);
  }

  return (
    <header className="relative flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white pr-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-accent-500 text-white">
        <Mail className="h-6 w-6" />
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <InlineRename
          value={template.name}
          onChange={renameTemplate}
          editing={renaming}
          onEditingChange={setRenaming}
          className="max-w-[40vw] truncate rounded px-1 text-xl font-bold text-slate-900 hover:bg-slate-100"
          inputClassName="max-w-[40vw] rounded border border-accent-500 px-1 text-xl font-bold text-slate-900 outline-none"
        />
        {!renaming && (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700"
          >
            Rename
          </button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-sm text-slate-500">
          {saveStatus === 'saving' ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5 text-accent-600" />
              Changes saved
            </>
          )}
        </span>

        {/* Quiet, and first: it throws the current newsletter away, so it must
            not sit next to Save looking like a peer of it. `newNewsletter`
            confirms before it resets — the same handler the Theme panel calls,
            not a second copy of the reset. */}
        <button
          type="button"
          onClick={newNewsletter}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <FilePlus2 className="h-4 w-4" />
          New
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="rounded-md border-2 border-accent-500 px-4 py-1.5 text-sm font-bold text-slate-900 hover:bg-accent-50"
        >
          Import
        </button>
        <button
          type="button"
          onClick={saveTemplateFile}
          className="rounded-md bg-accent-500 px-5 py-2 text-sm font-bold text-white hover:bg-accent-600"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => ui.setExportOpen(true)}
          className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          Export HTML
        </button>

        {/* The reason the extension exists, so it's the terminal action. Absent
            from the hosted app entirely — there's no draft to insert into. */}
        {IN_EXTENSION && (
          <button
            type="button"
            onClick={handleInsert}
            disabled={inserting}
            className="flex items-center gap-1.5 rounded-md bg-accent-600 px-4 py-2 text-sm font-bold text-white hover:bg-accent-700 disabled:opacity-60"
          >
            {inserting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MailPlus className="h-4 w-4" />
            )}
            Insert into Gmail
          </button>
        )}
      </div>

      {insertNote && (
        <div
          role="status"
          className="absolute right-4 top-14 z-50 max-w-sm rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-lg"
        >
          {insertNote}
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept={`${TEMPLATE_FILE_EXTENSION},.json,application/json`}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Clear it so re-picking the same file still fires a change event.
          e.target.value = '';
          if (file) void openTemplateFile(file);
        }}
      />
    </header>
  );
};
