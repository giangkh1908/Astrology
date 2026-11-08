/**
 * 古籍原典查询库 — 入口
 *
 * 加载所有古籍数据 + 提供查询/搜索 API
 * 数据为 JSON 静态打包，零 DB 依赖、零网络请求
 */

import type { Book, Paragraph, SearchHit } from './types';
import { guSuiFu } from './data/gusuifu';
import { ziWeiQuanJi } from './data/quanji';
import { ziWeiQuanShu } from './data/quanshu';

/** 所有已收录古籍 */
export const ALL_BOOKS: Book[] = [
  guSuiFu,
  ziWeiQuanJi,
  ziWeiQuanShu,
];

/** Lớp hiển thị tiếng Việt cho từng sách (nguyên văn trong data vẫn giữ chữ Hán) */
const BOOK_VI: Record<string, Pick<Book, 'titleVi' | 'dynastyVi' | 'authorVi' | 'introVi'>> = {
  gusuifu: {
    titleVi: 'Cốt Tủy Phú',
    dynastyVi: 'thời Minh',
    authorVi: 'Cổ thư Tử Vi truyền lại (không rõ tác giả)',
    introVi: 'Bộ khẩu quyết cô đọng nhất của Tử Vi Đẩu Số, toàn văn khoảng 1500 chữ; là kinh điển bắt buộc của người học Tử Vi.',
  },
  quanji: {
    titleVi: 'Tử Vi Đẩu Số Toàn Tập',
    dynastyVi: 'thời Minh',
    authorVi: 'tương truyền do Trần Đoàn tổ sư truyền',
    introVi: 'Bộ cổ thư nền tảng của Tử Vi Đẩu Số: tổng luận, các sao và các cách cục.',
  },
  quanshu: {
    titleVi: 'Tử Vi Đẩu Số Toàn Thư',
    dynastyVi: 'thời Minh',
    authorVi: 'La Hồng Tiên biên soạn',
    introVi: 'Cổ thư hệ thống nhất của Tử Vi Đẩu Số, nhấn mạnh quan hệ giữa mười hai cung và Tứ Hóa; là giáo trình chính của người học Tử Vi từ đời Thanh về sau.',
  },
};

/** Trả về sách kèm thông tin hiển thị tiếng Việt (fallback về dữ liệu gốc) */
export function viBook(book: Book) {
  const v = BOOK_VI[book.slug] ?? {};
  return {
    title: v.titleVi ?? book.titleVi ?? book.title,
    dynasty: v.dynastyVi ?? book.dynastyVi ?? book.dynasty,
    author: v.authorVi ?? book.authorVi ?? book.author,
    intro: v.introVi ?? book.introVi ?? book.intro,
  };
}

/** 总段落数（用于首页统计） */
export const TOTAL_PARAGRAPHS = ALL_BOOKS.reduce(
  (sum, b) => sum + b.chapters.reduce((s, c) => s + c.paragraphs.length, 0),
  0,
);

/** 按 slug 取书 */
export function getBookBySlug(slug: string): Book | null {
  return ALL_BOOKS.find(b => b.slug === slug) ?? null;
}

/** 按章节序号取章节 */
export function getChapter(bookSlug: string, chapterIdx: number) {
  const book = getBookBySlug(bookSlug);
  if (!book) return null;
  const chapter = book.chapters[chapterIdx];
  if (!chapter) return null;
  return { book, chapter, chapterIdx };
}

/** 按段落 id 取段落（含书与章节信息）*/
export function getParagraphById(id: string) {
  for (const book of ALL_BOOKS) {
    for (let i = 0; i < book.chapters.length; i++) {
      const ch = book.chapters[i];
      const p = ch.paragraphs.find(p => p.id === id);
      if (p) {
        return { book, chapter: ch, chapterIdx: i, paragraph: p };
      }
    }
  }
  return null;
}

/**
 * 全文搜索
 *
 * 简单子字符串匹配（不分词，对中文 OK）
 * 大小写不敏感、繁简转换暂不支持
 */
export function searchClassics(query: string, limit = 30): SearchHit[] {
  const q = query.trim();
  if (q.length < 1) return [];

  const hits: SearchHit[] = [];
  for (const book of ALL_BOOKS) {
    for (const chapter of book.chapters) {
      for (const p of chapter.paragraphs) {
        const idx = p.text.indexOf(q);
        if (idx < 0) continue;

        // 提取上下文（前后各 40 字）
        const start = Math.max(0, idx - 40);
        const end = Math.min(p.text.length, idx + q.length + 40);
        const before = p.text.slice(start, idx);
        const matched = p.text.slice(idx, idx + q.length);
        const after = p.text.slice(idx + q.length, end);

        const snippet = (start > 0 ? '…' : '')
          + escapeHtml(before)
          + `<mark>${escapeHtml(matched)}</mark>`
          + escapeHtml(after)
          + (end < p.text.length ? '…' : '');

        hits.push({
          bookSlug: book.slug,
          bookTitle: book.title,
          chapterTitle: chapter.title,
          paragraphId: p.id,
          snippet,
          text: p.text,
        });

        if (hits.length >= limit) return hits;
      }
    }
  }
  return hits;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export type { Book, Chapter, Paragraph, SearchHit } from './types';
