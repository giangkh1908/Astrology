/**
 * Lệnh gạch chéo (/) cho khung luận giải: gõ "/" để chọn mục, kiểu Claude Code.
 * Logic thuần, không phụ thuộc React, để test được.
 */
import { viPalace } from '../vn/terms';

export const TOPICS = [
  { key: 'overview',    name: 'menh-cach',  label: 'Mệnh cách', hint: 'Tổng quan lá số' },
  { key: 'love',        name: 'tinh-cam',   label: 'Tình cảm',  hint: 'Tình duyên, hôn nhân' },
  { key: 'career',      name: 'su-nghiep',  label: 'Sự nghiệp', hint: 'Công danh, nghề nghiệp' },
  { key: 'wealth',      name: 'tai-van',    label: 'Tài vận',   hint: 'Tiền bạc, của cải' },
  { key: 'health',      name: 'suc-khoe',   label: 'Sức khỏe',  hint: 'Thể chất, bệnh tật' },
  { key: 'personality', name: 'tinh-cach',  label: 'Tính cách', hint: 'Con người, tâm tính' },
] as const;

export const TOPIC_KEYS: readonly string[] = TOPICS.map(t => t.key);

export function topicLabel(key: string): string | undefined {
  return TOPICS.find(t => t.key === key)?.label;
}

export type SlashAction =
  | { type: 'open'; key: string; label: string }
  | { type: 'regenerate' }
  | { type: 'close' };

export interface SlashCommand {
  name: string;   // không dấu, gạch nối, không có "/"
  label: string;  // tên hiển thị
  hint: string;   // mô tả ngắn
  group: 'topic' | 'palace' | 'action';
  action: SlashAction;
}

/** Bỏ dấu tiếng Việt, chữ thường, khoảng trắng/gạch dưới → gạch nối */
export function slugVi(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/** Thứ tự cung truyền thống, bắt đầu từ Mệnh */
const PALACE_ORDER = [
  'Mệnh', 'Huynh Đệ', 'Phu Thê', 'Tử Tức', 'Tài Bạch', 'Tật Ách',
  'Thiên Di', 'Nô Bộc', 'Quan Lộc', 'Điền Trạch', 'Phúc Đức', 'Phụ Mẫu',
];

interface PalaceLike { branch: number; name: string; isShenGong?: boolean }

export function buildCommands(palaces: readonly PalaceLike[]): SlashCommand[] {
  const topics: SlashCommand[] = TOPICS.map(t => ({
    name: t.name, label: t.label, hint: t.hint, group: 'topic',
    action: { type: 'open', key: t.key, label: t.label },
  }));

  const rank = (vi: string) => {
    const i = PALACE_ORDER.indexOf(vi);
    return i < 0 ? PALACE_ORDER.length : i;
  };
  const named = palaces
    .map(p => ({ p, vi: viPalace(p.name).replace(/_/g, ' ') }))
    .sort((a, b) => rank(a.vi) - rank(b.vi));

  const palaceCmds: SlashCommand[] = named.map(({ p, vi }) => ({
    name: `cung-${slugVi(vi)}`,
    label: `Cung ${vi}`,
    hint: p.isShenGong ? 'Thân cư cung này' : 'Luận riêng cung',
    group: 'palace',
    action: { type: 'open', key: `palace:${p.branch}`, label: `Cung ${vi}` },
  }));

  const shen = named.find(({ p }) => p.isShenGong);
  if (shen) {
    palaceCmds.push({
      name: 'cung-than',
      label: 'Cung Thân',
      hint: `Thân cư ${shen.vi}`,
      group: 'palace',
      action: { type: 'open', key: `palace:${shen.p.branch}`, label: `Cung ${shen.vi}` },
    });
  }

  const actions: SlashCommand[] = [
    { name: 'luan-lai', label: 'Luận lại', hint: 'Luận lại mục đang mở', group: 'action', action: { type: 'regenerate' } },
    { name: 'dong', label: 'Đóng mục', hint: 'Đóng mục đang mở', group: 'action', action: { type: 'close' } },
  ];

  return [...topics, ...palaceCmds, ...actions];
}

/** "/su-nghiep năm nay thế nào" → { name: "su-nghiep", rest: "năm nay thế nào" }; không bắt đầu bằng "/" → null */
export function parseSlash(input: string): { name: string; rest: string } | null {
  const s = input.trimStart();
  if (!s.startsWith('/')) return null;
  const m = s.slice(1).match(/^(\S*)\s*([\s\S]*)$/);
  return { name: m?.[1] ?? '', rest: (m?.[2] ?? '').trim() };
}

/** Đang gõ tên lệnh (chưa có dấu cách) → hiện danh sách gợi ý */
export function isTypingCommand(input: string): boolean {
  const s = input.trimStart();
  return s.startsWith('/') && !/\s/.test(s.slice(1));
}

function score(cmd: SlashCommand, q: string): number {
  if (!q) return 0;
  const name = cmd.name;
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  const parts = name.split('-');
  // bỏ tiền tố "cung-" để "/quan" hay "/tai" khớp tên cung
  if (parts.some((_, i) => parts.slice(i).join('-').startsWith(q))) return 2;
  const initials = parts.map(p => p[0]).join('');
  if (initials.startsWith(q) || initials.slice(parts[0] === 'cung' ? 1 : 0).startsWith(q)) return 3;
  if (name.replace(/-/g, '').includes(q.replace(/-/g, ''))) return 4;
  if (slugVi(`${cmd.label} ${cmd.hint}`).includes(q)) return 5;
  return -1;
}

/** Lọc + xếp hạng lệnh theo chữ đã gõ (có dấu hay không đều được) */
export function filterCommands(cmds: readonly SlashCommand[], query: string): SlashCommand[] {
  const q = slugVi(query.replace(/^\//, ''));
  return cmds
    .map((c, i) => ({ c, i, s: score(c, q) }))
    .filter(x => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map(x => x.c);
}

/** Tìm lệnh khi người dùng nhấn Enter: khớp đúng tên trước, không thì lấy gợi ý tốt nhất */
export function resolveCommand(cmds: readonly SlashCommand[], name: string): SlashCommand | undefined {
  const q = slugVi(name);
  if (!q) return undefined;
  return cmds.find(c => c.name === q) ?? filterCommands(cmds, q)[0];
}
