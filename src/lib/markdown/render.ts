/**
 * 마크다운 → HTML 공용 렌더러 (서버와 관리자 미리보기에서 같이 사용)
 * - 원시 HTML은 모두 이스케이프(작성자가 HTML을 넣어도 실행되지 않음)
 * - 최종 결과는 호출 측이 넘긴 sanitize 함수로 한 번 더 정화 (서버: sanitize-html, 브라우저: DOMPurify)
 * - 이미지: lazy loading, width/height, srcset 자동
 * - 유튜브 URL만 있는 줄 → 가벼운 임베드(클릭 시 iframe 로드)
 * - h2/h3 에 id 부여 + 목차 수집
 */
import { Marked, type Token, type Tokens } from 'marked';
import { escapeHtml } from '../util';
import { imgAttrs } from '../media';

export interface TocItem {
  id: string;
  text: string;
  depth: number;
}

export interface RenderResult {
  /** 본문 전체 */
  html: string;
  /** 중간 광고 삽입용으로 반으로 나눈 본문 (두 번째가 빈 문자열일 수 있음) */
  parts: [string, string];
  toc: TocItem[];
}

export type Sanitizer = (html: string) => string;

const YT_RE =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#][^\s]*)?$/;

export function youtubeId(url: string): string | null {
  const m = YT_RE.exec(url.trim());
  return m ? m[1] : null;
}

function headingId(text: string, used: Map<string, number>): string {
  let base =
    text
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/&[a-z#0-9]+;/g, '')
      .replace(/[^0-9a-z가-힣]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) || 'section';
  base = 'h-' + base;
  const n = used.get(base) ?? 0;
  used.set(base, n + 1);
  return n ? `${base}-${n + 1}` : base;
}

function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:|mailto:)/i.test(h)) return h;
  if (h.startsWith('/') && !h.startsWith('//')) return h;
  if (h.startsWith('#')) return h;
  return null;
}

function youtubeEmbed(id: string): string {
  return (
    `<div class="yt" data-yt="${id}">` +
    `<a class="yt-link" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener noreferrer">` +
    `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="유튜브 동영상 썸네일" width="480" height="360" loading="lazy" decoding="async">` +
    `<span class="yt-play" aria-hidden="true"></span><span class="sr-only">유튜브 동영상 재생</span></a></div>`
  );
}

function imageHtml(href: string, alt: string, title: string | null): string {
  const src = safeHref(href) ?? '';
  if (!src) return '';
  const a = imgAttrs(src);
  const attrs = [
    `src="${escapeHtml(a.src)}"`,
    `alt="${escapeHtml(alt)}"`,
    a.width ? `width="${a.width}"` : '',
    a.height ? `height="${a.height}"` : '',
    a.srcset ? `srcset="${escapeHtml(a.srcset)}"` : '',
    a.sizes ? `sizes="${escapeHtml(a.sizes)}"` : '',
    'loading="lazy"',
    'decoding="async"',
  ]
    .filter(Boolean)
    .join(' ');
  const cap = title ? `<figcaption>${escapeHtml(title)}</figcaption>` : '';
  return `<figure><img ${attrs}>${cap}</figure>`;
}

function createMarked(toc: TocItem[]) {
  const used = new Map<string, number>();
  const m = new Marked({ gfm: true, breaks: true });
  m.use({
    renderer: {
      html({ text }: Tokens.HTML | Tokens.Tag) {
        return escapeHtml(text);
      },
      heading({ tokens, depth }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens);
        // 본문의 # 는 h2 로 내림(페이지 제목 h1 은 하나만)
        const level = Math.min(4, Math.max(2, depth));
        const plain = inner.replace(/<[^>]+>/g, '');
        const id = headingId(plain, used);
        if (level <= 3) toc.push({ id, text: plain, depth: level });
        return `<h${level} id="${id}">${inner}</h${level}>\n`;
      },
      image({ href, title, text }: Tokens.Image) {
        return imageHtml(href, text, title);
      },
      link({ href, title, tokens }: Tokens.Link) {
        const inner = this.parser.parseInline(tokens);
        const h = safeHref(href);
        if (!h) return inner;
        const external = /^https?:/i.test(h);
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        const ext = external ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${escapeHtml(h)}"${t}${ext}>${inner}</a>`;
      },
      paragraph({ tokens }: Tokens.Paragraph) {
        const meaningful = tokens.filter((t: Token) => !(t.type === 'text' && !t.raw.trim()) && t.type !== 'br');
        // 유튜브 링크만 있는 문단 → 임베드
        if (meaningful.length === 1 && meaningful[0].type === 'link') {
          const l = meaningful[0] as Tokens.Link;
          const id = youtubeId(l.href);
          if (id && (l.text === l.href || l.raw.trim() === l.href)) return youtubeEmbed(id) + '\n';
        }
        // 이미지만 있는 문단 → figure 들만 출력(<p> 안에 figure 불가)
        if (meaningful.length > 0 && meaningful.every((t: Token) => t.type === 'image')) {
          return meaningful.map((t) => this.parser.parseInline([t])).join('\n') + '\n';
        }
        return `<p>${this.parser.parseInline(tokens)}</p>\n`;
      },
      code({ text, lang }: Tokens.Code) {
        const cls = lang && /^[a-z0-9+#-]{1,20}$/i.test(lang) ? ` class="language-${lang}"` : '';
        return `<pre><code${cls}>${escapeHtml(text)}</code></pre>\n`;
      },
      table(token: Tokens.Table) {
        // 기본 렌더링을 스크롤 래퍼로 감싸기
        let header = '';
        for (const cell of token.header) {
          header += `<th${cell.align ? ` align="${cell.align}"` : ''}>${this.parser.parseInline(cell.tokens)}</th>`;
        }
        let body = '';
        for (const row of token.rows) {
          body += '<tr>';
          for (const cell of row) {
            body += `<td${cell.align ? ` align="${cell.align}"` : ''}>${this.parser.parseInline(cell.tokens)}</td>`;
          }
          body += '</tr>';
        }
        return `<div class="table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>\n`;
      },
    },
  });
  return m;
}

/** 중간 광고를 넣을 지점: 전체 블록의 절반 근처, 제목 바로 앞/뒤는 피함 */
function splitIndex(tokens: Token[]): number {
  const blocks = tokens.filter((t) => t.type !== 'space');
  if (blocks.length < 8) return -1;
  let target = Math.floor(tokens.length / 2);
  for (let i = target; i < tokens.length - 2; i++) {
    const prev = tokens[i - 1];
    if (prev && prev.type === 'paragraph' && tokens[i].type !== 'heading') return i;
  }
  return -1;
}

export function renderMarkdown(md: string, sanitize: Sanitizer): RenderResult {
  const toc: TocItem[] = [];
  const m = createMarked(toc);
  const tokens = m.lexer(md || '');
  const links = (tokens as any).links;
  const idx = splitIndex(tokens);

  const parse = (list: Token[]) => {
    const arr = list as Token[] & { links?: unknown };
    arr.links = links;
    return sanitize(m.parser(arr as any) as string);
  };

  if (idx < 0) {
    const html = parse(tokens);
    return { html, parts: [html, ''], toc };
  }
  const a = parse(tokens.slice(0, idx));
  const b = parse(tokens.slice(idx));
  return { html: a + b, parts: [a, b], toc };
}
