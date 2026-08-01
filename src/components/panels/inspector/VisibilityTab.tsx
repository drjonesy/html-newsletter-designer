import React from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { EmailElement } from '../../../types';
import { isContainerElement } from '../../../utils/elementHelpers';
import { useDesigner } from '../../../state/DesignerContext';
import { FieldGroup, ToggleSwitch } from '../../controls';

/**
 * Show or hide this block per device.
 *
 * Absent means visible, so a block nobody has touched here emits exactly the
 * HTML it did before this tab existed — the rules only reach the `<head>` when
 * something in the email actually uses them.
 */
export const VisibilityTab: React.FC<{ element: EmailElement }> = ({
  element,
}) => {
  const { updateElement } = useDesigner();

  const desktop = element.visibility?.desktop !== false;
  const mobile = element.visibility?.mobile !== false;

  const set = (next: { desktop?: boolean; mobile?: boolean }) => {
    const merged = { desktop, mobile, ...next };
    updateElement({
      ...element,
      // Drop the field entirely when it says nothing, so a block toggled off
      // and back on doesn't carry a redundant `{desktop:true,mobile:true}`
      // around in every saved project file.
      visibility:
        merged.desktop && merged.mobile
          ? undefined
          : { desktop: merged.desktop, mobile: merged.mobile },
    });
  };

  return (
    <>
      <FieldGroup label="Show this block on">
        <div className="space-y-4">
          <ToggleSwitch
            checked={desktop}
            onChange={(value) => set({ desktop: value })}
            label={
              <span className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-slate-500" />
                Desktop
              </span>
            }
          />
          <ToggleSwitch
            checked={mobile}
            onChange={(value) => set({ mobile: value })}
            label={
              <span className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-slate-500" />
                Mobile
              </span>
            }
            hint="Screens narrower than 600px."
          />
        </div>

        {!desktop && !mobile && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            Hidden everywhere — this block is left out of the exported email
            entirely. It stays on the canvas so you can turn it back on.
          </p>
        )}

        {isContainerElement(element) && (!desktop || !mobile) && (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Hiding a section hides everything inside it.
          </p>
        )}
      </FieldGroup>

      <FieldGroup>
        <p className="text-xs leading-relaxed text-slate-500">
          <strong>Worth knowing:</strong> hiding relies on CSS in the email's{' '}
          <code className="rounded bg-slate-100 px-1">&lt;head&gt;</code>, which
          a few clients strip — notably the Gmail app signed in to a non-Gmail
          account. A hidden block will show there. If it absolutely must not be
          seen, delete it rather than hiding it.
        </p>
      </FieldGroup>
    </>
  );
};
