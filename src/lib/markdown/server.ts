import sanitizeHtml from 'sanitize-html';
import { renderMarkdown, type RenderResult } from './render';
import { ALLOWED_ATTR, ALLOWED_TAGS } from './sanitize-config';

const options: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTR,
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['https'] },
  allowProtocolRelative: false,
  allowedClasses: {
    div: ['yt', 'table-wrap'],
    a: ['yt-link'],
    span: ['yt-play', 'sr-only'],
    code: [/^language-[a-z0-9+#-]+$/i],
  },
  transformTags: {
    input: (tagName, attribs) =>
      attribs.type === 'checkbox'
        ? { tagName, attribs: { type: 'checkbox', disabled: '', ...(attribs.checked !== undefined ? { checked: '' } : {}) } }
        : { tagName: 'span', attribs: {} },
  },
};

export function sanitize(html: string): string {
  return sanitizeHtml(html, options);
}

export function renderMarkdownServer(md: string): RenderResult {
  return renderMarkdown(md, sanitize);
}
