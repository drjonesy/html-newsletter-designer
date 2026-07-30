import { NewsletterTemplate, EmailElement } from '../types';

/**
 * Wraps text in <strong>/<em> on top of the inline font-weight/font-style styles.
 * Outlook (Word engine) ignores inherited font-style on some containers, so the
 * semantic tags are the reliable belt to the inline-style braces.
 */
function wrapEmphasis(html: string, bold: boolean, italic: boolean): string {
  let out = html;
  if (bold) out = `<strong>${out}</strong>`;
  if (italic) out = `<em>${out}</em>`;
  return out;
}

export function renderElementToHtml(element: EmailElement, fontFamily: string): string {
  switch (element.type) {
    case 'header-image': {
      const img = `<img src="${element.src}" alt="${element.alt}" width="${element.width}" ${element.height ? `height="${element.height}"` : ''} style="max-width:100%; height:auto; display:inline-block; border:0;" />`;
      const wrappedImg = element.href
        ? `<a href="${element.href}" target="_blank" style="text-decoration:none;">${img}</a>`
        : img;
      return `<table width="100%" border="0" cellspacing="0" cellpadding="0">
  <tr>
    <td align="${element.alignment}" style="padding-top:${element.paddingTop}px; padding-bottom:${element.paddingBottom}px;">
      ${wrappedImg}
    </td>
  </tr>
</table>`;
    }

    case 'heading': {
      const Tag = element.level || 'h2';
      const weight = element.fontWeight ?? 'bold';
      const style = element.fontStyle ?? 'normal';
      const text = wrapEmphasis(element.text, weight === 'bold', style === 'italic');
      return `<${Tag} style="font-size:${element.fontSize}px; color:${element.color}; margin-top:${element.marginTop}px; margin-bottom:${element.marginBottom}px; text-transform:${element.transform}; letter-spacing:${element.letterSpacing}; font-family:${fontFamily}; font-weight:${weight}; font-style:${style}; line-height:1.2;">${text}</${Tag}>`;
    }

    case 'key-value': {
      const boldLabel = element.boldLabel !== false;
      const label = wrapEmphasis(element.label, boldLabel, !!element.italicLabel);
      const value = wrapEmphasis(element.value, !!element.boldValue, !!element.italicValue);
      return `<p style="font-size:${element.fontSize}px; line-height:1.6; margin-top:${element.marginTop}px; margin-bottom:${element.marginBottom}px; font-family:${fontFamily};">
  <span style="color:${element.labelColor}; font-weight:${boldLabel ? 'bold' : 'normal'}; font-style:${element.italicLabel ? 'italic' : 'normal'};">${label}</span>&nbsp;<span style="color:${element.valueColor}; font-weight:${element.boldValue ? 'bold' : 'normal'}; font-style:${element.italicValue ? 'italic' : 'normal'};">${value}</span>
</p>`;
    }

    case 'paragraph': {
      const weight = element.fontWeight ?? 'normal';
      const style = element.fontStyle ?? 'normal';
      const content = wrapEmphasis(element.content, weight === 'bold', style === 'italic');
      return `<div style="font-size:${element.fontSize}px; line-height:${element.lineHeight}; color:${element.color}; margin-top:${element.marginTop}px; margin-bottom:${element.marginBottom}px; font-family:${fontFamily}; font-weight:${weight}; font-style:${style};">
  ${content}
</div>`;
    }

    case 'button': {
      return `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top:${element.marginTop}px; margin-bottom:${element.marginBottom}px;">
  <tr>
    <td align="${element.alignment}">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${element.url}" style="height:${element.paddingVertical * 2 + element.fontSize}px;v-text-anchor:middle;width:${element.paddingHorizontal * 2 + 100}px;" arcsize="${element.borderRadius * 2}%" stroke="f" fillcolor="${element.bgColor}">
        <w:anchorlock/>
        <center style="color:${element.textColor};font-family:${fontFamily};font-size:${element.fontSize}px;font-weight:${element.fontWeight};">${element.text}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${element.url}" target="_blank" style="background-color:${element.bgColor}; color:${element.textColor}; font-size:${element.fontSize}px; font-weight:${element.fontWeight}; text-decoration:none; padding:${element.paddingVertical}px ${element.paddingHorizontal}px; border-radius:${element.borderRadius}px; display:inline-block; font-family:${fontFamily}; text-align:center;">
        ${element.text}
      </a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`;
    }

    case 'accent-section': {
      const childrenHtml = (element.childElements || [])
        .map((child) => renderElementToHtml(child, fontFamily))
        .join('\n');

      return `<div style="border-left:${element.borderWidth}px solid ${element.borderColor}; padding-left:${element.paddingLeft}px; margin-bottom:${element.marginBottom}px;">
${childrenHtml}
</div>`;
    }

    case 'divider': {
      return `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top:${element.marginTop}px; margin-bottom:${element.marginBottom}px;">
  <tr>
    <td style="border-top:${element.height}px ${element.style} ${element.color}; font-size:1px; line-height:1px;">&nbsp;</td>
  </tr>
</table>`;
    }

    case 'quote': {
      const weight = element.fontWeight ?? 'normal';
      const style = element.fontStyle ?? 'italic';
      const quote = wrapEmphasis(`"${element.quote}"`, weight === 'bold', style === 'italic');
      return `<blockquote style="margin-top:${element.marginTop}px; margin-bottom:${element.marginBottom}px; padding:16px 20px; background-color:${element.bgColor}; border-left:4px solid ${element.borderColor}; color:${element.textColor}; font-size:${element.fontSize}px; font-weight:${weight}; font-style:${style}; font-family:${fontFamily}; border-radius:4px;">
  ${quote}
  ${element.author ? `<footer style="font-style:normal; font-size:14px; margin-top:8px; font-weight:bold; color:${element.textColor};">— ${element.author}</footer>` : ''}
</blockquote>`;
    }

    case 'custom-html': {
      return element.html;
    }

    default:
      return '';
  }
}

export function generateEmailHtml(template: NewsletterTemplate): string {
  const { settings, elements } = template;

  const elementsHtml = elements
    .map((el) => renderElementToHtml(el, settings.fontFamily))
    .join('\n\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${template.name}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: ${settings.bgColor}; font-family: ${settings.fontFamily}; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .responsive-td { padding: 15px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${settings.bgColor}; font-family: ${settings.fontFamily};">
  <center style="width: 100%; background-color: ${settings.bgColor}; padding-top: 20px; padding-bottom: 40px;">
    <!--[if mso]>
    <table align="center" border="0" cellspacing="0" cellpadding="0" width="${settings.width}">
    <tr>
    <td align="center" valign="top" width="${settings.width}">
    <![endif]-->
    <table class="email-container" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto; width: ${settings.width}px; max-width: ${settings.width}px; background-color: ${settings.cardBgColor}; color: ${settings.textColor}; font-family: ${settings.fontFamily}; font-size: 16px;">
      <tbody>
        <tr>
          <td class="responsive-td" style="padding: ${settings.padding}px;">
${elementsHtml}
          </td>
        </tr>
      </tbody>
    </table>
    <!--[if mso]>
    </td>
    </tr>
    </table>
    <![endif]-->
  </center>
</body>
</html>`;
}
