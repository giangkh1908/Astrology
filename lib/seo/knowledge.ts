/**
 * Trang tri thức SEO: hàm hỗ trợ dữ liệu
 *
 * 14 chính tinh x các chủ đề (topic); mỗi tổ hợp có dữ liệu trong STAR_DB thành một URL SEO riêng.
 * Số trang thực tế do getAllKnowledgeRoutes() quyết định, không cố định.
 * Mỗi trang lấy từ STAR_DB 4 đoạn đánh dấu (định điệu / luận đoán cốt lõi / căn cứ / xuất xứ).
 */

import { STAR_DB } from '@/lib/ziwei/db-analysis';
import type { TopicKey } from '@/lib/ziwei/db-analysis';
import { TOPIC_PALACE_NAME, TOPIC_LABEL } from '@/lib/ziwei/db-analysis';

export const ALL_STARS = [
  '紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府',
  '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军',
];

// Ánh xạ tên chính tinh <-> slug pinyin (URL dùng slug để tránh lỗi biên của URL chữ Hán trên Vercel/CDN)
export const STAR_TO_SLUG: Record<string, string> = {
  '紫微': 'ziwei',
  '天机': 'tianji',
  '太阳': 'taiyang',
  '武曲': 'wuqu',
  '天同': 'tiantong',
  '廉贞': 'lianzhen',
  '天府': 'tianfu',
  '太阴': 'taiyin',
  '贪狼': 'tanlang',
  '巨门': 'jumen',
  '天相': 'tianxiang',
  '天梁': 'tianliang',
  '七杀': 'qisha',
  '破军': 'pojun',
};

export const SLUG_TO_STAR: Record<string, string> = Object.fromEntries(
  Object.entries(STAR_TO_SLUG).map(([k, v]) => [v, k])
);

export const ALL_TOPICS: TopicKey[] = [
  'overview', 'personality', 'love', 'career', 'wealth', 'health',
  'family', 'children', 'move', 'friends', 'home', 'spirit', 'parents',
];

interface StarContent {
  mingGong: string;
  personality: string;
  xiongDi?: string;
  fuQi: string;
  ziNv?: string;
  caiBo: string;
  jiE: string;
  qianYi?: string;
  jiaoYou?: string;
  guanLu: string;
  tianZhai?: string;
  fuDe?: string;
  fuMu?: string;
}

const TOPIC_TO_FIELD: Record<TopicKey, keyof StarContent> = {
  overview:    'mingGong',
  personality: 'personality',
  love:        'fuQi',
  career:      'guanLu',
  wealth:      'caiBo',
  health:      'jiE',
  family:      'xiongDi' as keyof StarContent,
  children:    'ziNv' as keyof StarContent,
  move:        'qianYi' as keyof StarContent,
  friends:     'jiaoYou' as keyof StarContent,
  home:        'tianZhai' as keyof StarContent,
  spirit:      'fuDe' as keyof StarContent,
  parents:     'fuMu' as keyof StarContent,
};

interface ParsedContent {
  dingdiao: string;
  lundian: string;
  yiju: string;
  chuchu: string;
  raw: string;
  hasMarkers: boolean;
}

function parseStarContent(content: string): ParsedContent {
  const out: ParsedContent = { dingdiao: '', lundian: '', yiju: '', chuchu: '', raw: content, hasMarkers: false };
  if (!content) return out;
  if (!content.includes('**【一句话定调】**') && !content.includes('**【核心论断】**')) {
    out.lundian = content;
    return out;
  }
  out.hasMarkers = true;
  const re = /\*\*【([^】]+)】\*\*/g;
  const parts: { name: string; markerEnd: number; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    parts.push({ name: m[1], start: m.index, markerEnd: m.index + m[0].length });
  }
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const end = i + 1 < parts.length ? parts[i + 1].start : content.length;
    const text = content.slice(p.markerEnd, end).trim();
    if (p.name === '一句话定调') out.dingdiao = text;
    else if (p.name === '核心论断') out.lundian = text;
    else if (p.name === '命盘依据') out.yiju = text;
    else if (p.name === '经典出处') out.chuchu = text;
  }
  return out;
}

export interface KnowledgeData {
  star: string;
  topic: TopicKey;
  topicLabel: string;
  palaceName: string;
  parsed: ParsedContent;
  exists: boolean;
}

export function getKnowledge(star: string, topic: TopicKey): KnowledgeData {
  const profile = STAR_DB[star] as StarContent | undefined;
  const field = TOPIC_TO_FIELD[topic];
  const content = profile && field ? (profile[field] as string | undefined) ?? '' : '';
  return {
    star,
    topic,
    topicLabel: TOPIC_LABEL[topic],
    palaceName: TOPIC_PALACE_NAME[topic],
    parsed: parseStarContent(content),
    exists: Boolean(content),
  };
}

/** Sinh mọi tổ hợp chính tinh x chủ đề (dùng cho generateStaticParams) */
export function getAllKnowledgeRoutes() {
  const routes: { star: string; slug: string; topic: TopicKey }[] = [];
  for (const star of ALL_STARS) {
    for (const topic of ALL_TOPICS) {
      const data = getKnowledge(star, topic);
      if (data.exists) routes.push({ star, slug: STAR_TO_SLUG[star], topic });
    }
  }
  return routes;
}

/** Giới thiệu ngắn về chính tinh (dùng cho mục tìm hiểu sao của trang SEO) */
export const STAR_BRIEF_SEO: Record<string, string> = {
  '紫微': 'Tử Vi là đế tinh, chủ tôn quý. Cư Mệnh thường có khí chất lãnh đạo, hợp nền tảng lớn và vị trí cao.',
  '天机': 'Thiên Cơ là trí tuệ tinh, chủ lanh lợi biến hóa. Cư Mệnh thường thông minh linh hoạt, hợp vai trò phụ tá, hoạch định.',
  '太阳': 'Thái Dương là quý tinh, chủ danh dự và công vụ. Cư Mệnh thường quang minh lỗi lạc, hợp công chức, danh tiếng.',
  '武曲': 'Vũ Khúc là tài tinh, chủ cương nghị quyết đoán. Cư Mệnh thường giỏi quản lý tiền bạc, hợp thực nghiệp, tài chính.',
  '天同': 'Thiên Đồng là phúc tinh, chủ ôn hòa hưởng thụ. Cư Mệnh thường tính tình hiền hòa, có phúc khí.',
  '廉贞': 'Liêm Trinh là thứ đào hoa tinh, văn võ kiêm bị. Cư Mệnh thường đa tài đa nghệ, tình cảm phong phú.',
  '天府': 'Thiên Phủ là nam đẩu thủ tài tinh, chủ ổn trọng bảo thủ. Cư Mệnh thường đoan chính, khéo giữ kho tài.',
  '太阴': 'Thái Âm là nguyệt tinh phú quý, chủ điền trạch giàu có. Cư Mệnh thường tình cảm tinh tế, nữ mệnh rất tốt.',
  '贪狼': 'Tham Lang là đào hoa dục vọng tinh, đa tài giao tế rộng. Cư Mệnh thường nhiều tài nghệ, quan hệ xã hội rộng.',
  '巨门': 'Cự Môn là thị phi khẩu tài tinh, chủ biện luận truyền thông. Cư Mệnh thường ăn nói giỏi, hợp luật sư, giáo viên.',
  '天相': 'Thiên Tướng là ấn tinh phụ tá, chủ trung hậu thật thà. Cư Mệnh thường đoan chính, hợp hành chính, pháp vụ.',
  '天梁': 'Thiên Lương là lão nhân ấm tinh, giỏi hóa hung thành cát. Cư Mệnh thường từ bi lương thiện, hợp luật, y học.',
  '七杀': 'Thất Sát là tướng tinh, chủ cô độc quyết đoán mạo hiểm. Cư Mệnh thường cương nghị, hợp quân cảnh, khởi nghiệp.',
  '破军': 'Phá Quân là tinh phá cũ lập mới, chủ duyên lục thân mỏng. Cư Mệnh thường khai sáng biến động, hợp chuyên môn kỹ thuật.',
};
