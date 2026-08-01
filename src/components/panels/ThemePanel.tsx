import React, { useState } from 'react';
import { FilePlus2, RotateCcw } from 'lucide-react';
import { TypographyKey, TypographyStyle } from '../../types';
import { useDesigner } from '../../state/DesignerContext';
import { PRESET_TEMPLATES } from '../../utils/defaultTemplate';
import { RICH_TEXT_FONTS } from '../../utils/richText';
import {
  DEFAULT_TYPOGRAPHY,
  TYPOGRAPHY_KEYS,
  TYPOGRAPHY_LABELS,
  typographyFor,
} from '../../utils/typography';
import {
  ColorField,
  FieldGroup,
  NumberStepper,
  SegmentedControl,
  SelectField,
} from '../controls';
import { PanelBody, PanelHeader } from './PanelHeader';
import { TextStyleFields } from './TextStyleFields';

/**
 * Global `EmailSettings` — the defaults every block inherits, and the frame the
 * email sits in.
 *
 * Called "Theme" rather than "Styles" so it doesn't collide with the per-block
 * Styles tab in the Inspector. Same slot in the rail, very different scope.
 */
/**
 * The type scale: pick a level, edit its style.
 *
 * One level at a time rather than seven expanded stacks — the panel is 380px
 * wide and the fields are identical for each, so a switcher reads better than
 * a wall of repeated controls. The preview line above them renders in the
 * actual style, which is the fastest way to see the scale hold together.
 */
const TypographySection: React.FC = () => {
  const { settings, updateSettings } = useDesigner();
  const [key, setKey] = useState<TypographyKey>('h1');

  const style = typographyFor(settings, key);
  const isDefault =
    JSON.stringify(style) === JSON.stringify(DEFAULT_TYPOGRAPHY[key]);

  const patch = (next: Partial<TypographyStyle>, coalesceKey?: string) =>
    updateSettings(
      {
        typography: {
          ...settings.typography,
          [key]: { ...settings.typography?.[key], ...next },
        },
      },
      coalesceKey ? { coalesceKey } : undefined
    );

  const reset = () => {
    const rest = { ...settings.typography };
    delete rest[key];
    updateSettings({ typography: rest });
  };

  return (
    <>
      <FieldGroup label="Typography">
        <SegmentedControl
          size="sm"
          value={key}
          segments={TYPOGRAPHY_KEYS.map((k) => ({
            value: k,
            label: k === 'paragraph' ? 'Body' : k.toUpperCase(),
            title: TYPOGRAPHY_LABELS[k],
          }))}
          onChange={setKey}
        />

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="mb-1.5 text-[11px] font-medium text-slate-400">
            {TYPOGRAPHY_LABELS[key]} · {style.fontSize}px
          </p>
          {/*
            Rendered in the real style — including the project's font stack —
            so the scale can be judged rather than read off numbers. The heading
            sample is one short word on purpose: it has to stay on one line at
            the top of the size range, or the preview clips mid-descender and
            reads as a rendering bug.
          */}
          <p
            className="overflow-hidden"
            style={{
              fontFamily: settings.fontFamily,
              fontSize: `${style.fontSize}px`,
              fontWeight: style.fontWeight,
              fontStyle: style.fontStyle,
              lineHeight: style.lineHeight,
              letterSpacing: style.letterSpacing,
              textTransform: style.transform,
              color: style.color,
            }}
          >
            {key === 'paragraph'
              ? 'The quick brown fox jumps over the lazy dog.'
              : 'Heading'}
          </p>
        </div>

        <div className="mt-4">
          <TextStyleFields
            value={style}
            coalesceScope={`theme-${key}`}
            onChange={(next) => patch(next)}
            onColorChange={(color) => patch({ color }, `theme-color-${key}`)}
          />
        </div>

        {!isDefault && (
          <button
            type="button"
            onClick={reset}
            className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-accent-600 hover:underline"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset {TYPOGRAPHY_LABELS[key]} to the default scale
          </button>
        )}
      </FieldGroup>

      <FieldGroup>
        <p className="text-xs leading-relaxed text-slate-500">
          These are the project's global styles. Every heading and paragraph
          follows them unless you've changed that block specifically — the
          Inspector marks those and offers a way back.
        </p>
      </FieldGroup>
    </>
  );
};

export const ThemePanel: React.FC = () => {
  const { settings, updateSettings, applyPreset, newNewsletter } = useDesigner();

  return (
    <>
      <PanelHeader
        title="Theme"
        subtitle="Defaults for the whole email — width, colours and the base font."
      />

      <PanelBody>
        <FieldGroup label="Start over">
          {/*
            Both of these throw the current newsletter away, which is why they
            confirm first and why they sit at the top of Theme rather than in
            the top bar next to Save — a misclick there would be expensive.
          */}
          <div className="space-y-2">
            <SelectField
              label="Start from a preset"
              value=""
              options={[
                { value: '', label: 'Choose a preset…' },
                ...PRESET_TEMPLATES.map((preset) => ({
                  value: preset.id,
                  label: preset.name,
                })),
              ]}
              onChange={(id) => id && applyPreset(id)}
            />
            <button
              type="button"
              onClick={newNewsletter}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <FilePlus2 className="h-4 w-4" />
              New empty newsletter
            </button>
          </div>
        </FieldGroup>

        <FieldGroup label="Width">
          <NumberStepper
            value={settings.width}
            min={320}
            max={900}
            step={10}
            suffix="px"
            onChange={(width) =>
              updateSettings({ width }, { coalesceKey: 'settings-width' })
            }
          />
          <p className="mt-2 text-xs text-slate-500">
            600px is the safe default — wider emails are clipped or scaled by
            some clients.
          </p>
        </FieldGroup>

        <FieldGroup label="Font">
          <SelectField
            value={settings.fontFamily}
            options={RICH_TEXT_FONTS.map((font) => ({
              value: font.stack,
              label: font.label,
            }))}
            onChange={(fontFamily) => updateSettings({ fontFamily })}
          />
          <p className="mt-2 text-xs text-slate-500">
            Only email-safe stacks, and it applies to every block. Webfonts
            don't load in most clients, so a family that isn't already installed
            silently falls back.
          </p>
        </FieldGroup>

        <TypographySection />

        <FieldGroup label="Colours">
          <div className="space-y-3">
            <ColorField
              label="Page background"
              value={settings.bgColor}
              onChange={(bgColor) =>
                updateSettings({ bgColor }, { coalesceKey: 'settings-bg' })
              }
            />
            <ColorField
              label="Email background"
              value={settings.cardBgColor}
              onChange={(cardBgColor) =>
                updateSettings({ cardBgColor }, { coalesceKey: 'settings-card' })
              }
            />
            <ColorField
              label="Base text"
              value={settings.textColor}
              onChange={(textColor) =>
                updateSettings({ textColor }, { coalesceKey: 'settings-text' })
              }
            />
            <ColorField
              label="Accent"
              value={settings.accentColor}
              onChange={(accentColor) =>
                updateSettings(
                  { accentColor },
                  { coalesceKey: 'settings-accent' }
                )
              }
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Base text is the document default. Headings and body copy take their
            colour from Typography above.
          </p>
        </FieldGroup>

        <FieldGroup label="Padding">
          <NumberStepper
            value={settings.padding}
            min={0}
            max={80}
            suffix="px"
            onChange={(padding) =>
              updateSettings({ padding }, { coalesceKey: 'settings-padding' })
            }
          />
          <p className="mt-2 text-xs text-slate-500">
            The gap between the email's edge and its content. Drops to 15px on
            narrow screens.
          </p>
        </FieldGroup>
      </PanelBody>
    </>
  );
};
