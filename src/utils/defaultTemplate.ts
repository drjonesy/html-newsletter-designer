import { NewsletterTemplate } from '../types';
import { createBareSection as bareSection } from './elementHelpers';

/**
 * Seed template loaded on first run, and the target of New.
 *
 * **Genuinely empty.** The button says "New empty newsletter", and it used to
 * produce Header / Body / Footer sections with a title and a line of
 * placeholder copy in them — which is a starting point, not a blank one, and
 * everything in it had to be deleted before the real newsletter could begin.
 *
 * Nothing here needs a section to aim at any more: a block added to an empty
 * email brings its own bare wrapper, in `addElement` and `dropNewElement`
 * alike. That is the same thing `migrateToSections` does for loose blocks, and
 * it's why "blocks live inside sections" can stay true without a new document
 * having to arrive pre-populated.
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
  elements: [],
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
