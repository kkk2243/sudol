/** 서버(sanitize-html)와 브라우저(DOMPurify)가 공유하는 허용 목록 */
export const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'a', 'strong', 'em', 'del', 's', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'figure', 'figcaption', 'img', 'div', 'span', 'input',
];

export const ALLOWED_ATTR: Record<string, string[]> = {
  a: ['href', 'title', 'target', 'rel', 'class'],
  img: ['src', 'alt', 'width', 'height', 'srcset', 'sizes', 'loading', 'decoding', 'title'],
  h2: ['id'],
  h3: ['id'],
  h4: ['id'],
  div: ['class', 'data-yt'],
  span: ['class', 'aria-hidden'],
  code: ['class'],
  th: ['align'],
  td: ['align'],
  input: ['type', 'checked', 'disabled'],
  ol: ['start'],
};
