import { NewsletterTemplate } from '../types';
import { createBareSection as bareSection } from './elementHelpers';

/**
 * Seed template loaded on first run, and the target of New.
 *
 * Three sections — Header, Body, Footer — because that's the shape almost every
 * newsletter takes, and because blocks have to live inside a section, so an
 * empty email with no sections has nowhere to put the first thing you add.
 *
 * All three are `bareSection`s: no border, padding, margin or fill, which the
 * generator emits as nothing at all. The structure exists for the editor; the
 * exported email is exactly its blocks until someone styles a section.
 */
export const BLANK_CANVAS_TEMPLATE: NewsletterTemplate = {
  id: 'blank',
  name: 'Untitled Newsletter',
  settings: {
    width: 600,
    bgColor: '#f3f4f6',
    cardBgColor: '#ffffff',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    textColor: '#111827',
    accentColor: '#944dbc',
    padding: 20,
  },
  elements: [
    {
      ...bareSection('blank-header', [
        {
          // No typography of its own: a new newsletter is entirely
          // theme-driven, so editing Theme restyles it.
          id: 'blank-h1',
          type: 'heading',
          label: 'Heading',
          text: 'Your Newsletter Title',
          level: 'h1',
          marginTop: 10,
          marginBottom: 15,
        },
      ]),
      label: 'Header',
    },
    {
      ...bareSection('blank-body', [
        {
          id: 'blank-p1',
          type: 'paragraph',
          label: 'Text',
          content:
            'Click this text to edit it, or drag a block in from the left panel.',
          marginTop: 0,
          marginBottom: 20,
        },
      ]),
      label: 'Body',
    },
    { ...bareSection('blank-footer', []), label: 'Footer' },
  ],
};

// Preset templates list
export const PRESET_TEMPLATES: NewsletterTemplate[] = [
  BLANK_CANVAS_TEMPLATE,
  {
    id: 'announcement',
    name: 'General Announcement',
    settings: {
      width: 600,
      bgColor: '#f8fafc',
      cardBgColor: '#ffffff',
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      textColor: '#0f172a',
      accentColor: '#2563eb',
      padding: 24,
    },
    elements: [
      bareSection('ann-header-section', [
        {
          id: 'ann-1',
          type: 'heading',
          text: 'SPECIAL ANNOUNCEMENT',
          level: 'h1',
          color: '#1e3a8a',
          fontSize: 26,
          transform: 'uppercase',
          letterSpacing: '1.5px',
          marginTop: 10,
          marginBottom: 15,
        },
        {
          id: 'ann-divider',
          type: 'divider',
          color: '#e2e8f0',
          height: 1,
          style: 'solid',
          marginTop: 10,
          marginBottom: 20,
        },
        {
          id: 'ann-para',
          type: 'paragraph',
          content:
            'Join us for our upcoming gathering this weekend! We have exciting news and updates to share with everyone.',
          color: '#334155',
          fontSize: 16,
          lineHeight: 1.6,
          marginTop: 0,
          marginBottom: 20,
        },
      ]),
      {
        // A framed section, so the preset also shows what borders/padding do.
        id: 'ann-cta-section',
        type: 'section',
        label: 'Call to Action',
        bgColor: '#f8fafc',
        borderColor: '#2563eb',
        borderStyle: 'solid',
        borderTopWidth: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderLeftWidth: 4,
        borderRadius: 4,
        paddingTop: 16,
        paddingRight: 20,
        paddingBottom: 16,
        paddingLeft: 20,
        marginTop: 0,
        marginBottom: 20,
        childElements: [
          {
            id: 'ann-quote',
            type: 'quote',
            quote: 'Community is where faith, hope, and purpose come together.',
            author: 'Fellowship Team',
            bgColor: '#f1f5f9',
            borderColor: '#2563eb',
            textColor: '#1e293b',
            fontSize: 16,
            marginTop: 10,
            marginBottom: 20,
          },
          {
            id: 'ann-btn',
            type: 'button',
            text: 'RSVP Now',
            url: 'https://example.com/rsvp',
            bgColor: '#2563eb',
            textColor: '#ffffff',
            fontSize: 16,
            fontWeight: 'bold',
            borderRadius: 6,
            paddingVertical: 12,
            paddingHorizontal: 24,
            alignment: 'center',
            marginTop: 10,
            marginBottom: 10,
          },
        ],
      },
    ],
  },
];
