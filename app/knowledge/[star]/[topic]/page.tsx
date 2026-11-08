/**
 * /knowledge/[star]/[topic] — Trang đích SEO
 *
 * 14 主星 × 13 topic = 182 个独立 URL
 * 每页含完整的 STAR_DB 4 段论断（一句话定调/核心论断/命盘依据/经典出处）
 *
 * SEO 要点：
 *  - title 含主关键词（如"紫微入命宫·倪海厦体系详解"）
 *  - description 用 dingdiao（一句话定调）
 *  - JSON-LD Article 结构化数据
 *  - 内链：同主星其他 12 宫 + 同宫其他 13 主星
 *  - generateStaticParams 静态生成，零运行时开销
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { TopicKey } from '@/lib/ziwei/db-analysis';
import {
  ALL_STARS,
  ALL_TOPICS,
  getKnowledge,
  getAllKnowledgeRoutes,
  STAR_TO_SLUG,
  SLUG_TO_STAR,
} from '@/lib/seo/knowledge';
import { SITE_URL } from '@/lib/site';

// Bản đồ hiển thị Hán-Việt (cục bộ cho trang tri thức)
const VI_STAR: Record<string, string> = {
  '紫微': 'Tử Vi', '天机': 'Thiên Cơ', '太阳': 'Thái Dương', '武曲': 'Vũ Khúc',
  '天同': 'Thiên Đồng', '廉贞': 'Liêm Trinh', '天府': 'Thiên Phủ', '太阴': 'Thái Âm',
  '贪狼': 'Tham Lang', '巨门': 'Cự Môn', '天相': 'Thiên Tướng', '天梁': 'Thiên Lương',
  '七杀': 'Thất Sát', '破军': 'Phá Quân',
};
const VI_PALACE: Record<string, string> = {
  '命宫': 'Mệnh', '夫妻': 'Phu Thê', '官禄': 'Quan Lộc', '财帛': 'Tài Bạch', '疾厄': 'Tật Ách',
  '兄弟': 'Huynh Đệ', '子女': 'Tử Tức', '迁移': 'Thiên Di', '仆役': 'Nô Bộc', '田宅': 'Điền Trạch',
  '福德': 'Phúc Đức', '父母': 'Phụ Mẫu',
};
const VI_TOPIC: Record<string, string> = {
  overview: 'Tổng quan mệnh cách', personality: 'Tính cách', love: 'Tình cảm hôn nhân',
  career: 'Sự nghiệp', wealth: 'Tài vận', health: 'Sức khỏe', family: 'Huynh đệ hợp tác',
  children: 'Con cái', move: 'Di chuyển xuất ngoại', friends: 'Giao tế quý nhân',
  home: 'Nhà đất bất động sản', spirit: 'Phúc đức tinh thần', parents: 'Cha mẹ bề trên',
};
const viStar = (s: string) => VI_STAR[s] ?? s;
const viPalace = (p: string) => VI_PALACE[p] ?? p;
const viTopic = (t: string, fallback: string) => VI_TOPIC[t] ?? fallback;

const VI_BRIEF: Record<string, string> = {
  '紫微': 'Tử Vi là đế tinh, chủ tôn quý. Tọa Mệnh thường có khí chất lãnh đạo, hợp nền tảng lớn, vị trí cao.',
  '天机': 'Thiên Cơ là sao trí tuệ, chủ linh hoạt, thay đổi. Tọa Mệnh thường thông minh nhanh nhạy, hợp làm tham mưu, hoạch định.',
  '太阳': 'Thái Dương là sao quý của nam, chủ danh tiếng và công quyền. Tọa Mệnh thường quang minh chính đại, hợp công chức, danh vọng.',
  '武曲': 'Vũ Khúc là sao tài, chủ cương nghị quyết đoán. Tọa Mệnh thường giỏi quản lý tiền bạc, hợp thực nghiệp, tài chính.',
  '天同': 'Thiên Đồng là phúc tinh, chủ ôn hòa hưởng thụ. Tọa Mệnh thường tính tình hiền hòa, có phúc khí.',
  '廉贞': 'Liêm Trinh là thứ đào hoa tinh, văn võ song toàn. Tọa Mệnh thường đa tài đa nghệ, tình cảm phong phú.',
  '天府': 'Thiên Phủ là sao giữ của của Nam Đẩu, chủ vững vàng bảo thủ. Tọa Mệnh thường đoan chính, khéo giữ kho tài.',
  '太阴': 'Thái Âm là sao mặt trăng, chủ điền trạch và phú quý. Tọa Mệnh thường tình cảm tinh tế, nữ mệnh rất tốt.',
  '贪狼': 'Tham Lang là đào hoa dục vọng tinh, nhiều tài nghệ, giao tế rộng. Tọa Mệnh thường đa tài, quan hệ xã hội rộng.',
  '巨门': 'Cự Môn là sao thị phi khẩu tài, chủ biện luận, truyền thông. Tọa Mệnh thường ăn nói giỏi, hợp luật sư, giáo viên.',
  '天相': 'Thiên Tướng là ấn tinh phò tá, chủ trung hậu thật thà. Tọa Mệnh thường đoan chính, hợp hành chính, pháp vụ.',
  '天梁': 'Thiên Lương là sao ấm phúc của bậc cao niên, giỏi hóa hung thành cát. Tọa Mệnh thường từ bi lương thiện, hợp luật, y.',
  '七杀': 'Thất Sát là tướng tinh, chủ cô độc, quyết đoán, mạo hiểm. Tọa Mệnh thường cương nghị, hợp quân cảnh, khởi nghiệp.',
  '破军': 'Phá Quân là sao phá hoại và đổi mới, lục thân duyên mỏng. Tọa Mệnh thường khai phá, hay biến động, hợp chuyên môn kỹ thuật.',
};

// 允许动态参数：如果某个 star/topic 组合不在 generateStaticParams 列表中
// 也允许运行时按需渲染，避免中文 URL 编码问题导致 404
export const dynamicParams = false;

export async function generateStaticParams() {
  const routes = getAllKnowledgeRoutes();
  // URL 用拼音 slug 替代中文，避开 Vercel/CDN 中文路由边界问题
  return routes.map(r => ({ star: r.slug, topic: r.topic }));
}

export async function generateMetadata({ params }: { params: Promise<{ star: string; topic: string }> }) {
  const { star: slug, topic } = await params;
  const star = SLUG_TO_STAR[slug];
  if (!star) return {};
  const data = getKnowledge(star, topic as TopicKey);
  if (!data.exists) return {};

  const title = `${viStar(star)} nhập cung ${viPalace(data.palaceName)} · ${viTopic(topic, data.topicLabel)} · Luận giải chi tiết`;
  const description = data.parsed.dingdiao
    || `Luận giải Tử Vi Đẩu Số: sao ${viStar(star)} nhập cung ${viPalace(data.palaceName)} — theo cổ thư «Tử Vi Đẩu Số Toàn Tập», «Cốt Tủy Phú».`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `${SITE_URL}/knowledge/${slug}/${topic}`,
    },
    alternates: {
      canonical: `${SITE_URL}/knowledge/${slug}/${topic}`,
    },
    keywords: [
      'Tử Vi Đẩu Số', viStar(star), viPalace(data.palaceName), viTopic(topic, data.topicLabel),
      `${viStar(star)} ${viPalace(data.palaceName)}`, `${viStar(star)} nhập cung ${viPalace(data.palaceName)}`,
      `Tử Vi Đẩu Số ${viStar(star)}`, 'Tử Vi Đẩu Số Toàn Tập',
    ],
  };
}

export default async function KnowledgePage({ params }: { params: Promise<{ star: string; topic: string }> }) {
  const { star: slug, topic } = await params;
  const star = SLUG_TO_STAR[slug];
  if (!star) notFound();
  const data = getKnowledge(star, topic as TopicKey);
  if (!data.exists) notFound();

  // 同主星其他 topic
  const otherTopicsForStar = ALL_TOPICS.filter(t => t !== topic && getKnowledge(star, t).exists);
  // 同 topic 其他主星
  const otherStarsForTopic = ALL_STARS.filter(s => s !== star && getKnowledge(s, topic as TopicKey).exists);

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${viStar(star)} nhập cung ${viPalace(data.palaceName)} · ${viTopic(topic, data.topicLabel)}`,
    description: data.parsed.dingdiao,
    author: { '@type': 'Organization', name: 'Nghiên cứu Tử Vi' },
    publisher: {
      '@type': 'Organization',
      name: 'Nghiên cứu Tử Vi',
      url: SITE_URL,
    },
    datePublished: '2026-04-28',
    dateModified: '2026-04-28',
    mainEntityOfPage: `${SITE_URL}/knowledge/${slug}/${topic}`,
    articleSection: 'Tử Vi Đẩu Số',
    keywords: ['Tử Vi Đẩu Số', viStar(star), viPalace(data.palaceName), viTopic(topic, data.topicLabel)].join(', '),
  };

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* 顶栏 */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(184,146,42,0.15)', background: 'var(--bg-page)' }}>
        <Link href="/" style={{ fontSize: '12px', color: 'var(--ac)', letterSpacing: '0.3em', textDecoration: 'none' }}>
          ← Trang chủ
        </Link>
        <div style={{ fontSize: '12px', color: 'var(--tx-3)', letterSpacing: '0.2em' }}>
          Kho tri thức
        </div>
        <Link href="/chart" style={{ fontSize: '12px', color: 'var(--ac)', letterSpacing: '0.2em', textDecoration: 'none' }}>
          Lập lá số →
        </Link>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-12">
        {/* 面包屑 */}
        <nav style={{ fontSize: '11px', color: 'var(--tx-3)', letterSpacing: '0.1em', marginBottom: '16px' }}>
          <Link href="/" style={{ color: 'var(--tx-3)', textDecoration: 'none' }}>Trang chủ</Link>
          <span style={{ margin: '0 8px' }}>/</span>
          <Link href="/knowledge" style={{ color: 'var(--tx-3)', textDecoration: 'none' }}>Kho tri thức</Link>
          <span style={{ margin: '0 8px' }}>/</span>
          <span>{viStar(star)}</span>
          <span style={{ margin: '0 8px' }}>·</span>
          <span style={{ color: 'var(--ac)' }}>Cung {viPalace(data.palaceName)}</span>
        </nav>

        {/* 标题区 */}
        <header style={{ marginBottom: '36px' }}>
          <div style={{ fontSize: '11px', color: 'var(--tx-3)', letterSpacing: '0.25em', marginBottom: '8px' }}>
            {viTopic(topic, data.topicLabel)} · Luận giải chi tiết
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 700, color: 'var(--tx-0)', letterSpacing: '0.1em', lineHeight: 1.2 }}>
            {viStar(star)} nhập cung {viPalace(data.palaceName)}
          </h1>
          {VI_BRIEF[star] && (
            <p style={{ fontSize: '13px', color: 'var(--tx-2)', marginTop: '14px', lineHeight: 1.8 }}>
              {VI_BRIEF[star]}
            </p>
          )}
        </header>

        {/* 内容 4 段 */}
        {data.parsed.dingdiao && (
          <Section title="Định điệu một câu" gradient>
            <p style={{ fontSize: '17px', color: 'var(--tx-0)', lineHeight: 1.9, fontWeight: 500, letterSpacing: '0.04em' }}>
              {data.parsed.dingdiao}
            </p>
          </Section>
        )}

        {data.parsed.lundian && (
          <Section title="Luận đoán cốt lõi">
            <div style={{ fontSize: '15px', color: 'var(--tx-0)', lineHeight: 2, letterSpacing: '0.02em', whiteSpace: 'pre-wrap' }}>
              {data.parsed.lundian}
            </div>
          </Section>
        )}

        {data.parsed.yiju && (
          <Section title="Căn cứ lá số">
            <div style={{ fontSize: '14px', color: 'var(--tx-0)', lineHeight: 2, letterSpacing: '0.02em', whiteSpace: 'pre-wrap' }}>
              {data.parsed.yiju}
            </div>
          </Section>
        )}

        {data.parsed.chuchu && (
          <Section title="Xuất xứ kinh điển" minimal>
            <div style={{ fontSize: '13px', color: 'var(--tx-2)', lineHeight: 2, letterSpacing: '0.02em', whiteSpace: 'pre-wrap' }}>
              {data.parsed.chuchu}
            </div>
          </Section>
        )}

        {/* CTA */}
        <div style={{
          margin: '40px 0 30px',
          padding: '24px',
          background: 'linear-gradient(135deg, rgba(212,169,72,0.15) 0%, rgba(184,146,42,0.06) 100%)',
          borderRadius: '14px',
          border: '1px solid rgba(184,146,42,0.3)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '14px', color: 'var(--tx-0)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '6px' }}>
            Muốn xem {viTopic(topic, data.topicLabel)} trong lá số của chính bạn?
          </div>
          <div style={{ fontSize: '12px', color: 'var(--tx-2)', marginBottom: '16px' }}>
            Nhập ngày giờ sinh để lập lá số · luận giải chính thống · AI giải đáp
          </div>
          <Link href="/chart" style={{
            display: 'inline-block',
            padding: '12px 28px',
            background: 'linear-gradient(135deg, #d4a948 0%, #b8922a 100%)',
            color: 'white',
            borderRadius: '999px',
            fontSize: '14px',
            fontWeight: 600,
            letterSpacing: '0.15em',
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(184,146,42,0.3)',
          }}>
            Lập lá số ngay →
          </Link>
        </div>

        {/* 内链：同主星其他 topic */}
        <Section title={`Các cung khác của sao ${viStar(star)}`} minimal>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {otherTopicsForStar.map(t => {
              const d = getKnowledge(star, t);
              return (
                <Link
                  key={t}
                  href={`/knowledge/${slug}/${t}`}
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    background: 'var(--bg-card)',
                    border: '1px solid rgba(184,146,42,0.25)',
                    borderRadius: '999px',
                    color: 'var(--tx-2)',
                    textDecoration: 'none',
                  }}
                >
                  {viStar(star)} nhập {viPalace(d.palaceName)}
                </Link>
              );
            })}
          </div>
        </Section>

        {/* 内链：同 topic 其他主星 */}
        <Section title={`Các chính tinh khác nhập cung ${viPalace(data.palaceName)}`} minimal>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {otherStarsForTopic.slice(0, 13).map(s => (
              <Link
                key={s}
                href={`/knowledge/${STAR_TO_SLUG[s]}/${topic}`}
                style={{
                  fontSize: '12px',
                  padding: '6px 12px',
                  background: 'var(--bg-card)',
                  border: '1px solid rgba(184,146,42,0.25)',
                  borderRadius: '999px',
                  color: 'var(--tx-2)',
                  textDecoration: 'none',
                }}
              >
                {viStar(s)} nhập {viPalace(data.palaceName)}
              </Link>
            ))}
          </div>
        </Section>

        {/* 古籍库链接 */}
        <div style={{
          marginTop: '40px',
          padding: '16px 20px',
          background: 'rgba(184,146,42,0.04)',
          border: '1px dashed rgba(184,146,42,0.25)',
          borderRadius: '10px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--ac-dim)', letterSpacing: '0.15em', marginBottom: '6px' }}>
            Muốn đọc nguyên điển?
          </div>
          <Link href="/library" style={{ fontSize: '13px', color: 'var(--ac)', fontWeight: 500, letterSpacing: '0.1em', textDecoration: 'none' }}>
            📜 Tra cứu thư viện cổ thư — Tử Vi Đẩu Số Toàn Tập / Toàn Thư / Cốt Tủy Phú →
          </Link>
        </div>
      </article>

      {/* 页脚 */}
      <footer style={{ borderTop: '1px solid rgba(184,146,42,0.15)', padding: '20px 24px', textAlign: 'center', fontSize: '11px', color: 'var(--tx-3)', letterSpacing: '0.1em' }}>
        <div style={{ marginBottom: '6px' }}>Nghiên cứu Tử Vi · chỉ để học tập, tham khảo</div>
        <div style={{ opacity: 0.85 }}>Nền tảng này không cấu thành lời khuyên y tế, đầu tư, pháp lý hay quyết định quan trọng nào</div>
      </footer>
    </div>
  );
}

function Section({ title, children, gradient, minimal }: { title: string; children: React.ReactNode; gradient?: boolean; minimal?: boolean }) {
  return (
    <section style={{ marginBottom: minimal ? '24px' : '32px' }}>
      <h2 style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        color: 'var(--ac)',
        fontWeight: 600,
        letterSpacing: '0.2em',
        marginBottom: '12px',
      }}>
        <span style={{ width: '4px', height: '14px', background: 'var(--ac)', borderRadius: '2px' }} />
        {title}
      </h2>
      <div style={{
        background: gradient
          ? 'linear-gradient(135deg, rgba(212,169,72,0.12) 0%, rgba(184,146,42,0.04) 100%)'
          : 'white',
        border: '1px solid rgba(184,146,42,0.15)',
        borderRadius: '10px',
        padding: minimal ? '14px 18px' : '20px 22px',
      }}>
        {children}
      </div>
    </section>
  );
}
