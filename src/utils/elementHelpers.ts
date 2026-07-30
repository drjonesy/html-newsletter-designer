import { ContainerElement, EmailElement, ElementType } from '../types';

/**
 * True for blocks that hold `childElements`. Every tree walk (find, update,
 * delete, move, reorder, re-id) goes through this instead of comparing `type`
 * directly, so a new container type only has to be added to `ContainerElement`.
 */
export function isContainerElement(el: EmailElement): el is ContainerElement {
  return el.type === 'accent-section' || el.type === 'section';
}

export function createNewElement(type: ElementType): EmailElement {
  const id = `el-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  switch (type) {
    case 'header-image':
      return {
        id,
        type: 'header-image',
        label: 'Header Banner / Logo',
        src: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="468" height="88" viewBox="0 0 468 88"><rect width="100%" height="100%" fill="%231a2b56"/><text x="50%" y="55%" font-family="Arial, sans-serif" font-weight="bold" font-size="22" fill="%23ffffff" text-anchor="middle">YOUR LOGO BANNER</text></svg>`,
        alt: 'Header Image',
        width: 468,
        height: 88,
        alignment: 'left',
        paddingTop: 10,
        paddingBottom: 20,
      };

    case 'heading':
      return {
        id,
        type: 'heading',
        label: 'Section Heading',
        text: 'New Section Heading',
        level: 'h2',
        color: '#1a2b56',
        fontSize: 22,
        fontWeight: 'bold',
        fontStyle: 'normal',
        transform: 'uppercase',
        letterSpacing: '1px',
        marginTop: 15,
        marginBottom: 10,
      };

    case 'key-value':
      return {
        id,
        type: 'key-value',
        label: 'Date & Time:',
        value: 'Next Wednesday @ 7:00 PM',
        labelColor: '#1a2b56',
        valueColor: '#1a2b56',
        fontSize: 16,
        boldLabel: true,
        italicLabel: false,
        boldValue: false,
        italicValue: false,
        marginTop: 8,
        marginBottom: 12,
      };

    case 'paragraph':
      return {
        id,
        type: 'paragraph',
        label: 'Paragraph Text',
        content:
          'Add your email message content here. You can use <b>bold text</b>, <font color="#b22222">colored text</font>, or <a href="#" style="color:#b22222">links</a>.',
        color: '#333333',
        fontSize: 16,
        fontWeight: 'normal',
        fontStyle: 'normal',
        lineHeight: 1.6,
        marginTop: 8,
        marginBottom: 16,
      };

    case 'button':
      return {
        id,
        type: 'button',
        label: 'Call to Action Button',
        text: 'Click Here to Learn More',
        url: 'https://example.com',
        bgColor: '#b22222',
        textColor: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
        borderRadius: 5,
        paddingVertical: 14,
        paddingHorizontal: 25,
        alignment: 'left',
        marginTop: 15,
        marginBottom: 15,
      };

    case 'accent-section':
      return {
        id,
        type: 'accent-section',
        label: 'Red Accent Callout Block',
        borderColor: '#b22222',
        borderWidth: 5,
        paddingLeft: 20,
        marginBottom: 25,
        childElements: [
          {
            id: `child-${Date.now()}-1`,
            type: 'heading',
            text: 'Special Callout Title',
            level: 'h3',
            color: '#1a2b56',
            fontSize: 20,
            fontWeight: 'bold',
            fontStyle: 'normal',
            transform: 'uppercase',
            letterSpacing: '1px',
            marginTop: 0,
            marginBottom: 10,
          },
          {
            id: `child-${Date.now()}-2`,
            type: 'paragraph',
            content: 'Important details inside the accent section line.',
            color: '#333333',
            fontSize: 15,
            fontWeight: 'normal',
            fontStyle: 'normal',
            lineHeight: 1.6,
            marginTop: 5,
            marginBottom: 10,
          },
        ],
      };

    case 'section':
      // Starts empty on purpose: the canvas shows a drop zone, and the sidebar
      // adds into whichever section is selected, so the next click fills it.
      return {
        id,
        type: 'section',
        label: 'Section',
        bgColor: 'transparent',
        borderColor: '#cbd5e1',
        borderStyle: 'solid',
        borderTopWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderLeftWidth: 1,
        borderRadius: 0,
        paddingTop: 20,
        paddingRight: 20,
        paddingBottom: 20,
        paddingLeft: 20,
        marginTop: 0,
        marginBottom: 20,
        childElements: [],
      };

    case 'divider':
      return {
        id,
        type: 'divider',
        label: 'Divider Line',
        color: '#e2e8f0',
        height: 1,
        style: 'solid',
        marginTop: 15,
        marginBottom: 20,
      };

    case 'quote':
      return {
        id,
        type: 'quote',
        label: 'Scripture / Quote Box',
        quote: '“You can’t heal a wound by saying it’s not there.”',
        author: 'Jeremiah 6:14',
        bgColor: '#fdf2f2',
        borderColor: '#b22222',
        textColor: '#1a2b56',
        fontSize: 16,
        fontWeight: 'normal',
        fontStyle: 'italic',
        marginTop: 12,
        marginBottom: 18,
      };

    case 'custom-html':
      return {
        id,
        type: 'custom-html',
        label: 'Custom HTML Snippet',
        html: `<div style="padding: 10px; background-color: #f8fafc; border: 1px dashed #cbd5e1; text-align: center; font-size: 14px; color: #64748b;">
  Custom HTML Snippet (Edit raw HTML in properties panel)
</div>`,
      };

    default:
      throw new Error(`Unknown element type: ${type}`);
  }
}
